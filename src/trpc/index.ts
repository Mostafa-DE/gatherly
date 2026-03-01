import { initTRPC, TRPCError } from "@trpc/server"
import { timingSafeEqual } from "node:crypto"
import { eq, and } from "drizzle-orm"
import superjson from "superjson"

import type { Context } from "@/trpc/context"
import { ValidationError } from "@/exceptions"
import { organization, member } from "@/db/auth-schema"
import { logger } from "@/lib/logger"
import { consumeBotRequestNonce } from "@/plugins/assistant/data-access/bot-request-nonces"

const trpcLogger = logger.withTag("trpc")

const publicErrorCodes = new Set([
  "NOT_FOUND",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
])

const BOT_REQUEST_NONCE_TTL_MS = Number.parseInt(
  process.env.BOT_REQUEST_NONCE_TTL_MS ?? "300000",
  10
)

function constantTimeEquals(value: string, expected: string): boolean {
  const valueBuf = Buffer.from(value)
  const expectedBuf = Buffer.from(expected)
  if (valueBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(valueBuf, expectedBuf)
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter(opts) {
    // Log unexpected server errors with full detail server-side.
    if (!publicErrorCodes.has(opts.error.code)) {
      trpcLogger.error(opts.error.message, opts.error.cause ?? "")
    }

    // Normalize ValidationError to BAD_REQUEST
    if (opts.error.cause instanceof ValidationError) {
      return {
        ...opts.shape,
        data: {
          ...opts.shape.data,
          code: "BAD_REQUEST",
          httpStatus: 400,
          message: opts.error.cause.message,
        },
      }
    }

    // Never expose internal error details to clients.
    if (!publicErrorCodes.has(opts.error.code)) {
      return {
        ...opts.shape,
        message: "Request could not be completed",
        data: {
          ...opts.shape.data,
          stack: undefined,
        },
      }
    }
    return opts.shape
  },
})

export const router = t.router
export const middleware = t.middleware

/**
 * Public procedure - no authentication required.
 * Use for: public data, health checks, etc.
 */
export const publicProcedure = t.procedure

/**
 * Protected procedure - user must be authenticated.
 * Narrows ctx.user and ctx.session to non-null.
 * Use for: user profile, creating organizations, etc.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user?.id || !ctx.session?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      session: ctx.session,
    },
  })
})

/**
 * Organization procedure - user must be authenticated AND have an active organization.
 * Adds activeOrganization and membership to context.
 * Use for: managing activities, sessions, participants, etc.
 */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const activeOrganizationId = ctx.session.activeOrganizationId

  if (!activeOrganizationId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active organization selected",
    })
  }

  // Fetch the active organization
  const [activeOrganization] = await ctx.db
    .select()
    .from(organization)
    .where(eq(organization.id, activeOrganizationId))
    .limit(1)

  if (!activeOrganization) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Active organization not found",
    })
  }

  // Fetch the user's membership in this organization
  const [membership] = await ctx.db
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, activeOrganizationId),
        eq(member.userId, ctx.user.id)
      )
    )
    .limit(1)

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    })
  }

  return next({
    ctx: {
      ...ctx,
      activeOrganization,
      membership,
    },
  })
})

/**
 * Bot procedure - authenticates via Bearer token against BOT_API_SECRET env var.
 * Use for: OpenClaw bot endpoints (machine-to-machine auth).
 */
export const botProcedure = t.procedure.use(async ({ ctx, next }) => {
  const primarySecret = process.env.BOT_API_SECRET
  const secondSecret = process.env.BOT_API_SECOND_SECRET
  if (!primarySecret || !secondSecret) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Service temporarily unavailable",
    })
  }

  const authHeader = ctx.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing or invalid Authorization header",
    })
  }

  const token = authHeader.slice(7)
  if (!constantTimeEquals(token, primarySecret)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid bot authentication credentials",
    })
  }

  const botSecretHeader = ctx.headers.get("x-bot-secret")?.trim() ?? ""
  if (!botSecretHeader || !constantTimeEquals(botSecretHeader, secondSecret)) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid bot authentication credentials",
    })
  }

  const botSenderId = ctx.headers.get("x-bot-user-id")?.trim() ?? ""
  if (!botSenderId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing bot sender id",
    })
  }

  const botNonce = ctx.headers.get("x-bot-nonce")?.trim() ?? ""
  if (!botNonce || botNonce.length > 200) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing or invalid bot nonce",
    })
  }

  const accepted = await consumeBotRequestNonce({
    senderId: botSenderId,
    nonce: botNonce,
    ttlMs: BOT_REQUEST_NONCE_TTL_MS,
  })

  if (!accepted) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Replay detected",
    })
  }

  return next({
    ctx: {
      ...ctx,
      botSenderId,
    },
  })
})

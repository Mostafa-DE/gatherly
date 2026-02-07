import { initTRPC, TRPCError } from "@trpc/server"
import { eq, and } from "drizzle-orm"
import superjson from "superjson"

import type { Context } from "@/trpc/context"
import { ValidationError } from "@/exceptions"
import { organization, member } from "@/db/auth-schema"

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter(opts) {
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
 * Use for: managing activities, sessions, rosters, etc.
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

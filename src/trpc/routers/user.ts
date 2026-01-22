import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { router, publicProcedure, protectedProcedure } from "@/trpc"
import { getUserById, updateUser } from "@/data-access/users"
import { updateProfileSchema } from "@/schemas/user"
import { organization, member } from "@/db/auth-schema"
import { auth } from "@/auth"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getUserById(input.id)
    }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return updateUser(ctx.user.id, input)
    }),

  // whoami - user + active organization + membership role
  whoami: protectedProcedure.query(async ({ ctx }) => {
    const activeOrgId = ctx.session.activeOrganizationId

    if (!activeOrgId) {
      return { user: ctx.user, activeOrganization: null, membership: null }
    }

    const [activeOrganization] = await ctx.db
      .select()
      .from(organization)
      .where(eq(organization.id, activeOrgId))
      .limit(1)

    const [membership] = await ctx.db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, activeOrgId),
          eq(member.userId, ctx.user.id)
        )
      )
      .limit(1)

    return {
      user: ctx.user,
      activeOrganization: activeOrganization ?? null,
      membership: membership ?? null,
    }
  }),

  // myOrgs - all organizations user belongs to
  myOrgs: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        organization: organization,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, ctx.user.id))
  }),

  // createOrg - create organization (user becomes owner)
  createOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
        timezone: z.string().optional(),
        defaultJoinMode: z.enum(["open", "invite", "approval"]).default("invite"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const org = await auth.api.createOrganization({
        body: {
          name: input.name,
          slug: input.slug,
          timezone: input.timezone,
          defaultJoinMode: input.defaultJoinMode,
        },
        headers: ctx.headers,
      })
      return org
    }),
})

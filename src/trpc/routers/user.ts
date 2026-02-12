import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { router, publicProcedure, protectedProcedure } from "@/trpc"
import { getPublicUserById, getUserByUsername, updateUser } from "@/data-access/users"
import { updateProfileSchema, usernameSchema } from "@/schemas/user"
import { organization, member, invitation } from "@/db/auth-schema"
import { organizationSettings } from "@/db/schema"
import { auth } from "@/auth"
import { NotFoundError, BadRequestError } from "@/exceptions"
import { SUPPORTED_CURRENCIES } from "@/schemas/organization-settings"
import { setOrganizationInterests } from "@/data-access/interests"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getPublicUserById(input.id)
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

  // checkUsernameAvailable - check if a username is available
  checkUsernameAvailable: publicProcedure
    .input(z.object({ username: usernameSchema }))
    .query(async ({ input }) => {
      const existing = await getUserByUsername(input.username)
      return { available: !existing }
    }),

  // createOrg - create organization (user becomes owner)
  createOrg: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
        timezone: z.string().optional(),
        defaultJoinMode: z.enum(["open", "invite", "approval"]).default("invite"),
        currency: z.enum(SUPPORTED_CURRENCIES).nullable().optional(),
        interestIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const username = ctx.user.username

      // Generate internal slug as {username}-{userSlug}
      const internalSlug = `${username}-${input.slug}`

      const org = await auth.api.createOrganization({
        body: {
          name: input.name,
          slug: internalSlug,
          timezone: input.timezone,
          defaultJoinMode: input.defaultJoinMode,
          userSlug: input.slug,
          ownerUsername: username,
        },
        headers: ctx.headers,
      })

      if (!org?.id) {
        throw new BadRequestError("Failed to create organization")
      }

      // Create organization settings with currency if provided
      if (input.currency) {
        await ctx.db.insert(organizationSettings).values({
          organizationId: org.id,
          currency: input.currency,
          joinFormSchema: null,
          joinFormVersion: 1,
        })
      }

      // Save organization interests if provided
      if (input.interestIds && input.interestIds.length > 0) {
        await setOrganizationInterests(org.id, input.interestIds)
      }

      return org
    }),

  // listMyInvitations - invitations received by the user
  listMyInvitations: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        invitation: invitation,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          userSlug: organization.userSlug,
          ownerUsername: organization.ownerUsername,
          logo: organization.logo,
        },
      })
      .from(invitation)
      .innerJoin(organization, eq(invitation.organizationId, organization.id))
      .where(
        and(
          eq(invitation.email, ctx.user.email),
          eq(invitation.status, "pending")
        )
      )
  }),

  // acceptInvitation - accept an invitation to join an org
  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get the invitation
      const [inv] = await ctx.db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1)

      if (!inv) {
        throw new NotFoundError("Invitation not found")
      }

      // Verify it's for this user
      if (inv.email !== ctx.user.email) {
        throw new NotFoundError("Invitation not found")
      }

      if (inv.status !== "pending") {
        throw new BadRequestError("Invitation is no longer valid")
      }

      // Check if expired
      if (inv.expiresAt < new Date()) {
        throw new BadRequestError("Invitation has expired")
      }

      // Accept via Better Auth
      await auth.api.acceptInvitation({
        body: {
          invitationId: input.invitationId,
        },
        headers: ctx.headers,
      })

      return { success: true }
    }),

  // rejectInvitation - reject an invitation
  rejectInvitation: protectedProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get the invitation
      const [inv] = await ctx.db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1)

      if (!inv) {
        throw new NotFoundError("Invitation not found")
      }

      // Verify it's for this user
      if (inv.email !== ctx.user.email) {
        throw new NotFoundError("Invitation not found")
      }

      if (inv.status !== "pending") {
        throw new BadRequestError("Invitation is no longer valid")
      }

      // Reject via Better Auth
      await auth.api.rejectInvitation({
        body: {
          invitationId: input.invitationId,
        },
        headers: ctx.headers,
      })

      return { success: true }
    }),
})

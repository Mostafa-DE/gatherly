import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure, orgProcedure } from "@/trpc"
import { completeOnboardingSchema, saveInterestsSchema } from "@/schemas/onboarding"
import { createId } from "@paralleldrive/cuid2"
import { member, organization, session, user } from "@/db/auth-schema"
import { organizationSettings, activity, activityMember } from "@/db/schema"
import {
  getAllInterestsGrouped,
  getUserInterests,
  setUserInterests,
  getOrganizationInterests,
  setOrganizationInterests,
} from "@/data-access/interests"
import { z } from "zod"

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export const onboardingRouter = router({
  getInterests: publicProcedure.query(async () => {
    return getAllInterestsGrouped()
  }),

  complete: protectedProcedure
    .input(completeOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const organizationId = await ctx.db.transaction(async (tx) => {
          // 1. Update user profile
          await tx
            .update(user)
            .set({
              country: input.country,
              city: input.city,
              timezone: input.timezone,
              onboardingCompleted: true,
              updatedAt: new Date(),
            })
            .where(eq(user.id, ctx.user.id))

          // 2. Auto-create default group + activity
          const username = ctx.user.username
          const groupName = `${ctx.user.name}'s Group`
          const userSlug = slugify(groupName.replace(/'s\b/g, ""))
          const internalSlug = `${username}-${userSlug}`
          const orgId = createId()

          await tx.insert(organization).values({
            id: orgId,
            name: groupName,
            slug: internalSlug,
            userSlug,
            ownerUsername: username,
            defaultJoinMode: "open",
            createdAt: new Date(),
          })

          await tx.insert(member).values({
            id: createId(),
            organizationId: orgId,
            userId: ctx.user.id,
            role: "owner",
            createdAt: new Date(),
          })

          // 3. Create organization settings
          await tx.insert(organizationSettings).values({
            organizationId: orgId,
            joinFormSchema: null,
            joinFormVersion: 1,
          })

          // 4. Create default "General" activity
          const [generalActivity] = await tx
            .insert(activity)
            .values({
              organizationId: orgId,
              name: "General",
              slug: "general",
              joinMode: "open",
              createdBy: ctx.user.id,
            })
            .returning()

          // 5. Add user as active member of the General activity
          await tx.insert(activityMember).values({
            activityId: generalActivity.id,
            userId: ctx.user.id,
            status: "active",
          })

          // 6. Set as active organization for current session
          await tx
            .update(session)
            .set({ activeOrganizationId: orgId })
            .where(eq(session.id, ctx.session.id))

          return orgId
        })

        return { success: true, organizationId }
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to complete onboarding",
        })
      }
    }),

  saveInterests: protectedProcedure
    .input(saveInterestsSchema)
    .mutation(async ({ ctx, input }) => {
      await setUserInterests(ctx.user.id, input.interestIds)
      return { success: true }
    }),

  getUserInterests: protectedProcedure.query(async ({ ctx }) => {
    return getUserInterests(ctx.user.id)
  }),

  getOrganizationInterests: orgProcedure
    .query(async ({ ctx }) => {
      return getOrganizationInterests(ctx.activeOrganization.id)
    }),

  setOrganizationInterests: orgProcedure
    .input(z.object({ interestIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can update interests" })
      }
      await setOrganizationInterests(ctx.activeOrganization.id, input.interestIds)
      return { success: true }
    }),
})

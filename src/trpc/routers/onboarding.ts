import { eq } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure, orgProcedure } from "@/trpc"
import { completeOnboardingSchema, saveInterestsSchema } from "@/schemas/onboarding"
import { user } from "@/db/auth-schema"
import {
  getAllInterestsGrouped,
  getUserInterests,
  setUserInterests,
  getOrganizationInterests,
  setOrganizationInterests,
} from "@/data-access/interests"
import { z } from "zod"

export const onboardingRouter = router({
  getInterests: publicProcedure.query(async () => {
    return getAllInterestsGrouped()
  }),

  complete: protectedProcedure
    .input(completeOnboardingSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({
          intent: input.intent,
          country: input.country,
          city: input.city,
          timezone: input.timezone,
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(user.id, ctx.user.id))

      return { success: true }
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

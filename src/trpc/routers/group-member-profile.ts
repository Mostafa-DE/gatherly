import { router, orgProcedure } from "@/trpc"
import { ForbiddenError } from "@/exceptions"
import {
  getProfileByOrgAndUser,
  upsertProfile,
  getUserProfile,
} from "@/data-access/group-member-profiles"
import { getOrgSettings } from "@/data-access/organization-settings"
import { getEngagementStats } from "@/data-access/engagement-stats"
import {
  getMyProfileSchema,
  updateMyProfileSchema,
  submitJoinFormSchema,
  getUserProfileSchema,
} from "@/schemas/group-member-profile"
import { validateAndUpsertGroupMemberProfile } from "@/use-cases/group-member-profile"
import { z } from "zod"

// =============================================================================
// Helper: Check if user is admin (owner role)
// =============================================================================

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization owners and admins can perform this action")
  }
}

// =============================================================================
// Group Member Profile Router
// =============================================================================

export const groupMemberProfileRouter = router({
  /**
   * Get own profile for the organization (Self)
   */
  myProfile: orgProcedure
    .input(getMyProfileSchema)
    .query(async ({ ctx }) => {
      return getProfileByOrgAndUser(ctx.activeOrganization.id, ctx.user.id)
    }),

  /**
   * Update own profile (Self)
   */
  updateMyProfile: orgProcedure
    .input(updateMyProfileSchema)
    .mutation(async ({ ctx, input }) => {
      return validateAndUpsertGroupMemberProfile(
        {
          getOrgSettings,
          upsertProfile,
        },
        {
          organizationId: ctx.activeOrganization.id,
          userId: ctx.user.id,
          answers: input.answers,
          nickname: input.nickname,
        }
      )
    }),

  /**
   * Submit join form for the organization (Self)
   * Creates profile if doesn't exist, updates if it does
   */
  submitJoinForm: orgProcedure
    .input(submitJoinFormSchema)
    .mutation(async ({ ctx, input }) => {
      return validateAndUpsertGroupMemberProfile(
        {
          getOrgSettings,
          upsertProfile,
        },
        {
          organizationId: ctx.activeOrganization.id,
          userId: ctx.user.id,
          answers: input.answers,
        }
      )
    }),

  /**
   * Get a user's profile (Admin)
   */
  getUserProfile: orgProcedure
    .input(getUserProfileSchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getUserProfile(ctx.activeOrganization.id, input.userId)
    }),

  /**
   * Get own engagement stats (Self)
   */
  myStats: orgProcedure.query(async ({ ctx }) => {
    return getEngagementStats(ctx.user.id, ctx.activeOrganization.id)
  }),

  /**
   * Get a user's engagement stats (Admin)
   */
  getUserStats: orgProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getEngagementStats(input.userId, ctx.activeOrganization.id)
    }),
})

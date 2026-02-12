import { router, orgProcedure } from "@/trpc"
import { ForbiddenError, NotFoundError, BadRequestError } from "@/exceptions"
import { withOrgScope } from "@/data-access/org-scope"
import { parseJoinFormSchema, validateJoinFormAnswers } from "@/use-cases/form-validation"
import {
  joinSession,
  cancelParticipation,
  getMyParticipation,
  getMyHistory,
  getSessionParticipants,
  updateParticipation,
  bulkUpdateAttendance,
  bulkUpdatePayment,
  getUserHistory,
  getWaitlistPosition,
  adminAddParticipant,
  moveParticipant,
  approvePendingParticipation,
  rejectPendingParticipation,
  getPendingApprovalsSummary,
} from "@/data-access/participations"
import {
  joinSessionSchema,
  cancelParticipationSchema,
  getMyParticipationSchema,
  getMyHistorySchema,
  getParticipantsSchema,
  updateParticipationSchema,
  bulkUpdateAttendanceSchema,
  bulkUpdatePaymentSchema,
  getUserHistorySchema,
  adminAddParticipantSchema,
  moveParticipantSchema,
  approvePendingParticipationSchema,
  rejectPendingParticipationSchema,
  pendingApprovalsSummarySchema,
} from "@/schemas/participation"
import { getUserByEmailOrPhone } from "@/data-access/users"
import { getOrganizationMemberByUserId } from "@/data-access/organizations"

// =============================================================================
// Helper: Check if user is owner or admin
// =============================================================================

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization owners and admins can perform this action")
  }
}

// =============================================================================
// Participation Router
// =============================================================================

export const participationRouter = router({
  /**
   * Join a session (Member)
   * Idempotent: if already joined/waitlisted, returns existing participation
   */
  join: orgProcedure
    .input(joinSessionSchema)
    .mutation(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const session = await scope.requireSession(input.sessionId)
        const formSchema = parseJoinFormSchema(session.joinFormSchema)

        if (formSchema && formSchema.fields.length > 0) {
          if (!input.formAnswers) {
            throw new BadRequestError("This session requires a join form to be filled out")
          }
          validateJoinFormAnswers(formSchema, input.formAnswers)
        }

        return joinSession(input.sessionId, ctx.user.id, input.formAnswers)
      })
    }),

  /**
   * Cancel own participation (Self)
   * Triggers auto-promote if was joined
   */
  cancel: orgProcedure
    .input(cancelParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireUserParticipation(input.participationId, ctx.user.id)
        return cancelParticipation(input.participationId, ctx.user.id)
      })
    }),

  /**
   * Get own participation for a session (Self)
   */
  myParticipation: orgProcedure
    .input(getMyParticipationSchema)
    .query(async ({ ctx, input }) => {
      const participation = await withOrgScope(
        ctx.activeOrganization.id,
        async (scope) => {
          await scope.requireSession(input.sessionId)
          return getMyParticipation(input.sessionId, ctx.user.id)
        }
      )

      if (participation?.status === "waitlisted") {
        const position = await getWaitlistPosition(
          input.sessionId,
          ctx.user.id,
          participation.joinedAt,
          participation.id
        )
        return { ...participation, waitlistPosition: position }
      }

      return participation
    }),

  /**
   * Get own participation history in the organization (Self)
   */
  myHistory: orgProcedure
    .input(getMyHistorySchema)
    .query(async ({ ctx, input }) => {
      return getMyHistory(ctx.activeOrganization.id, ctx.user.id, input)
    }),

  /**
   * Get participants for a session (All members can view participants)
   */
  participants: orgProcedure
    .input(getParticipantsSchema)
    .query(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSession(input.sessionId)
        return getSessionParticipants(input.sessionId, input)
      })
    }),

  /**
   * Update participation attendance/payment (Admin)
   */
  update: orgProcedure
    .input(updateParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireParticipationForMutation(input.participationId)
        const { participationId, ...data } = input
        return updateParticipation(participationId, data)
      })
    }),

  /**
   * Bulk update attendance for multiple participations (Admin)
   */
  bulkUpdateAttendance: orgProcedure
    .input(bulkUpdateAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSession(input.sessionId)
        const count = await bulkUpdateAttendance(input.sessionId, input.updates)
        return { success: true, count }
      })
    }),

  /**
   * Bulk update payment for multiple participations (Admin)
   */
  bulkUpdatePayment: orgProcedure
    .input(bulkUpdatePaymentSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSession(input.sessionId)
        const count = await bulkUpdatePayment(input.sessionId, input.updates)
        return { success: true, count }
      })
    }),

  /**
   * Get user's participation history (Admin)
   */
  userHistory: orgProcedure
    .input(getUserHistorySchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getUserHistory(ctx.activeOrganization.id, input.userId, input)
    }),

  /**
   * Admin add participant by email or phone (Admin)
   * Bypasses join_mode restrictions. User must be an org member.
   */
  adminAdd: orgProcedure
    .input(adminAddParticipantSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Look up user by email or phone
      const targetUser = await getUserByEmailOrPhone(input.identifier)
      if (!targetUser) {
        throw new NotFoundError("No user found with that email or phone")
      }

      // Verify user is an org member
      const membership = await getOrganizationMemberByUserId(
        ctx.activeOrganization.id,
        targetUser.id
      )
      if (!membership) {
        throw new ForbiddenError("User is not a member of this organization")
      }

      // Verify session is in this org
      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSession(input.sessionId)
      })

      return adminAddParticipant(input.sessionId, targetUser.id)
    }),

  /**
   * Move participant to another session (Admin)
   * Both sessions must be in the same organization.
   * Does NOT auto-promote on source session.
   */
  move: orgProcedure
    .input(moveParticipantSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Verify source participation is in this org
      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireParticipationForMutation(input.participationId)
        await scope.requireSession(input.targetSessionId)
      })

      return moveParticipant(input.participationId, input.targetSessionId)
    }),

  /**
   * Approve pending participation request (Admin)
   */
  approvePending: orgProcedure
    .input(approvePendingParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireParticipationForMutation(input.participationId)
      })

      return approvePendingParticipation(input.participationId)
    }),

  /**
   * Reject pending participation request (Admin)
   */
  rejectPending: orgProcedure
    .input(rejectPendingParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireParticipationForMutation(input.participationId)
      })

      return rejectPendingParticipation(input.participationId)
    }),

  /**
   * Summary of pending session approvals across organization (Admin)
   */
  pendingApprovalsSummary: orgProcedure
    .input(pendingApprovalsSummarySchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return getPendingApprovalsSummary(ctx.activeOrganization.id, input)
    }),
})

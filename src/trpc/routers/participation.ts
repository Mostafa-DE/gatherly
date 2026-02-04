import { router, orgProcedure } from "@/trpc";
import { ForbiddenError } from "@/exceptions";
import { withOrgScope } from "@/data-access/org-scope";
import {
  joinSession,
  cancelParticipation,
  getMyParticipation,
  getMyHistory,
  getSessionRoster,
  updateParticipation,
  bulkUpdateAttendance,
  getUserHistory,
  getWaitlistPosition,
} from "@/data-access/participations";
import {
  joinSessionSchema,
  cancelParticipationSchema,
  getMyParticipationSchema,
  getMyHistorySchema,
  getRosterSchema,
  updateParticipationSchema,
  bulkUpdateAttendanceSchema,
  getUserHistorySchema,
} from "@/schemas/participation";

// =============================================================================
// Helper: Check if user is owner
// =============================================================================

function assertOwner(role: string): void {
  if (role !== "owner") {
    throw new ForbiddenError("Only organization owners can perform this action");
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
        await scope.requireSession(input.sessionId);
        return joinSession(input.sessionId, ctx.user.id);
      });
    }),

  /**
   * Cancel own participation (Self)
   * Triggers auto-promote if was joined
   */
  cancel: orgProcedure
    .input(cancelParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireUserParticipation(input.participationId, ctx.user.id);
        return cancelParticipation(input.participationId, ctx.user.id);
      });
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
          await scope.requireSession(input.sessionId);
          return getMyParticipation(input.sessionId, ctx.user.id);
        }
      );

      if (participation?.status === "waitlisted") {
        const position = await getWaitlistPosition(
          input.sessionId,
          ctx.user.id,
          participation.joinedAt,
          participation.id
        );
        return { ...participation, waitlistPosition: position };
      }

      return participation;
    }),

  /**
   * Get own participation history in the organization (Self)
   */
  myHistory: orgProcedure
    .input(getMyHistorySchema)
    .query(async ({ ctx, input }) => {
      return getMyHistory(ctx.activeOrganization.id, ctx.user.id, input);
    }),

  /**
   * Get full roster for a session (Admin)
   */
  roster: orgProcedure
    .input(getRosterSchema)
    .query(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSession(input.sessionId);
        return getSessionRoster(input.sessionId, input);
      });
    }),

  /**
   * Update participation attendance/payment (Admin)
   */
  update: orgProcedure
    .input(updateParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireParticipationForMutation(input.participationId);
        const { participationId, ...data } = input;
        return updateParticipation(participationId, data);
      });
    }),

  /**
   * Bulk update attendance for multiple participations (Admin)
   */
  bulkUpdateAttendance: orgProcedure
    .input(bulkUpdateAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSession(input.sessionId);
        const count = await bulkUpdateAttendance(input.sessionId, input.updates);
        return { success: true, count };
      });
    }),

  /**
   * Get user's participation history (Admin)
   */
  userHistory: orgProcedure
    .input(getUserHistorySchema)
    .query(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);
      return getUserHistory(ctx.activeOrganization.id, input.userId, input);
    }),
});

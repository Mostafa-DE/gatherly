import { router, orgProcedure } from "@/trpc";
import { ForbiddenError, NotFoundError } from "@/exceptions";
import { getSessionById } from "@/data-access/sessions";
import {
  joinSession,
  cancelParticipation,
  getMyParticipation,
  getMyHistory,
  getSessionRoster,
  updateParticipation,
  bulkUpdateAttendance,
  getUserHistory,
  getParticipationById,
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
// Helper: Check if user is admin (owner role)
// =============================================================================

function assertAdmin(role: string): void {
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
      // Verify session belongs to this organization
      const session = await getSessionById(input.sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new NotFoundError("Session not found");
      }

      return joinSession(input.sessionId, ctx.user.id);
    }),

  /**
   * Cancel own participation (Self)
   * Triggers auto-promote if was joined
   */
  cancel: orgProcedure
    .input(cancelParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      // The cancelParticipation function verifies ownership
      return cancelParticipation(input.participationId, ctx.user.id);
    }),

  /**
   * Get own participation for a session (Self)
   */
  myParticipation: orgProcedure
    .input(getMyParticipationSchema)
    .query(async ({ ctx, input }) => {
      // Verify session belongs to this organization
      const session = await getSessionById(input.sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new NotFoundError("Session not found");
      }

      const participation = await getMyParticipation(input.sessionId, ctx.user.id);

      // If waitlisted, include position
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
      assertAdmin(ctx.membership.role);

      // Verify session belongs to this organization
      const session = await getSessionById(input.sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new NotFoundError("Session not found");
      }

      return getSessionRoster(input.sessionId, input);
    }),

  /**
   * Update participation attendance/payment (Admin)
   */
  update: orgProcedure
    .input(updateParticipationSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);

      // Verify participation belongs to a session in this organization
      const participation = await getParticipationById(input.participationId);
      if (!participation) {
        throw new NotFoundError("Participation not found");
      }

      const session = await getSessionById(participation.sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new ForbiddenError("Participation not found in this organization");
      }

      const { participationId, ...data } = input;
      return updateParticipation(participationId, data);
    }),

  /**
   * Bulk update attendance for multiple participations (Admin)
   */
  bulkUpdateAttendance: orgProcedure
    .input(bulkUpdateAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);

      // Verify session belongs to this organization
      const session = await getSessionById(input.sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new NotFoundError("Session not found");
      }

      await bulkUpdateAttendance(input.updates);
      return { success: true, count: input.updates.length };
    }),

  /**
   * Get user's participation history (Admin)
   */
  userHistory: orgProcedure
    .input(getUserHistorySchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);
      return getUserHistory(ctx.activeOrganization.id, input.userId, input);
    }),
});

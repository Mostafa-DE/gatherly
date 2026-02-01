import { router, orgProcedure } from "@/trpc";
import { ForbiddenError } from "@/exceptions";
import {
  createSession,
  updateSession,
  updateSessionStatus,
  softDeleteSession,
  getSessionById,
  getSessionWithCounts,
  listSessions,
  listUpcomingSessions,
  listPastSessions,
} from "@/data-access/sessions";
import {
  createSessionSchema,
  updateSessionSchema,
  updateSessionStatusSchema,
  getSessionByIdSchema,
  listSessionsSchema,
  listUpcomingSessionsSchema,
  listPastSessionsSchema,
} from "@/schemas/session";

// =============================================================================
// Helper: Check if user is admin (owner role)
// =============================================================================

function assertAdmin(role: string): void {
  if (role !== "owner") {
    throw new ForbiddenError("Only organization owners can perform this action");
  }
}

// =============================================================================
// Session Router
// =============================================================================

export const sessionRouter = router({
  /**
   * Create a new session (Admin only)
   * Session starts in 'draft' status
   */
  create: orgProcedure
    .input(createSessionSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);
      return createSession(
        ctx.activeOrganization.id,
        ctx.user.id,
        input
      );
    }),

  /**
   * Update session details (Admin only)
   * Cannot modify completed or cancelled sessions
   */
  update: orgProcedure
    .input(updateSessionSchema.extend({ sessionId: getSessionByIdSchema.shape.sessionId }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);
      const { sessionId, ...data } = input;

      // Verify session belongs to this organization
      const session = await getSessionById(sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new ForbiddenError("Session not found in this organization");
      }

      return updateSession(sessionId, data);
    }),

  /**
   * Get session by ID (Member)
   */
  getById: orgProcedure
    .input(getSessionByIdSchema)
    .query(async ({ ctx, input }) => {
      const session = await getSessionById(input.sessionId);

      // Verify session belongs to this organization
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        return null;
      }

      return session;
    }),

  /**
   * Get session with participant counts (Member)
   */
  getWithCounts: orgProcedure
    .input(getSessionByIdSchema)
    .query(async ({ ctx, input }) => {
      const session = await getSessionWithCounts(input.sessionId);

      // Verify session belongs to this organization
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        return null;
      }

      return session;
    }),

  /**
   * List sessions for organization (Member)
   * Excludes soft-deleted by default
   */
  list: orgProcedure
    .input(listSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listSessions(ctx.activeOrganization.id, input);
    }),

  /**
   * List upcoming sessions (Member)
   * Sessions where dateTime > now AND status = published
   */
  listUpcoming: orgProcedure
    .input(listUpcomingSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listUpcomingSessions(ctx.activeOrganization.id, input);
    }),

  /**
   * List past sessions (Member)
   * Sessions where dateTime < now OR status IN (completed, cancelled)
   */
  listPast: orgProcedure
    .input(listPastSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listPastSessions(ctx.activeOrganization.id, input);
    }),

  /**
   * Update session status (Admin only)
   * Uses state machine to validate transitions
   */
  updateStatus: orgProcedure
    .input(updateSessionStatusSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);

      // Verify session belongs to this organization
      const session = await getSessionById(input.sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new ForbiddenError("Session not found in this organization");
      }

      return updateSessionStatus(input.sessionId, input.status);
    }),

  /**
   * Soft delete session (Admin only)
   * Sets deletedAt, preserves data
   */
  delete: orgProcedure
    .input(getSessionByIdSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);

      // Verify session belongs to this organization
      const session = await getSessionById(input.sessionId);
      if (!session || session.organizationId !== ctx.activeOrganization.id) {
        throw new ForbiddenError("Session not found in this organization");
      }

      return softDeleteSession(input.sessionId);
    }),
});

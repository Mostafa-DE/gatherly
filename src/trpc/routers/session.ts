import { router, orgProcedure } from "@/trpc";
import { ForbiddenError } from "@/exceptions";
import {
  createSession,
  updateSession,
  updateSessionStatus,
  softDeleteSession,
  getSessionWithCounts,
  listSessions,
  listUpcomingSessions,
  listDraftSessionsWithCounts,
  listPastSessions,
  listUpcomingSessionsWithCounts,
  listPastSessionsWithCounts,
} from "@/data-access/sessions";
import { withOrgScope } from "@/data-access/org-scope";
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
// Helper: Check if user is owner
// =============================================================================

function assertOwner(role: string): void {
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
      assertOwner(ctx.membership.role);
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
      assertOwner(ctx.membership.role);
      const { sessionId, ...data } = input;

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSessionForMutation(sessionId);
        return updateSession(sessionId, data);
      });
    }),

  /**
   * Get session by ID (Member)
   */
  getById: orgProcedure
    .input(getSessionByIdSchema)
    .query(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        return scope.getSessionById(input.sessionId);
      });
    }),

  /**
   * Get session with participant counts (Member)
   */
  getWithCounts: orgProcedure
    .input(getSessionByIdSchema)
    .query(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const session = await scope.getSessionById(input.sessionId);
        if (!session) {
          return null;
        }

        return getSessionWithCounts(input.sessionId);
      });
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
   * List upcoming sessions with participant counts and preview (Member)
   */
  listUpcomingWithCounts: orgProcedure
    .input(listUpcomingSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listUpcomingSessionsWithCounts(ctx.activeOrganization.id, input);
    }),

  /**
   * List draft sessions with participant counts and preview (Owner only)
   */
  listDraftsWithCounts: orgProcedure
    .input(listUpcomingSessionsSchema)
    .query(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);
      return listDraftSessionsWithCounts(ctx.activeOrganization.id, input);
    }),

  /**
   * List past sessions with participant counts and preview (Member)
   */
  listPastWithCounts: orgProcedure
    .input(listPastSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listPastSessionsWithCounts(ctx.activeOrganization.id, input);
    }),

  /**
   * Update session status (Admin only)
   * Uses state machine to validate transitions
   */
  updateStatus: orgProcedure
    .input(updateSessionStatusSchema)
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSessionForMutation(input.sessionId);
        return updateSessionStatus(input.sessionId, input.status);
      });
    }),

  /**
   * Soft delete session (Admin only)
   * Sets deletedAt, preserves data
   */
  delete: orgProcedure
    .input(getSessionByIdSchema)
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSessionForMutation(input.sessionId);
        return softDeleteSession(input.sessionId);
      });
    }),
});

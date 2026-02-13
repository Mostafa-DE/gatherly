import { router, orgProcedure } from "@/trpc"
import { ForbiddenError } from "@/exceptions"
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
} from "@/data-access/sessions"
import { listUserActivityMemberships } from "@/data-access/activity-members"
import { withOrgScope } from "@/data-access/org-scope"
import {
  createSessionSchema,
  updateSessionSchema,
  updateSessionStatusSchema,
  getSessionByIdSchema,
  listSessionsSchema,
  listUpcomingSessionsSchema,
  listPastSessionsSchema,
} from "@/schemas/session"

// =============================================================================
// Helper: Check if user is admin (owner or admin role)
// =============================================================================

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action")
  }
}

function isAdmin(role: string): boolean {
  return role === "owner" || role === "admin"
}

/** Get activity IDs the user belongs to (for non-admin session filtering) */
async function getUserActivityIds(userId: string, organizationId: string): Promise<string[]> {
  const memberships = await listUserActivityMemberships(userId, organizationId)
  return memberships.map((m) => m.activity.id)
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
      assertAdmin(ctx.membership.role)

      // Validate activity belongs to this org and is active
      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const act = await scope.requireActivityForMutation(input.activityId)
        if (!act.isActive) {
          throw new ForbiddenError("Cannot create sessions for a deactivated activity")
        }
      })

      return createSession(
        ctx.activeOrganization.id,
        ctx.user.id,
        input
      )
    }),

  /**
   * Update session details (Admin only)
   * Cannot modify completed or cancelled sessions
   */
  update: orgProcedure
    .input(updateSessionSchema.extend({ sessionId: getSessionByIdSchema.shape.sessionId }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const { sessionId, ...data } = input

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSessionForMutation(sessionId)
        return updateSession(sessionId, data)
      })
    }),

  /**
   * Get session by ID (Member)
   */
  getById: orgProcedure
    .input(getSessionByIdSchema)
    .query(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        return scope.getSessionById(input.sessionId)
      })
    }),

  /**
   * Get session with participant counts (Member)
   */
  getWithCounts: orgProcedure
    .input(getSessionByIdSchema)
    .query(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const session = await scope.getSessionById(input.sessionId)
        if (!session) {
          return null
        }

        return getSessionWithCounts(input.sessionId)
      })
    }),

  /**
   * List sessions for organization (Member)
   * Excludes soft-deleted by default
   */
  list: orgProcedure
    .input(listSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listSessions(ctx.activeOrganization.id, input)
    }),

  /**
   * List upcoming sessions (Member)
   * Sessions where dateTime > now AND status = published
   */
  listUpcoming: orgProcedure
    .input(listUpcomingSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listUpcomingSessions(ctx.activeOrganization.id, input)
    }),

  /**
   * List past sessions (Member)
   * Sessions where dateTime < now OR status IN (completed, cancelled)
   */
  listPast: orgProcedure
    .input(listPastSessionsSchema)
    .query(async ({ ctx, input }) => {
      return listPastSessions(ctx.activeOrganization.id, input)
    }),

  /**
   * List upcoming sessions with participant counts and preview (Member)
   * Non-admins only see sessions for activities they belong to
   */
  listUpcomingWithCounts: orgProcedure
    .input(listUpcomingSessionsSchema)
    .query(async ({ ctx, input }) => {
      const activityIds = isAdmin(ctx.membership.role)
        ? undefined
        : await getUserActivityIds(ctx.user.id, ctx.activeOrganization.id)
      return listUpcomingSessionsWithCounts(ctx.activeOrganization.id, { ...input, activityIds })
    }),

  /**
   * List draft sessions with participant counts and preview (Admin only)
   */
  listDraftsWithCounts: orgProcedure
    .input(listUpcomingSessionsSchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return listDraftSessionsWithCounts(ctx.activeOrganization.id, input)
    }),

  /**
   * List past sessions with participant counts and preview (Member)
   * Non-admins only see sessions for activities they belong to
   */
  listPastWithCounts: orgProcedure
    .input(listPastSessionsSchema)
    .query(async ({ ctx, input }) => {
      const activityIds = isAdmin(ctx.membership.role)
        ? undefined
        : await getUserActivityIds(ctx.user.id, ctx.activeOrganization.id)
      return listPastSessionsWithCounts(ctx.activeOrganization.id, { ...input, activityIds })
    }),

  /**
   * Update session status (Admin only)
   * Uses state machine to validate transitions
   */
  updateStatus: orgProcedure
    .input(updateSessionStatusSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSessionForMutation(input.sessionId)
        return updateSessionStatus(input.sessionId, input.status)
      })
    }),

  /**
   * Soft delete session (Admin only)
   * Sets deletedAt, preserves data
   */
  delete: orgProcedure
    .input(getSessionByIdSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireSessionForMutation(input.sessionId)
        return softDeleteSession(input.sessionId)
      })
    }),
})

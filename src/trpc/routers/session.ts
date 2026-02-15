import { TRPCError } from "@trpc/server"
import { router, orgProcedure } from "@/trpc"
import { ForbiddenError } from "@/exceptions"
import { getDomain } from "@/plugins/ranking/domains"
import { getRankingDefinitionByActivity } from "@/plugins/ranking/data-access/ranking-definitions"
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
import { findParticipantConflictsForNewTime } from "@/data-access/participations"
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

/** Validate capacity constraints for match-mode ranking domains */
async function validateMatchModeCapacity(
  activityId: string,
  organizationId: string,
  maxCapacity: number
): Promise<void> {
  const definition = await getRankingDefinitionByActivity(activityId, organizationId)
  if (!definition) return

  const domain = getDomain(definition.domainId)
  if (!domain?.sessionConfig || domain.sessionConfig.mode !== "match" || !domain.matchConfig) {
    return
  }

  // Check capacity matches a valid format
  const isValid = Object.values(domain.matchConfig.formatRules).some((rule) => {
    if (rule.playersPerTeam) {
      return rule.playersPerTeam * 2 === maxCapacity
    }
    if (rule.minPlayersPerTeam != null && rule.maxPlayersPerTeam != null) {
      return maxCapacity >= rule.minPlayersPerTeam * 2 && maxCapacity <= rule.maxPlayersPerTeam * 2
    }
    return false
  })
  if (!isValid) {
    const allowed = Object.entries(domain.matchConfig.formatRules)
      .map(([format, rule]) => {
        if (rule.playersPerTeam) return `${format} (${rule.playersPerTeam * 2})`
        return `${format} (${(rule.minPlayersPerTeam ?? 1) * 2}-${(rule.maxPlayersPerTeam ?? 99) * 2})`
      })
      .join(", ")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid capacity for ${domain.name} match session. Valid capacities: ${allowed}`,
    })
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
      assertAdmin(ctx.membership.role)

      // Validate activity belongs to this org and is active
      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const act = await scope.requireActivityForMutation(input.activityId)
        if (!act.isActive) {
          throw new ForbiddenError("Cannot create sessions for a deactivated activity")
        }
      })

      // Validate capacity for match-mode domains
      await validateMatchModeCapacity(
        input.activityId,
        ctx.activeOrganization.id,
        input.maxCapacity
      )

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
        const session = await scope.requireSessionForMutation(sessionId)

        // Validate capacity for match-mode domains
        if (data.maxCapacity !== undefined) {
          await validateMatchModeCapacity(
            session.activityId,
            ctx.activeOrganization.id,
            data.maxCapacity
          )
        }

        // Validate dateTime change doesn't create conflicts for existing participants
        if (data.dateTime !== undefined) {
          const newDateTime = data.dateTime instanceof Date
            ? data.dateTime
            : new Date(data.dateTime)

          if (newDateTime.getTime() !== new Date(session.dateTime).getTime()) {
            const conflicts = await findParticipantConflictsForNewTime(sessionId, newDateTime)
            if (conflicts.length > 0) {
              const names = conflicts.map((c) => c.userName).join(", ")
              throw new TRPCError({
                code: "CONFLICT",
                message: `Cannot change session time: ${conflicts.length} participant(s) have conflicting sessions at that time (${names})`,
              })
            }
          }
        }

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

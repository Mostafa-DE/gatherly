import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { eventSession, participation, activity } from "@/db/schema"
import type { Activity } from "@/db/types"
import { NotFoundError } from "@/exceptions"

type OrgScope = {
  organizationId: string
  getSessionById: (sessionId: string) => Promise<typeof eventSession.$inferSelect | null>
  requireSession: (sessionId: string) => Promise<typeof eventSession.$inferSelect>
  requireSessionForMutation: (
    sessionId: string
  ) => Promise<typeof eventSession.$inferSelect>
  getParticipationById: (
    participationId: string
  ) => Promise<typeof participation.$inferSelect | null>
  requireParticipation: (
    participationId: string
  ) => Promise<typeof participation.$inferSelect>
  requireParticipationForMutation: (
    participationId: string
  ) => Promise<typeof participation.$inferSelect>
  requireUserParticipation: (
    participationId: string,
    userId: string
  ) => Promise<typeof participation.$inferSelect>
  getActivityById: (activityId: string) => Promise<Activity | null>
  requireActivity: (activityId: string) => Promise<Activity>
  requireActivityForMutation: (activityId: string) => Promise<Activity>
}

function createOrgScope(organizationId: string): OrgScope {
  const getSessionById = async (sessionId: string) => {
    const result = await db
      .select()
      .from(eventSession)
      .where(
        and(
          eq(eventSession.id, sessionId),
          eq(eventSession.organizationId, organizationId),
          isNull(eventSession.deletedAt)
        )
      )
      .limit(1)

    return result[0] ?? null
  }

  const requireSession = async (sessionId: string) => {
    const session = await getSessionById(sessionId)
    if (!session) {
      throw new NotFoundError("Session not found")
    }
    return session
  }

  const getSessionByIdAnyOrg = async (sessionId: string) => {
    const result = await db
      .select()
      .from(eventSession)
      .where(and(eq(eventSession.id, sessionId), isNull(eventSession.deletedAt)))
      .limit(1)

    return result[0] ?? null
  }

  const requireSessionForMutation = async (sessionId: string) => {
    const session = await getSessionByIdAnyOrg(sessionId)
    if (!session) {
      throw new NotFoundError("Session not found")
    }

    if (session.organizationId !== organizationId) {
      throw new NotFoundError("Session not found")
    }

    return session
  }

  const getParticipationById = async (participationId: string) => {
    const result = await db
      .select({ participation })
      .from(participation)
      .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
      .where(
        and(
          eq(participation.id, participationId),
          eq(eventSession.organizationId, organizationId),
          isNull(eventSession.deletedAt)
        )
      )
      .limit(1)

    return result[0]?.participation ?? null
  }

  const requireParticipation = async (participationId: string) => {
    const record = await getParticipationById(participationId)
    if (!record) {
      throw new NotFoundError("Participation not found")
    }
    return record
  }

  const getParticipationByIdAnyOrg = async (participationId: string) => {
    const result = await db
      .select({
        participation,
        organizationId: eventSession.organizationId,
      })
      .from(participation)
      .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
      .where(
        and(
          eq(participation.id, participationId),
          isNull(eventSession.deletedAt)
        )
      )
      .limit(1)

    return result[0] ?? null
  }

  const requireParticipationForMutation = async (participationId: string) => {
    const result = await getParticipationByIdAnyOrg(participationId)
    if (!result) {
      throw new NotFoundError("Participation not found")
    }

    if (result.organizationId !== organizationId) {
      throw new NotFoundError("Participation not found")
    }

    return result.participation
  }

  const requireUserParticipation = async (
    participationId: string,
    userId: string
  ) => {
    const result = await db
      .select({ participation })
      .from(participation)
      .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
      .where(
        and(
          eq(participation.id, participationId),
          eq(participation.userId, userId),
          eq(eventSession.organizationId, organizationId),
          isNull(eventSession.deletedAt)
        )
      )
      .limit(1)

    const record = result[0]?.participation ?? null
    if (!record) {
      throw new NotFoundError("Participation not found")
    }

    return record
  }

  const getActivityById = async (activityId: string) => {
    const result = await db
      .select()
      .from(activity)
      .where(
        and(
          eq(activity.id, activityId),
          eq(activity.organizationId, organizationId)
        )
      )
      .limit(1)

    return result[0] ?? null
  }

  const requireActivity = async (activityId: string) => {
    const act = await getActivityById(activityId)
    if (!act) {
      throw new NotFoundError("Activity not found")
    }
    return act
  }

  const getActivityByIdAnyOrg = async (activityId: string) => {
    const result = await db
      .select()
      .from(activity)
      .where(eq(activity.id, activityId))
      .limit(1)

    return result[0] ?? null
  }

  const requireActivityForMutation = async (activityId: string) => {
    const act = await getActivityByIdAnyOrg(activityId)
    if (!act) {
      throw new NotFoundError("Activity not found")
    }

    if (act.organizationId !== organizationId) {
      throw new NotFoundError("Activity not found")
    }

    return act
  }

  return {
    organizationId,
    getSessionById,
    requireSession,
    requireSessionForMutation,
    getParticipationById,
    requireParticipation,
    requireParticipationForMutation,
    requireUserParticipation,
    getActivityById,
    requireActivity,
    requireActivityForMutation,
  }
}

export async function withOrgScope<T>(
  organizationId: string,
  fn: (scope: OrgScope) => Promise<T>
): Promise<T> {
  return fn(createOrgScope(organizationId))
}

export async function withActivityScope<T>(
  organizationId: string,
  activityId: string,
  fn: (scope: OrgScope, act: Activity) => Promise<T>
): Promise<T> {
  const scope = createOrgScope(organizationId)
  const act = await scope.requireActivity(activityId)
  return fn(scope, act)
}

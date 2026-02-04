import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/db"
import { eventSession, participation } from "@/db/schema"
import { ForbiddenError, NotFoundError } from "@/exceptions"

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
      throw new ForbiddenError("Session not found in this organization")
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
      throw new ForbiddenError("Participation not found in this organization")
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

  return {
    organizationId,
    getSessionById,
    requireSession,
    requireSessionForMutation,
    getParticipationById,
    requireParticipation,
    requireParticipationForMutation,
    requireUserParticipation,
  }
}

export async function withOrgScope<T>(
  organizationId: string,
  fn: (scope: OrgScope) => Promise<T>
): Promise<T> {
  return fn(createOrgScope(organizationId))
}

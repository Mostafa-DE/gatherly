import { and, count, eq, gt, ilike, inArray, isNull, lt, or, sql, desc, asc, type SQL } from "drizzle-orm"
import { db } from "@/db"
import { eventSession, participation, activity } from "@/db/schema"
import type { EventSession } from "@/db/types"
import { NotFoundError, BadRequestError } from "@/exceptions"
import {
  assertSessionTransition,
  type SessionStatus,
} from "@/lib/sessions/state-machine"
import type {
  CreateSessionInput,
  UpdateSessionInput,
} from "@/schemas/session"

// =============================================================================
// Queries
// =============================================================================

export async function getSessionById(sessionId: string) {
  const result = await db
    .select()
    .from(eventSession)
    .where(and(eq(eventSession.id, sessionId), isNull(eventSession.deletedAt)))
    .limit(1)
  return result[0] ?? null
}

export async function getSessionByIdWithDeleted(sessionId: string) {
  const result = await db
    .select()
    .from(eventSession)
    .where(eq(eventSession.id, sessionId))
    .limit(1)
  return result[0] ?? null
}

export async function getSessionWithCounts(sessionId: string) {
  const session = await getSessionById(sessionId)
  if (!session) return null

  const [counts] = await db
    .select({
      joinedCount: count(
        sql`CASE WHEN ${participation.status} = 'joined' THEN 1 END`
      ),
      waitlistCount: count(
        sql`CASE WHEN ${participation.status} = 'waitlisted' THEN 1 END`
      ),
    })
    .from(participation)
    .where(eq(participation.sessionId, sessionId))

  return {
    ...session,
    joinedCount: counts?.joinedCount ?? 0,
    waitlistCount: counts?.waitlistCount ?? 0,
  }
}

export async function listSessions(
  organizationId: string,
  options: {
    limit: number
    offset: number
    status?: SessionStatus
    includeDeleted?: boolean
    activityId?: string
  }
) {
  const conditions = [eq(eventSession.organizationId, organizationId)]

  if (!options.includeDeleted) {
    conditions.push(isNull(eventSession.deletedAt))
  }

  if (options.status) {
    conditions.push(eq(eventSession.status, options.status))
  }

  if (options.activityId) {
    conditions.push(eq(eventSession.activityId, options.activityId))
  }

  return db
    .select()
    .from(eventSession)
    .where(and(...conditions))
    .orderBy(desc(eventSession.dateTime))
    .limit(options.limit)
    .offset(options.offset)
}

export async function listUpcomingSessions(
  organizationId: string,
  options: { limit: number; offset: number; activityId?: string }
) {
  const now = new Date()
  const conditions = [
    eq(eventSession.organizationId, organizationId),
    isNull(eventSession.deletedAt),
    eq(eventSession.status, "published"),
    gt(eventSession.dateTime, now),
  ]

  if (options.activityId) {
    conditions.push(eq(eventSession.activityId, options.activityId))
  }

  return db
    .select()
    .from(eventSession)
    .where(and(...conditions))
    .orderBy(asc(eventSession.dateTime))
    .limit(options.limit)
    .offset(options.offset)
}

export async function listUpcomingSessionsWithCounts(
  organizationId: string,
  options: { limit: number; offset: number; activityId?: string; activityIds?: string[]; search?: string }
) {
  if (options.activityIds?.length === 0) return []

  const now = new Date()
  const conditions = [
    eq(eventSession.organizationId, organizationId),
    isNull(eventSession.deletedAt),
    eq(eventSession.status, "published"),
    gt(eventSession.dateTime, now),
  ]

  if (options.activityId) {
    conditions.push(eq(eventSession.activityId, options.activityId))
  } else if (options.activityIds) {
    conditions.push(inArray(eventSession.activityId, options.activityIds))
  }

  if (options.search) {
    const pattern = `%${options.search}%`
    conditions.push(
      or(ilike(eventSession.title, pattern), ilike(eventSession.location, pattern))!
    )
  }

  return selectSessionsWithCounts(conditions, asc(eventSession.dateTime), options.limit, options.offset)
}

export async function listDraftSessionsWithCounts(
  organizationId: string,
  options: { limit: number; offset: number; activityId?: string; activityIds?: string[]; search?: string }
) {
  if (options.activityIds?.length === 0) return []

  const conditions = [
    eq(eventSession.organizationId, organizationId),
    isNull(eventSession.deletedAt),
    eq(eventSession.status, "draft"),
  ]

  if (options.activityId) {
    conditions.push(eq(eventSession.activityId, options.activityId))
  } else if (options.activityIds) {
    conditions.push(inArray(eventSession.activityId, options.activityIds))
  }

  if (options.search) {
    const pattern = `%${options.search}%`
    conditions.push(
      or(ilike(eventSession.title, pattern), ilike(eventSession.location, pattern))!
    )
  }

  return selectSessionsWithCounts(conditions, desc(eventSession.dateTime), options.limit, options.offset)
}

export async function listPastSessions(
  organizationId: string,
  options: { limit: number; offset: number; activityId?: string }
) {
  const now = new Date()
  const conditions = [
    eq(eventSession.organizationId, organizationId),
    isNull(eventSession.deletedAt),
    or(
      lt(eventSession.dateTime, now),
      eq(eventSession.status, "completed"),
      eq(eventSession.status, "cancelled")
    )!,
  ]

  if (options.activityId) {
    conditions.push(eq(eventSession.activityId, options.activityId))
  }

  return db
    .select()
    .from(eventSession)
    .where(and(...conditions))
    .orderBy(desc(eventSession.dateTime))
    .limit(options.limit)
    .offset(options.offset)
}

export async function listPastSessionsWithCounts(
  organizationId: string,
  options: { limit: number; offset: number; activityId?: string; activityIds?: string[]; search?: string }
) {
  if (options.activityIds?.length === 0) return []

  const now = new Date()
  const conditions = [
    eq(eventSession.organizationId, organizationId),
    isNull(eventSession.deletedAt),
    or(
      lt(eventSession.dateTime, now),
      eq(eventSession.status, "completed"),
      eq(eventSession.status, "cancelled")
    )!,
  ]

  if (options.activityId) {
    conditions.push(eq(eventSession.activityId, options.activityId))
  } else if (options.activityIds) {
    conditions.push(inArray(eventSession.activityId, options.activityIds))
  }

  if (options.search) {
    const pattern = `%${options.search}%`
    conditions.push(
      or(ilike(eventSession.title, pattern), ilike(eventSession.location, pattern))!
    )
  }

  return selectSessionsWithCounts(conditions, desc(eventSession.dateTime), options.limit, options.offset)
}

type ParticipantPreview = { id: string; name: string; image: string | null }

/**
 * Shared helper: selects sessions with counts and participant preview in a single query.
 * Uses db.$count() for counts and a correlated subquery for participant preview to avoid N+1.
 */
async function selectSessionsWithCounts(
  conditions: SQL[],
  orderBy: SQL,
  limit: number,
  offset: number
) {
  const rows = await db
    .select({
      session: eventSession,
      activityName: activity.name,
      joinedCount: db.$count(
        participation,
        and(
          eq(participation.sessionId, eventSession.id),
          eq(participation.status, "joined")
        )
      ),
      waitlistCount: db.$count(
        participation,
        and(
          eq(participation.sessionId, eventSession.id),
          eq(participation.status, "waitlisted")
        )
      ),
      participants: sql<ParticipantPreview[]>`(
        SELECT coalesce(json_agg(sub), '[]'::json) FROM (
          SELECT u.id, u.name, u.image
          FROM "participation" p
          INNER JOIN "user" u ON p.user_id = u.id
          WHERE p.session_id = "event_session"."id"
            AND p.status = 'joined'
          ORDER BY p.joined_at ASC
          LIMIT 4
        ) sub
      )`.as("participants"),
    })
    .from(eventSession)
    .leftJoin(activity, eq(eventSession.activityId, activity.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)

  return rows.map((row) => ({
    ...row.session,
    activityName: row.activityName,
    joinedCount: row.joinedCount,
    waitlistCount: row.waitlistCount,
    participants: row.participants ?? [],
  }))
}

// =============================================================================
// Mutations
// =============================================================================

export async function createSession(
  organizationId: string,
  createdBy: string,
  data: CreateSessionInput
): Promise<EventSession> {
  const [session] = await db
    .insert(eventSession)
    .values({
      organizationId,
      activityId: data.activityId,
      createdBy,
      title: data.title,
      description: data.description,
      dateTime: data.dateTime,
      location: data.location,
      maxCapacity: data.maxCapacity,
      maxWaitlist: data.maxWaitlist,
      joinMode: data.joinMode,
      joinFormSchema: data.joinFormSchema ?? null,
      status: "draft",
    })
    .returning()

  return session
}

export async function updateSession(
  sessionId: string,
  data: UpdateSessionInput
): Promise<EventSession> {
  const session = await getSessionById(sessionId)
  if (!session) {
    throw new NotFoundError("Session not found")
  }

  // Cannot modify completed or cancelled sessions
  if (session.status === "completed" || session.status === "cancelled") {
    throw new BadRequestError(
      `Cannot modify session with status '${session.status}'`
    )
  }

  const [updated] = await db
    .update(eventSession)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(eventSession.id, sessionId))
    .returning()

  return updated
}

export async function updateSessionStatus(
  sessionId: string,
  newStatus: SessionStatus
): Promise<EventSession> {
  const session = await getSessionById(sessionId)
  if (!session) {
    throw new NotFoundError("Session not found")
  }

  // Validate state transition
  assertSessionTransition(session.status as SessionStatus, newStatus)

  const [updated] = await db
    .update(eventSession)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(eventSession.id, sessionId))
    .returning()

  return updated
}

export async function softDeleteSession(sessionId: string): Promise<EventSession> {
  const session = await getSessionById(sessionId)
  if (!session) {
    throw new NotFoundError("Session not found")
  }

  const [deleted] = await db
    .update(eventSession)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eventSession.id, sessionId))
    .returning()

  return deleted
}

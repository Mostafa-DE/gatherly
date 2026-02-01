import { and, count, eq, gt, isNull, lt, or, sql, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { eventSession, participation } from "@/db/schema";
import type { EventSession } from "@/db/types";
import { NotFoundError, BadRequestError } from "@/exceptions";
import {
  assertSessionTransition,
  type SessionStatus,
} from "@/lib/sessions/state-machine";
import type {
  CreateSessionInput,
  UpdateSessionInput,
} from "@/schemas/session";

// =============================================================================
// Queries
// =============================================================================

export async function getSessionById(sessionId: string) {
  const result = await db
    .select()
    .from(eventSession)
    .where(and(eq(eventSession.id, sessionId), isNull(eventSession.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function getSessionByIdWithDeleted(sessionId: string) {
  const result = await db
    .select()
    .from(eventSession)
    .where(eq(eventSession.id, sessionId))
    .limit(1);
  return result[0] ?? null;
}

export async function getSessionWithCounts(sessionId: string) {
  const session = await getSessionById(sessionId);
  if (!session) return null;

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
    .where(eq(participation.sessionId, sessionId));

  return {
    ...session,
    joinedCount: counts?.joinedCount ?? 0,
    waitlistCount: counts?.waitlistCount ?? 0,
  };
}

export async function listSessions(
  organizationId: string,
  options: {
    limit: number;
    offset: number;
    status?: SessionStatus;
    includeDeleted?: boolean;
  }
) {
  const conditions = [eq(eventSession.organizationId, organizationId)];

  if (!options.includeDeleted) {
    conditions.push(isNull(eventSession.deletedAt));
  }

  if (options.status) {
    conditions.push(eq(eventSession.status, options.status));
  }

  return db
    .select()
    .from(eventSession)
    .where(and(...conditions))
    .orderBy(desc(eventSession.dateTime))
    .limit(options.limit)
    .offset(options.offset);
}

export async function listUpcomingSessions(
  organizationId: string,
  options: { limit: number; offset: number }
) {
  const now = new Date();
  return db
    .select()
    .from(eventSession)
    .where(
      and(
        eq(eventSession.organizationId, organizationId),
        isNull(eventSession.deletedAt),
        eq(eventSession.status, "published"),
        gt(eventSession.dateTime, now)
      )
    )
    .orderBy(asc(eventSession.dateTime))
    .limit(options.limit)
    .offset(options.offset);
}

export async function listPastSessions(
  organizationId: string,
  options: { limit: number; offset: number }
) {
  const now = new Date();
  return db
    .select()
    .from(eventSession)
    .where(
      and(
        eq(eventSession.organizationId, organizationId),
        isNull(eventSession.deletedAt),
        or(
          lt(eventSession.dateTime, now),
          eq(eventSession.status, "completed"),
          eq(eventSession.status, "cancelled")
        )
      )
    )
    .orderBy(desc(eventSession.dateTime))
    .limit(options.limit)
    .offset(options.offset);
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
      createdBy,
      title: data.title,
      description: data.description,
      dateTime: data.dateTime,
      location: data.location,
      maxCapacity: data.maxCapacity,
      maxWaitlist: data.maxWaitlist,
      joinMode: data.joinMode,
      status: "draft",
    })
    .returning();

  return session;
}

export async function updateSession(
  sessionId: string,
  data: UpdateSessionInput
): Promise<EventSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new NotFoundError("Session not found");
  }

  // Cannot modify completed or cancelled sessions
  if (session.status === "completed" || session.status === "cancelled") {
    throw new BadRequestError(
      `Cannot modify session with status '${session.status}'`
    );
  }

  const [updated] = await db
    .update(eventSession)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(eventSession.id, sessionId))
    .returning();

  return updated;
}

export async function updateSessionStatus(
  sessionId: string,
  newStatus: SessionStatus
): Promise<EventSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new NotFoundError("Session not found");
  }

  // Validate state transition
  assertSessionTransition(session.status as SessionStatus, newStatus);

  const [updated] = await db
    .update(eventSession)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(eventSession.id, sessionId))
    .returning();

  return updated;
}

export async function softDeleteSession(sessionId: string): Promise<EventSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new NotFoundError("Session not found");
  }

  const [deleted] = await db
    .update(eventSession)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(eventSession.id, sessionId))
    .returning();

  return deleted;
}

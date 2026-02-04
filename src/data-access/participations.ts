import { and, count, eq, ne, sql, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import { eventSession, participation, user } from "@/db/schema";
import type { Participation } from "@/db/types";
import { NotFoundError, BadRequestError } from "@/exceptions";
import type {
  AttendanceStatus,
  PaymentStatus,
} from "@/lib/sessions/state-machine";

// =============================================================================
// Helper: Check if error is a unique constraint violation
// =============================================================================

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}

// =============================================================================
// Queries
// =============================================================================

export async function getParticipationById(participationId: string) {
  const result = await db
    .select()
    .from(participation)
    .where(eq(participation.id, participationId))
    .limit(1);
  return result[0] ?? null;
}

export async function getActiveParticipation(sessionId: string, userId: string) {
  const result = await db
    .select()
    .from(participation)
    .where(
      and(
        eq(participation.sessionId, sessionId),
        eq(participation.userId, userId),
        ne(participation.status, "cancelled")
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function getMyParticipation(sessionId: string, userId: string) {
  return getActiveParticipation(sessionId, userId);
}

export async function getMyHistory(
  organizationId: string,
  userId: string,
  options: { limit: number; offset: number }
) {
  return db
    .select({
      participation: participation,
      session: eventSession,
    })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        eq(participation.userId, userId),
        eq(eventSession.organizationId, organizationId)
      )
    )
    .orderBy(desc(participation.joinedAt))
    .limit(options.limit)
    .offset(options.offset);
}

export async function getSessionRoster(
  sessionId: string,
  options: {
    status?: "joined" | "waitlisted" | "cancelled";
    limit: number;
    offset: number;
  }
) {
  const conditions = [eq(participation.sessionId, sessionId)];

  if (options.status) {
    conditions.push(eq(participation.status, options.status));
  }

  return db
    .select({
      participation: participation,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(participation)
    .innerJoin(user, eq(participation.userId, user.id))
    .where(and(...conditions))
    .orderBy(asc(participation.joinedAt), asc(participation.id))
    .limit(options.limit)
    .offset(options.offset);
}

export async function getUserHistory(
  organizationId: string,
  userId: string,
  options: { limit: number; offset: number }
) {
  return db
    .select({
      participation: participation,
      session: eventSession,
    })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        eq(participation.userId, userId),
        eq(eventSession.organizationId, organizationId)
      )
    )
    .orderBy(desc(participation.joinedAt))
    .limit(options.limit)
    .offset(options.offset);
}

export async function getWaitlistPosition(
  sessionId: string,
  userId: string,
  joinedAt: Date,
  participationId: string
): Promise<number | null> {
  const active = await getActiveParticipation(sessionId, userId);
  if (!active || active.status !== "waitlisted") {
    return null;
  }

  const [result] = await db
    .select({ position: count() })
    .from(participation)
    .where(
      and(
        eq(participation.sessionId, sessionId),
        eq(participation.status, "waitlisted"),
        sql`(${participation.joinedAt}, ${participation.id}) < (${joinedAt}, ${participationId})`
      )
    );

  return (result?.position ?? 0) + 1;
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Join a session (idempotent)
 *
 * Uses pessimistic locking to ensure capacity is enforced under concurrency.
 * If already joined/waitlisted, returns existing participation.
 * If previously cancelled, creates new participation.
 */
export async function joinSession(
  sessionId: string,
  userId: string
): Promise<Participation> {
  return await db.transaction(async (tx) => {
    // 1. Lock session row — concurrent requests serialize here
    const sessionResult = await tx.execute<{
      id: string;
      deleted_at: Date | null;
      status: string;
      join_mode: string;
      max_capacity: number;
      max_waitlist: number;
    }>(sql`
      SELECT id, deleted_at, status, join_mode, max_capacity, max_waitlist
      FROM event_session
      WHERE id = ${sessionId}
      FOR UPDATE
    `);
    const session = sessionResult.rows[0];

    // 2. Check session exists and is joinable
    if (!session) {
      throw new NotFoundError("Session not found");
    }
    if (session.deleted_at) {
      throw new NotFoundError("Session not found");
    }
    if (session.status !== "published") {
      throw new BadRequestError("Session is not open for joining");
    }

    // 3. Check join mode (MVP: only 'open' works)
    if (session.join_mode === "approval_required") {
      throw new BadRequestError("Approval-based joining coming soon");
    }
    if (session.join_mode === "invite_only") {
      throw new BadRequestError("Invite-only sessions coming soon");
    }

    // 4. Check for existing active participation (idempotent)
    const [existing] = await tx
      .select()
      .from(participation)
      .where(
        and(
          eq(participation.sessionId, sessionId),
          eq(participation.userId, userId),
          ne(participation.status, "cancelled")
        )
      );

    if (existing) {
      return existing; // Idempotent: return existing
    }

    // 5. Count current participants (inside lock = accurate)
    const [counts] = await tx
      .select({
        joined: count(sql`CASE WHEN status = 'joined' THEN 1 END`),
        waitlisted: count(sql`CASE WHEN status = 'waitlisted' THEN 1 END`),
      })
      .from(participation)
      .where(eq(participation.sessionId, sessionId));

    const joinedCount = counts?.joined ?? 0;
    const waitlistedCount = counts?.waitlisted ?? 0;

    // 6. Determine status
    let status: "joined" | "waitlisted";

    if (joinedCount < session.max_capacity) {
      status = "joined";
    } else if (waitlistedCount < session.max_waitlist) {
      status = "waitlisted";
    } else {
      throw new BadRequestError("Session and waitlist are full");
    }

    // 7. Insert new participation (handle unique conflict idempotently)
    try {
      const [newParticipation] = await tx
        .insert(participation)
        .values({
          sessionId,
          userId,
          status,
          joinedAt: new Date(),
        })
        .returning();
      return newParticipation;
    } catch (error) {
      // If unique constraint hit (race condition edge case), return existing
      if (isUniqueConstraintError(error)) {
        const [existing] = await tx
          .select()
          .from(participation)
          .where(
            and(
              eq(participation.sessionId, sessionId),
              eq(participation.userId, userId),
              ne(participation.status, "cancelled")
            )
          );
        if (existing) return existing;
      }
      throw error;
    }
  });
}

/**
 * Cancel participation (with auto-promote)
 *
 * If the cancelled participation was 'joined', automatically promotes
 * the first waitlisted person to 'joined' (FIFO order).
 */
export async function cancelParticipation(
  participationId: string,
  userId: string
): Promise<Participation> {
  return await db.transaction(async (tx) => {
    // 1. Get participation first (to get sessionId and verify ownership)
    const [current] = await tx
      .select()
      .from(participation)
      .where(eq(participation.id, participationId));

    if (!current) {
      throw new NotFoundError("Participation not found");
    }
    if (current.userId !== userId) {
      throw new NotFoundError("Participation not found"); // Don't reveal existence
    }
    if (current.status === "cancelled") {
      throw new BadRequestError("Participation already cancelled");
    }

    // 2. Lock the session row and check it's not deleted
    const sessionResult = await tx.execute<{
      id: string;
      deleted_at: Date | null;
      status: string;
    }>(sql`
      SELECT id, deleted_at, status
      FROM event_session
      WHERE id = ${current.sessionId}
      FOR UPDATE
    `);
    const session = sessionResult.rows[0];

    if (!session || session.deleted_at) {
      throw new NotFoundError("Session not found");
    }

    // 3. Check session state - don't allow cancel after completed
    if (session.status === "completed") {
      throw new BadRequestError("Cannot cancel participation for completed session");
    }

    // 4. Cancel the participation
    const wasJoined = current.status === "joined";

    const [cancelled] = await tx
      .update(participation)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(participation.id, participationId))
      .returning();

    // 5. If was joined, promote first waitlisted (FIFO)
    if (wasJoined) {
      // SKIP LOCKED: if another transaction already locked someone, skip to next
      await tx.execute(sql`
        UPDATE participation
        SET status = 'joined', updated_at = NOW()
        WHERE id = (
          SELECT id FROM participation
          WHERE session_id = ${current.sessionId}
            AND status = 'waitlisted'
          ORDER BY joined_at ASC, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
      `);
    }

    return cancelled;
  });
}

/**
 * Update participation (admin)
 */
export async function updateParticipation(
  participationId: string,
  data: {
    attendance?: AttendanceStatus;
    payment?: PaymentStatus;
    notes?: string | null;
  }
): Promise<Participation> {
  const current = await getParticipationById(participationId);
  if (!current) {
    throw new NotFoundError("Participation not found");
  }

  const [updated] = await db
    .update(participation)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(participation.id, participationId))
    .returning();

  return updated;
}

/**
 * Bulk update attendance (admin)
 */
export async function bulkUpdateAttendance(
  sessionId: string,
  updates: Array<{ participationId: string; attendance: AttendanceStatus }>
): Promise<number> {
  await db.transaction(async (tx) => {
    for (const update of updates) {
      const updated = await tx
        .update(participation)
        .set({
          attendance: update.attendance,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(participation.id, update.participationId),
            eq(participation.sessionId, sessionId)
          )
        )
        .returning({ id: participation.id });

      if (updated.length === 0) {
        throw new NotFoundError(
          `Participation '${update.participationId}' not found in session`
        );
      }
    }
  });

  return updates.length;
}

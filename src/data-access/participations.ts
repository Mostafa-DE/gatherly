import { and, count, eq, ne, sql, desc, asc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { eventSession, participation, user } from "@/db/schema";
import type { Participation } from "@/db/types";
import { NotFoundError, BadRequestError, ConflictError } from "@/exceptions";
import type {
  AttendanceStatus,
  PaymentStatus,
} from "@/lib/sessions/state-machine";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// =============================================================================
// Helper: Check if error is a unique constraint violation
// =============================================================================

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}

/**
 * Check if user has an active participation in another session at the same date/time
 * Used to prevent double-booking a person
 */
async function assertNoConflictingParticipation(
  tx: DbTransaction,
  userId: string,
  sessionDateTime: Date | string,
  excludeSessionId: string
): Promise<void> {
  // Ensure we have a proper Date object (raw SQL returns string)
  const dateTime = sessionDateTime instanceof Date
    ? sessionDateTime
    : new Date(sessionDateTime);

  const [conflict] = await tx
    .select({
      sessionId: eventSession.id,
      sessionTitle: eventSession.title,
    })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        eq(participation.userId, userId),
        ne(participation.status, "cancelled"),
        eq(eventSession.dateTime, dateTime),
        ne(eventSession.id, excludeSessionId),
        isNull(eventSession.deletedAt)
      )
    )
    .limit(1);

  if (conflict) {
    throw new ConflictError(
      `User is already registered for another session "${conflict.sessionTitle}" at this time`
    );
  }
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
        phoneNumber: user.phoneNumber,
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
      date_time: Date;
    }>(sql`
      SELECT id, deleted_at, status, join_mode, max_capacity, max_waitlist, date_time
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

    // 5. Check for conflicting participation at same date/time
    await assertNoConflictingParticipation(tx, userId, session.date_time, sessionId);

    // 6. Count current participants (inside lock = accurate)
    const [counts] = await tx
      .select({
        joined: count(sql`CASE WHEN status = 'joined' THEN 1 END`),
        waitlisted: count(sql`CASE WHEN status = 'waitlisted' THEN 1 END`),
      })
      .from(participation)
      .where(eq(participation.sessionId, sessionId));

    const joinedCount = counts?.joined ?? 0;
    const waitlistedCount = counts?.waitlisted ?? 0;

    // 7. Determine status
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

/**
 * Admin add participant (bypasses join_mode restrictions)
 *
 * Adds a user to a session. If the session is at capacity, adds to waitlist.
 * Throws error if user is already in session or has conflicting participation.
 */
export async function adminAddParticipant(
  sessionId: string,
  userId: string
): Promise<Participation> {
  return await db.transaction(async (tx) => {
    // 1. Lock session row
    const sessionResult = await tx.execute<{
      id: string;
      deleted_at: Date | null;
      status: string;
      max_capacity: number;
      max_waitlist: number;
      date_time: Date;
    }>(sql`
      SELECT id, deleted_at, status, max_capacity, max_waitlist, date_time
      FROM event_session
      WHERE id = ${sessionId}
      FOR UPDATE
    `);
    const session = sessionResult.rows[0];

    // 2. Check session exists
    if (!session) {
      throw new NotFoundError("Session not found");
    }
    if (session.deleted_at) {
      throw new NotFoundError("Session not found");
    }

    // 3. Check session is not cancelled or completed
    if (session.status === "cancelled") {
      throw new BadRequestError("Cannot add participant to a cancelled session");
    }
    if (session.status === "completed") {
      throw new BadRequestError("Cannot add participant to a completed session");
    }

    // 4. Check for existing active participation - throw error if already exists
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
      throw new ConflictError("Participant is already in this session");
    }

    // 5. Check for conflicting participation at same date/time
    await assertNoConflictingParticipation(tx, userId, session.date_time, sessionId);

    // 6. Count current participants
    const [counts] = await tx
      .select({
        joined: count(sql`CASE WHEN status = 'joined' THEN 1 END`),
        waitlisted: count(sql`CASE WHEN status = 'waitlisted' THEN 1 END`),
      })
      .from(participation)
      .where(eq(participation.sessionId, sessionId));

    const joinedCount = counts?.joined ?? 0;
    const waitlistedCount = counts?.waitlisted ?? 0;

    // 7. Determine status
    let status: "joined" | "waitlisted";

    if (joinedCount < session.max_capacity) {
      status = "joined";
    } else if (waitlistedCount < session.max_waitlist) {
      status = "waitlisted";
    } else {
      throw new ConflictError("Session and waitlist are full");
    }

    // 8. Insert new participation
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
 * Move participant between sessions (admin)
 *
 * Cancels participation in source session and adds to target session.
 * Does NOT auto-promote on source session (per design decision).
 * Returns both the cancelled and created participation records.
 */
export async function moveParticipant(
  participationId: string,
  targetSessionId: string
): Promise<{ cancelled: Participation; created: Participation }> {
  return await db.transaction(async (tx) => {
    // 1. Get source participation
    const [sourceParticipation] = await tx
      .select()
      .from(participation)
      .where(eq(participation.id, participationId));

    if (!sourceParticipation) {
      throw new NotFoundError("Participation not found");
    }
    if (sourceParticipation.status === "cancelled") {
      throw new BadRequestError("Participation is already cancelled");
    }

    // 2. Lock source session
    const sourceSessionResult = await tx.execute<{
      id: string;
      deleted_at: Date | null;
      organization_id: string;
    }>(sql`
      SELECT id, deleted_at, organization_id
      FROM event_session
      WHERE id = ${sourceParticipation.sessionId}
      FOR UPDATE
    `);
    const sourceSession = sourceSessionResult.rows[0];

    if (!sourceSession || sourceSession.deleted_at) {
      throw new NotFoundError("Source session not found");
    }

    // 3. Prevent moving to same session
    if (sourceParticipation.sessionId === targetSessionId) {
      throw new BadRequestError("Cannot move participant to the same session");
    }

    // 4. Lock target session
    const targetSessionResult = await tx.execute<{
      id: string;
      deleted_at: Date | null;
      status: string;
      organization_id: string;
      max_capacity: number;
      max_waitlist: number;
    }>(sql`
      SELECT id, deleted_at, status, organization_id, max_capacity, max_waitlist
      FROM event_session
      WHERE id = ${targetSessionId}
      FOR UPDATE
    `);
    const targetSession = targetSessionResult.rows[0];

    if (!targetSession || targetSession.deleted_at) {
      throw new NotFoundError("Target session not found");
    }

    // 5. Verify both sessions are in the same organization
    if (sourceSession.organization_id !== targetSession.organization_id) {
      throw new BadRequestError("Cannot move participant to a session in a different organization");
    }

    // 6. Check target session is joinable
    if (targetSession.status === "cancelled") {
      throw new BadRequestError("Cannot move to a cancelled session");
    }
    if (targetSession.status === "completed") {
      throw new BadRequestError("Cannot move to a completed session");
    }

    // 7. Check for existing participation in target session
    const [existingTarget] = await tx
      .select()
      .from(participation)
      .where(
        and(
          eq(participation.sessionId, targetSessionId),
          eq(participation.userId, sourceParticipation.userId),
          ne(participation.status, "cancelled")
        )
      );

    if (existingTarget) {
      throw new BadRequestError("User already has an active participation in the target session");
    }

    // 8. Cancel source participation (NO auto-promote per requirement)
    const [cancelled] = await tx
      .update(participation)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(participation.id, participationId))
      .returning();

    // 9. Count current participants in target session
    const [counts] = await tx
      .select({
        joined: count(sql`CASE WHEN status = 'joined' THEN 1 END`),
        waitlisted: count(sql`CASE WHEN status = 'waitlisted' THEN 1 END`),
      })
      .from(participation)
      .where(eq(participation.sessionId, targetSessionId));

    const joinedCount = counts?.joined ?? 0;
    const waitlistedCount = counts?.waitlisted ?? 0;

    // 10. Determine status for target
    let newStatus: "joined" | "waitlisted";

    if (joinedCount < targetSession.max_capacity) {
      newStatus = "joined";
    } else if (waitlistedCount < targetSession.max_waitlist) {
      newStatus = "waitlisted";
    } else {
      throw new ConflictError("Target session and waitlist are full");
    }

    // 11. Create new participation in target session
    const [created] = await tx
      .insert(participation)
      .values({
        sessionId: targetSessionId,
        userId: sourceParticipation.userId,
        status: newStatus,
        joinedAt: new Date(),
      })
      .returning();

    return { cancelled, created };
  });
}

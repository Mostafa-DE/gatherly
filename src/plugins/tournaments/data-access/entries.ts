import { and, eq, sql, count, ne, inArray, asc, min } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/auth-schema"
import { tournament, tournamentEntry, tournamentTeam, tournamentMatchEntry } from "../schema"
import { NotFoundError, BadRequestError, ConflictError } from "@/exceptions"
import type { EntryStatus } from "../types"
import { assertEntryTransition } from "../state-machine"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505"
}

// =============================================================================
// Queries
// =============================================================================

export async function getEntryById(
  entryId: string,
  organizationId: string
) {
  const [result] = await db
    .select()
    .from(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.id, entryId),
        eq(tournamentEntry.organizationId, organizationId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function listEntries(
  tournamentId: string,
  organizationId: string,
  options: {
    status?: string
    limit: number
    offset: number
  }
) {
  const conditions = [
    eq(tournamentEntry.tournamentId, tournamentId),
    eq(tournamentEntry.organizationId, organizationId),
  ]

  if (options.status) {
    conditions.push(eq(tournamentEntry.status, options.status))
  }

  return db
    .select({
      id: tournamentEntry.id,
      organizationId: tournamentEntry.organizationId,
      tournamentId: tournamentEntry.tournamentId,
      userId: tournamentEntry.userId,
      teamId: tournamentEntry.teamId,
      status: tournamentEntry.status,
      seed: tournamentEntry.seed,
      finalPlacement: tournamentEntry.finalPlacement,
      paymentStatus: tournamentEntry.paymentStatus,
      paymentRef: tournamentEntry.paymentRef,
      createdAt: tournamentEntry.createdAt,
      updatedAt: tournamentEntry.updatedAt,
      participantType: sql<"individual" | "team">`
        CASE
          WHEN ${tournamentEntry.userId} IS NOT NULL THEN 'individual'
          ELSE 'team'
        END
      `,
      participantName: sql<string>`
        COALESCE(${user.name}, ${tournamentTeam.name})
      `,
      participantImage: user.image,
    })
    .from(tournamentEntry)
    .leftJoin(user, eq(tournamentEntry.userId, user.id))
    .leftJoin(tournamentTeam, eq(tournamentEntry.teamId, tournamentTeam.id))
    .where(and(...conditions))
    .orderBy(asc(tournamentEntry.seed), asc(tournamentEntry.createdAt))
    .limit(options.limit)
    .offset(options.offset)
}

export async function getEntryByUserAndTournament(
  tournamentId: string,
  userId: string
) {
  const [result] = await db
    .select()
    .from(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.tournamentId, tournamentId),
        eq(tournamentEntry.userId, userId),
        ne(tournamentEntry.status, "withdrawn")
      )
    )
    .limit(1)
  return result ?? null
}

// =============================================================================
// Registration
// =============================================================================

export async function registerEntry(
  tournamentId: string,
  organizationId: string,
  userId: string,
  options?: { allowDraft?: boolean }
) {
  return db.transaction(async (tx) => {
    // Lock tournament row for capacity check
    const tournamentResult = await tx.execute<{
      id: string
      status: string
      config: { maxCapacity?: number }
      participant_type: string
    }>(sql`
      SELECT id, status, config, participant_type
      FROM tournament
      WHERE id = ${tournamentId} AND organization_id = ${organizationId}
      FOR UPDATE
    `)
    const t = tournamentResult.rows[0]

    if (!t) {
      throw new NotFoundError("Tournament not found")
    }
    const allowedStatuses = ["registration", "check_in"]
    if (options?.allowDraft) allowedStatuses.push("draft")
    if (!allowedStatuses.includes(t.status)) {
      throw new BadRequestError("Tournament is not accepting registrations")
    }
    if (t.participant_type !== "individual") {
      throw new BadRequestError("This tournament requires team registration")
    }

    // Check idempotency
    const [existing] = await tx
      .select()
      .from(tournamentEntry)
      .where(
        and(
          eq(tournamentEntry.tournamentId, tournamentId),
          eq(tournamentEntry.userId, userId),
          ne(tournamentEntry.status, "withdrawn")
        )
      )
      .limit(1)

    if (existing) return existing // Idempotent

    // Capacity check
    if (t.config.maxCapacity) {
      const [{ entryCount }] = await tx
        .select({ entryCount: count() })
        .from(tournamentEntry)
        .where(
          and(
            eq(tournamentEntry.tournamentId, tournamentId),
            ne(tournamentEntry.status, "withdrawn")
          )
        )

      if (entryCount >= t.config.maxCapacity) {
        throw new ConflictError("Tournament is full")
      }
    }

    try {
      const [entry] = await tx
        .insert(tournamentEntry)
        .values({
          organizationId,
          tournamentId,
          userId,
          status: "registered",
        })
        .returning()
      return entry
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const [existing] = await tx
          .select()
          .from(tournamentEntry)
          .where(
            and(
              eq(tournamentEntry.tournamentId, tournamentId),
              eq(tournamentEntry.userId, userId),
              ne(tournamentEntry.status, "withdrawn")
            )
          )
        if (existing) return existing
      }
      throw error
    }
  })
}

export async function withdrawEntry(
  tournamentId: string,
  organizationId: string,
  userId: string
) {
  const entry = await getEntryByUserAndTournament(tournamentId, userId)
  if (!entry || entry.organizationId !== organizationId) {
    throw new NotFoundError("Entry not found")
  }

  assertEntryTransition(entry.status as EntryStatus, "withdrawn")

  const [updated] = await db
    .update(tournamentEntry)
    .set({ status: "withdrawn", updatedAt: new Date() })
    .where(eq(tournamentEntry.id, entry.id))
    .returning()

  return updated
}

export async function checkInEntry(
  entryId: string,
  organizationId: string,
  tournamentId: string
) {
  const entry = await getEntryById(entryId, organizationId)
  if (!entry || entry.tournamentId !== tournamentId) {
    throw new NotFoundError("Entry not found")
  }

  assertEntryTransition(entry.status as EntryStatus, "checked_in")

  const [updated] = await db
    .update(tournamentEntry)
    .set({ status: "checked_in", updatedAt: new Date() })
    .where(eq(tournamentEntry.id, entryId))
    .returning()

  return updated
}

export async function disqualifyEntry(
  entryId: string,
  organizationId: string,
  tournamentId: string,
  txArg?: DbTransaction
) {
  const conn = txArg ?? db

  const [entry] = await conn
    .select()
    .from(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.id, entryId),
        eq(tournamentEntry.organizationId, organizationId)
      )
    )
    .limit(1)

  if (!entry || entry.tournamentId !== tournamentId) {
    throw new NotFoundError("Entry not found")
  }

  assertEntryTransition(entry.status as EntryStatus, "disqualified")

  const [updated] = await conn
    .update(tournamentEntry)
    .set({ status: "disqualified", updatedAt: new Date() })
    .where(eq(tournamentEntry.id, entryId))
    .returning()

  return updated
}

export async function removeEntry(
  entryId: string,
  organizationId: string,
  tournamentId: string,
  txArg?: DbTransaction
) {
  const conn = txArg ?? db

  const [entry] = await conn
    .select()
    .from(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.id, entryId),
        eq(tournamentEntry.organizationId, organizationId)
      )
    )
    .limit(1)

  if (!entry || entry.tournamentId !== tournamentId) {
    throw new NotFoundError("Entry not found")
  }

  const [removed] = await conn
    .delete(tournamentEntry)
    .where(eq(tournamentEntry.id, entryId))
    .returning()

  return removed
}

// =============================================================================
// Seeding
// =============================================================================

export async function setSeeds(
  tournamentId: string,
  organizationId: string,
  expectedVersion: number,
  seeds: Array<{ entryId: string; seed: number }>
) {
  return db.transaction(async (tx) => {
    // Lock tournament and verify version
    const [t] = await tx
      .update(tournament)
      .set({
        version: sql`${tournament.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tournament.id, tournamentId),
          eq(tournament.organizationId, organizationId),
          eq(tournament.version, expectedVersion)
        )
      )
      .returning()

    if (!t) {
      throw new ConflictError("Tournament version conflict. Please refresh.")
    }

    // Clear existing seeds
    await tx
      .update(tournamentEntry)
      .set({ seed: null })
      .where(eq(tournamentEntry.tournamentId, tournamentId))

    // Set new seeds
    for (const { entryId, seed } of seeds) {
      const [updated] = await tx
        .update(tournamentEntry)
        .set({ seed, updatedAt: new Date() })
        .where(
          and(
            eq(tournamentEntry.id, entryId),
            eq(tournamentEntry.tournamentId, tournamentId)
          )
        )
        .returning()

      if (!updated) {
        throw new NotFoundError(`Entry ${entryId} not found in this tournament`)
      }
    }

    return t
  })
}

export async function randomizeSeeds(
  tournamentId: string,
  organizationId: string
) {
  return db.transaction(async (tx) => {
    const entries = await tx
      .select()
      .from(tournamentEntry)
      .where(
        and(
          eq(tournamentEntry.tournamentId, tournamentId),
          eq(tournamentEntry.organizationId, organizationId),
          ne(tournamentEntry.status, "withdrawn"),
          ne(tournamentEntry.status, "disqualified")
        )
      )

    // Fisher-Yates shuffle with timestamp seed
    const shuffled = [...entries]
    let state = Date.now() | 0
    const rand = () => {
      state = (Math.imul(state, 1664525) + 1013904223) | 0
      return (state >>> 0) / 4294967296
    }

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      const tmp = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = tmp
    }

    // Clear existing seeds first so sequential updates do not collide with the
    // unique (tournament_id, seed) index when entries are already seeded.
    await tx
      .update(tournamentEntry)
      .set({ seed: null })
      .where(eq(tournamentEntry.tournamentId, tournamentId))

    for (let i = 0; i < shuffled.length; i++) {
      await tx
        .update(tournamentEntry)
        .set({ seed: i + 1, updatedAt: new Date() })
        .where(eq(tournamentEntry.id, shuffled[i].id))
    }

    // Bump tournament version
    await tx
      .update(tournament)
      .set({
        version: sql`${tournament.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tournament.id, tournamentId))

    return shuffled.map((e, i) => ({ entryId: e.id, seed: i + 1 }))
  })
}

// =============================================================================
// Bulk operations (used by lifecycle)
// =============================================================================

export async function setEntriesToActive(
  tx: DbTransaction,
  tournamentId: string
) {
  return tx
    .update(tournamentEntry)
    .set({ status: "active", updatedAt: new Date() })
    .where(
      and(
        eq(tournamentEntry.tournamentId, tournamentId),
        inArray(tournamentEntry.status, ["registered", "checked_in"])
      )
    )
    .returning()
}

export async function getActiveEntries(
  tournamentId: string,
  organizationId: string
) {
  return db
    .select()
    .from(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.tournamentId, tournamentId),
        eq(tournamentEntry.organizationId, organizationId),
        ne(tournamentEntry.status, "withdrawn"),
        ne(tournamentEntry.status, "disqualified")
      )
    )
    .orderBy(tournamentEntry.seed)
}

// =============================================================================
// AI Enrichment Queries
// =============================================================================

export async function getUserTournamentSummary(
  userId: string,
  organizationId: string
): Promise<{
  tournamentsEntered: number
  matchWins: number
  matchLosses: number
  bestPlacement: number | null
}> {
  // Query 1: Count entries and best placement
  const [entryStats] = await db
    .select({
      tournamentsEntered: sql<number>`COUNT(*)::int`,
      bestPlacement: min(tournamentEntry.finalPlacement),
    })
    .from(tournamentEntry)
    .where(
      and(
        eq(tournamentEntry.userId, userId),
        eq(tournamentEntry.organizationId, organizationId),
        ne(tournamentEntry.status, "withdrawn")
      )
    )

  // Query 2: Count match wins and losses
  const [matchStats] = await db
    .select({
      matchWins: sql<number>`COUNT(*) FILTER (WHERE ${tournamentMatchEntry.result} = 'win')::int`,
      matchLosses: sql<number>`COUNT(*) FILTER (WHERE ${tournamentMatchEntry.result} = 'loss')::int`,
    })
    .from(tournamentMatchEntry)
    .innerJoin(
      tournamentEntry,
      eq(tournamentMatchEntry.entryId, tournamentEntry.id)
    )
    .where(
      and(
        eq(tournamentEntry.userId, userId),
        eq(tournamentEntry.organizationId, organizationId)
      )
    )

  return {
    tournamentsEntered: entryStats?.tournamentsEntered ?? 0,
    matchWins: matchStats?.matchWins ?? 0,
    matchLosses: matchStats?.matchLosses ?? 0,
    bestPlacement: entryStats?.bestPlacement ?? null,
  }
}

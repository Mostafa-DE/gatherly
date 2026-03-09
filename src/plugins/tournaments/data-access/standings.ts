import { and, eq, desc, asc } from "drizzle-orm"
import { db } from "@/db"
import { tournamentStanding } from "../schema"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// =============================================================================
// Queries
// =============================================================================

export async function getStandingsByStage(
  stageId: string,
  groupId?: string
) {
  const conditions = [eq(tournamentStanding.stageId, stageId)]

  if (groupId) {
    conditions.push(eq(tournamentStanding.groupId, groupId))
  }

  return db
    .select()
    .from(tournamentStanding)
    .where(and(...conditions))
    .orderBy(
      desc(tournamentStanding.points),
      desc(tournamentStanding.wins),
      asc(tournamentStanding.losses)
    )
}

// =============================================================================
// Initialize
// =============================================================================

export async function initializeStandings(
  tx: DbTransaction,
  organizationId: string,
  stageId: string,
  entryIds: string[],
  groupId?: string
) {
  if (entryIds.length === 0) return

  const values = entryIds.map((entryId) => ({
    organizationId,
    stageId,
    groupId: groupId ?? null,
    entryId,
    rank: null,
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0,
    tiebreakers: {},
  }))

  await tx.insert(tournamentStanding).values(values)
}

// =============================================================================
// Update standings from match results
// =============================================================================

export async function updateStandingForEntry(
  tx: DbTransaction,
  stageId: string,
  entryId: string,
  delta: {
    wins?: number
    losses?: number
    draws?: number
    points?: number
  },
  groupId?: string
) {
  const conditions = [
    eq(tournamentStanding.stageId, stageId),
    eq(tournamentStanding.entryId, entryId),
  ]

  if (groupId) {
    conditions.push(eq(tournamentStanding.groupId, groupId))
  }

  const setClauses: Record<string, unknown> = { updatedAt: new Date() }

  if (delta.wins) {
    setClauses.wins = db.$count(tournamentStanding)
    // Use raw SQL for increments
  }

  // Use a simpler approach: fetch + update
  const [current] = await tx
    .select()
    .from(tournamentStanding)
    .where(and(...conditions))
    .limit(1)

  if (!current) return null

  const [updated] = await tx
    .update(tournamentStanding)
    .set({
      wins: current.wins + (delta.wins ?? 0),
      losses: current.losses + (delta.losses ?? 0),
      draws: current.draws + (delta.draws ?? 0),
      points: current.points + (delta.points ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(tournamentStanding.id, current.id))
    .returning()

  return updated
}

/**
 * Recalculate ranks for a stage (or group within a stage).
 * Orders by points desc, then wins desc, then losses asc.
 */
export async function recalculateRanks(
  tx: DbTransaction,
  stageId: string,
  groupId?: string
) {
  const conditions = [eq(tournamentStanding.stageId, stageId)]
  if (groupId) {
    conditions.push(eq(tournamentStanding.groupId, groupId))
  }

  const standings = await tx
    .select()
    .from(tournamentStanding)
    .where(and(...conditions))
    .orderBy(
      desc(tournamentStanding.points),
      desc(tournamentStanding.wins),
      asc(tournamentStanding.losses)
    )

  for (let i = 0; i < standings.length; i++) {
    await tx
      .update(tournamentStanding)
      .set({ rank: i + 1, updatedAt: new Date() })
      .where(eq(tournamentStanding.id, standings[i].id))
  }
}

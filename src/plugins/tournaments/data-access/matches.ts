import { and, eq, sql, asc } from "drizzle-orm"
import { db } from "@/db"
import {
  tournamentMatch,
  tournamentMatchEntry,
  tournamentMatchEdge,
} from "../schema"
import { NotFoundError, ConflictError, BadRequestError } from "@/exceptions"
import { assertMatchTransition } from "../state-machine"
import type { MatchStatus } from "../types"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// =============================================================================
// Queries
// =============================================================================

export async function getMatchById(matchId: string, organizationId: string) {
  const [result] = await db
    .select()
    .from(tournamentMatch)
    .where(
      and(
        eq(tournamentMatch.id, matchId),
        eq(tournamentMatch.organizationId, organizationId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function getMatchByIdForUpdate(
  tx: DbTransaction,
  matchId: string,
  organizationId: string
) {
  const result = await tx.execute<{
    id: string
    organization_id: string
    tournament_id: string
    round_id: string
    match_number: number
    status: string
    scores: unknown
    winner_entry_id: string | null
    version: number
  }>(sql`
    SELECT id, organization_id, tournament_id, round_id, match_number,
           status, scores, winner_entry_id, version
    FROM tournament_match
    WHERE id = ${matchId} AND organization_id = ${organizationId}
    FOR UPDATE
  `)
  return result.rows[0] ?? null
}

export async function getMatchesByTournament(
  tournamentId: string,
  organizationId: string,
  options: {
    roundId?: string
    status?: string
    limit: number
    offset: number
  }
) {
  const conditions = [
    eq(tournamentMatch.tournamentId, tournamentId),
    eq(tournamentMatch.organizationId, organizationId),
  ]

  if (options.roundId) {
    conditions.push(eq(tournamentMatch.roundId, options.roundId))
  }
  if (options.status) {
    conditions.push(eq(tournamentMatch.status, options.status))
  }

  return db
    .select()
    .from(tournamentMatch)
    .where(and(...conditions))
    .orderBy(asc(tournamentMatch.matchNumber))
    .limit(options.limit)
    .offset(options.offset)
}

export async function getMatchesByRound(roundId: string) {
  return db
    .select()
    .from(tournamentMatch)
    .where(eq(tournamentMatch.roundId, roundId))
    .orderBy(asc(tournamentMatch.matchNumber))
}

export async function getMatchEntries(matchId: string) {
  return db
    .select()
    .from(tournamentMatchEntry)
    .where(eq(tournamentMatchEntry.matchId, matchId))
    .orderBy(asc(tournamentMatchEntry.slot))
}

export async function getMatchEdgesFrom(matchId: string) {
  return db
    .select()
    .from(tournamentMatchEdge)
    .where(eq(tournamentMatchEdge.fromMatchId, matchId))
}

// =============================================================================
// Score Reporting
// =============================================================================

export async function reportScore(
  tx: DbTransaction,
  matchId: string,
  organizationId: string,
  tournamentId: string,
  expectedVersion: number,
  data: {
    scores: Record<string, unknown>
    winnerEntryId: string
  }
) {
  // Lock match
  const match = await getMatchByIdForUpdate(tx, matchId, organizationId)
  if (!match || match.tournament_id !== tournamentId) {
    throw new NotFoundError("Match not found")
  }

  if (match.version !== expectedVersion) {
    throw new ConflictError("Match was modified. Please refresh.")
  }

  // Auto-transition from pending/scheduled → in_progress before completing
  if (match.status === "pending" || match.status === "scheduled") {
    assertMatchTransition(match.status as MatchStatus, "in_progress")
    await tx
      .update(tournamentMatch)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tournamentMatch.id, matchId))
    match.status = "in_progress"
  }

  assertMatchTransition(match.status as MatchStatus, "completed")

  // Get match entries and validate winner is a participant
  const matchEntries = await tx
    .select()
    .from(tournamentMatchEntry)
    .where(eq(tournamentMatchEntry.matchId, matchId))

  if (matchEntries.length < 2) {
    throw new BadRequestError("Match requires two participants before it can be scored")
  }

  const isParticipant = matchEntries.some((me) => me.entryId === data.winnerEntryId)
  if (!isParticipant) {
    throw new BadRequestError("Winner entry is not a participant in this match")
  }

  // Update match
  const [updated] = await tx
    .update(tournamentMatch)
    .set({
      status: "completed",
      scores: data.scores,
      winnerEntryId: data.winnerEntryId,
      version: sql`${tournamentMatch.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tournamentMatch.id, matchId))
    .returning()

  for (const me of matchEntries) {
    const result = me.entryId === data.winnerEntryId ? "win" : "loss"
    await tx
      .update(tournamentMatchEntry)
      .set({ result, updatedAt: new Date() })
      .where(eq(tournamentMatchEntry.id, me.id))
  }

  // Resolve edges: advance winner/loser to next matches
  await resolveEdges(tx, matchId, data.winnerEntryId, matchEntries)

  return updated
}

export async function forfeitMatch(
  tx: DbTransaction,
  matchId: string,
  organizationId: string,
  tournamentId: string,
  forfeitEntryId: string
) {
  const match = await getMatchByIdForUpdate(tx, matchId, organizationId)
  if (!match || match.tournament_id !== tournamentId) {
    throw new NotFoundError("Match not found")
  }

  // Auto-transition from pending/scheduled → in_progress before forfeiting
  if (match.status === "pending" || match.status === "scheduled") {
    assertMatchTransition(match.status as MatchStatus, "in_progress")
    await tx
      .update(tournamentMatch)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(tournamentMatch.id, matchId))
    match.status = "in_progress"
  }

  assertMatchTransition(match.status as MatchStatus, "forfeit")

  const matchEntries = await tx
    .select()
    .from(tournamentMatchEntry)
    .where(eq(tournamentMatchEntry.matchId, matchId))

  const forfeitEntry = matchEntries.find((me) => me.entryId === forfeitEntryId)
  if (!forfeitEntry) {
    throw new BadRequestError("Entry is not in this match")
  }

  const winnerEntry = matchEntries.find((me) => me.entryId !== forfeitEntryId)
  const winnerEntryId = winnerEntry?.entryId ?? null

  // Update match
  const [updated] = await tx
    .update(tournamentMatch)
    .set({
      status: "forfeit",
      winnerEntryId,
      version: sql`${tournamentMatch.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tournamentMatch.id, matchId))
    .returning()

  // Update match entry results
  for (const me of matchEntries) {
    const result = me.entryId === forfeitEntryId ? "forfeit" : "win"
    await tx
      .update(tournamentMatchEntry)
      .set({ result, updatedAt: new Date() })
      .where(eq(tournamentMatchEntry.id, me.id))
  }

  if (winnerEntryId) {
    await resolveEdges(tx, matchId, winnerEntryId, matchEntries)
  }

  return updated
}

/**
 * Process bye matches: auto-advance the solo entry.
 */
export async function autoAdvanceByes(
  tx: DbTransaction,
  tournamentId: string,
  organizationId: string
) {
  // Find all bye matches for this tournament
  const byeMatches = await tx
    .select()
    .from(tournamentMatch)
    .where(
      and(
        eq(tournamentMatch.tournamentId, tournamentId),
        eq(tournamentMatch.organizationId, organizationId),
        eq(tournamentMatch.status, "bye")
      )
    )

  for (const match of byeMatches) {
    const matchEntries = await tx
      .select()
      .from(tournamentMatchEntry)
      .where(eq(tournamentMatchEntry.matchId, match.id))

    const realEntry = matchEntries.find((me) => me.entryId !== null)
    if (realEntry) {
      // Update match entry result
      await tx
        .update(tournamentMatchEntry)
        .set({ result: "bye", updatedAt: new Date() })
        .where(eq(tournamentMatchEntry.id, realEntry.id))

      // Set winner
      await tx
        .update(tournamentMatch)
        .set({
          winnerEntryId: realEntry.entryId,
          version: sql`${tournamentMatch.version} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(tournamentMatch.id, match.id))

      // Resolve edges
      await resolveEdges(tx, match.id, realEntry.entryId, matchEntries)
    }
  }
}

// =============================================================================
// Internal: Edge Resolution
// =============================================================================

async function resolveEdges(
  tx: DbTransaction,
  matchId: string,
  winnerEntryId: string,
  matchEntries: Array<{ entryId: string; slot: number }>
) {
  const edges = await tx
    .select()
    .from(tournamentMatchEdge)
    .where(eq(tournamentMatchEdge.fromMatchId, matchId))

  const loserEntry = matchEntries.find((me) => me.entryId !== winnerEntryId)

  for (const edge of edges) {
    let advancingEntryId: string | null = null

    if (edge.outcomeType === "winner") {
      advancingEntryId = winnerEntryId
    } else if (edge.outcomeType === "loser" && loserEntry) {
      advancingEntryId = loserEntry.entryId
    }

    if (advancingEntryId) {
      // Place entry in next match slot
      // Check if slot already occupied
      const [existing] = await tx
        .select()
        .from(tournamentMatchEntry)
        .where(
          and(
            eq(tournamentMatchEntry.matchId, edge.toMatchId),
            eq(tournamentMatchEntry.slot, edge.toSlot)
          )
        )
        .limit(1)

      if (!existing) {
        await tx.insert(tournamentMatchEntry).values({
          matchId: edge.toMatchId,
          entryId: advancingEntryId,
          slot: edge.toSlot,
        })
      }
    }
  }
}

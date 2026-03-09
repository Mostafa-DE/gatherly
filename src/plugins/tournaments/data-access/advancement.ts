import { and, eq, asc, desc } from "drizzle-orm"
import { db } from "@/db"
import {
  tournament,
  tournamentStage,
  tournamentGroup,
  tournamentRound,
  tournamentMatch,
  tournamentMatchEntry,
  tournamentStanding,
  tournamentEntry,
} from "../schema"
import { BadRequestError, NotFoundError } from "@/exceptions"
import { generateSwissRound } from "../brackets/swiss"
import { generateKnockoutFromGroups } from "../brackets/group-knockout"
import { createStagesWithRoundsAndMatches, updateStageStatus } from "./stages"
import { initializeStandings } from "./standings"
import type { BracketEntry } from "../brackets/types"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// =============================================================================
// Advance Swiss Round
// =============================================================================

export async function advanceSwissRound(
  tournamentId: string,
  organizationId: string
) {
  return db.transaction(async (tx) => {
    // 1. Get tournament
    const [t] = await tx
      .select()
      .from(tournament)
      .where(
        and(
          eq(tournament.id, tournamentId),
          eq(tournament.organizationId, organizationId)
        )
      )
      .limit(1)

    if (!t) throw new NotFoundError("Tournament not found")
    if (t.status !== "in_progress") {
      throw new BadRequestError("Tournament is not in progress")
    }
    if (t.format !== "swiss") {
      throw new BadRequestError("Only Swiss tournaments support round advancement")
    }

    // 2. Get swiss stage
    const [stage] = await tx
      .select()
      .from(tournamentStage)
      .where(
        and(
          eq(tournamentStage.tournamentId, tournamentId),
          eq(tournamentStage.stageType, "swiss")
        )
      )
      .limit(1)

    if (!stage) throw new NotFoundError("Swiss stage not found")

    const config = (stage.config ?? {}) as { swissRounds?: number }
    const maxRounds = config.swissRounds ?? 0

    // 3. Get current rounds and verify the latest is complete
    const rounds = await tx
      .select()
      .from(tournamentRound)
      .where(eq(tournamentRound.stageId, stage.id))
      .orderBy(asc(tournamentRound.roundNumber))

    const lastRound = rounds[rounds.length - 1]
    if (!lastRound) throw new BadRequestError("No rounds found")

    if (lastRound.status !== "completed") {
      throw new BadRequestError("Current round is not yet complete. Finish all matches first.")
    }

    const nextRoundNumber = lastRound.roundNumber + 1
    if (nextRoundNumber > maxRounds) {
      throw new BadRequestError(
        `All ${maxRounds} Swiss rounds have been played. Complete the stage instead.`
      )
    }

    // 4. Build standings from DB
    const standings = await tx
      .select()
      .from(tournamentStanding)
      .where(eq(tournamentStanding.stageId, stage.id))
      .orderBy(desc(tournamentStanding.points), asc(tournamentStanding.rank))

    // 5. Build opponents-played sets from match history
    const allMatchEntries = await getMatchEntriesByStage(tx, stage.id)
    const opponentsMap = buildOpponentsPlayedMap(allMatchEntries)

    // Also check for bye history
    const byeMatches = await getByeMatchEntriesByStage(tx, stage.id)
    for (const entry of byeMatches) {
      if (!opponentsMap.has(entry.entryId)) {
        opponentsMap.set(entry.entryId, new Set())
      }
      opponentsMap.get(entry.entryId)!.add("BYE")
    }

    // Get entry seeds
    const entries = await tx
      .select()
      .from(tournamentEntry)
      .where(eq(tournamentEntry.tournamentId, tournamentId))

    const seedMap = new Map<string, number>()
    for (const e of entries) {
      if (e.seed) seedMap.set(e.id, e.seed)
    }

    const swissStandings = standings.map((s) => ({
      entryId: s.entryId,
      seed: seedMap.get(s.entryId) ?? 999,
      points: s.points,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
      opponentsPlayed: opponentsMap.get(s.entryId) ?? new Set<string>(),
    }))

    // 6. Generate next round
    const generatedRound = generateSwissRound(swissStandings, nextRoundNumber)

    // 7. Insert round and matches into DB
    const [roundRow] = await tx
      .insert(tournamentRound)
      .values({
        organizationId,
        stageId: stage.id,
        roundNumber: nextRoundNumber,
        status: "pending",
      })
      .returning()

    for (const match of generatedRound.matches) {
      const [matchRow] = await tx
        .insert(tournamentMatch)
        .values({
          organizationId,
          tournamentId,
          roundId: roundRow.id,
          matchNumber: match.matchNumber,
          status: match.isBye ? "bye" : "pending",
        })
        .returning()

      for (const entry of match.entries) {
        if (entry.entryId) {
          await tx.insert(tournamentMatchEntry).values({
            matchId: matchRow.id,
            entryId: entry.entryId,
            slot: entry.slot,
          })
        }
      }

      // Auto-complete bye matches
      if (match.isBye) {
        const realEntry = match.entries.find((e) => e.entryId !== null)
        if (realEntry?.entryId) {
          await tx
            .update(tournamentMatch)
            .set({ winnerEntryId: realEntry.entryId, updatedAt: new Date() })
            .where(eq(tournamentMatch.id, matchRow.id))

          await tx
            .update(tournamentMatchEntry)
            .set({ result: "bye", updatedAt: new Date() })
            .where(
              and(
                eq(tournamentMatchEntry.matchId, matchRow.id),
                eq(tournamentMatchEntry.entryId, realEntry.entryId)
              )
            )
        }
      }
    }

    return { roundNumber: nextRoundNumber, matchCount: generatedRound.matches.length }
  })
}

// =============================================================================
// Advance Group Stage → Knockout
// =============================================================================

export async function advanceGroupStage(
  tournamentId: string,
  organizationId: string
) {
  return db.transaction(async (tx) => {
    // 1. Get tournament
    const [t] = await tx
      .select()
      .from(tournament)
      .where(
        and(
          eq(tournament.id, tournamentId),
          eq(tournament.organizationId, organizationId)
        )
      )
      .limit(1)

    if (!t) throw new NotFoundError("Tournament not found")
    if (t.status !== "in_progress") {
      throw new BadRequestError("Tournament is not in progress")
    }
    if (t.format !== "group_knockout") {
      throw new BadRequestError("Only group-knockout tournaments support group advancement")
    }

    // 2. Get group stage
    const [groupStage] = await tx
      .select()
      .from(tournamentStage)
      .where(
        and(
          eq(tournamentStage.tournamentId, tournamentId),
          eq(tournamentStage.stageType, "group")
        )
      )
      .limit(1)

    if (!groupStage) throw new NotFoundError("Group stage not found")
    if (groupStage.status !== "completed") {
      throw new BadRequestError("Group stage is not yet complete")
    }

    // 3. Get knockout stage (placeholder created at start)
    const [knockoutStage] = await tx
      .select()
      .from(tournamentStage)
      .where(
        and(
          eq(tournamentStage.tournamentId, tournamentId),
          eq(tournamentStage.stageType, "single_elimination")
        )
      )
      .limit(1)

    if (!knockoutStage) throw new NotFoundError("Knockout stage not found")
    if (knockoutStage.status !== "pending") {
      throw new BadRequestError("Knockout stage has already been generated")
    }

    const knockoutConfig = (knockoutStage.config ?? {}) as {
      advancePerGroup?: number
      thirdPlaceMatch?: boolean
    }
    const advancePerGroup = knockoutConfig.advancePerGroup ?? 2

    // 4. Get groups
    const groups = await tx
      .select()
      .from(tournamentGroup)
      .where(eq(tournamentGroup.stageId, groupStage.id))
      .orderBy(asc(tournamentGroup.groupOrder))

    // 5. Get standings per group and pick top N
    const advancingEntries: BracketEntry[] = []
    let seedCounter = 1

    for (const group of groups) {
      const groupStandings = await tx
        .select()
        .from(tournamentStanding)
        .where(
          and(
            eq(tournamentStanding.stageId, groupStage.id),
            eq(tournamentStanding.groupId, group.id)
          )
        )
        .orderBy(
          desc(tournamentStanding.points),
          desc(tournamentStanding.wins),
          asc(tournamentStanding.losses)
        )
        .limit(advancePerGroup)

      for (const standing of groupStandings) {
        advancingEntries.push({
          entryId: standing.entryId,
          seed: seedCounter++,
        })
      }
    }

    if (advancingEntries.length < 2) {
      throw new BadRequestError("Not enough entries advancing to create a knockout bracket")
    }

    // 6. Generate knockout bracket
    const knockout = generateKnockoutFromGroups(advancingEntries, {
      thirdPlaceMatch: knockoutConfig.thirdPlaceMatch,
    })

    // 7. Delete the placeholder knockout stage and recreate with actual bracket
    await tx
      .delete(tournamentStage)
      .where(eq(tournamentStage.id, knockoutStage.id))

    await createStagesWithRoundsAndMatches(
      tx,
      tournamentId,
      organizationId,
      knockout.stages.map((s) => ({
        ...s,
        stageOrder: knockoutStage.stageOrder,
      }))
    )

    // 8. Get newly created knockout stage and set to in_progress
    const [newKnockoutStage] = await tx
      .select()
      .from(tournamentStage)
      .where(
        and(
          eq(tournamentStage.tournamentId, tournamentId),
          eq(tournamentStage.stageType, "single_elimination")
        )
      )
      .limit(1)

    if (newKnockoutStage) {
      await updateStageStatus(tx, newKnockoutStage.id, "in_progress")

      // Initialize standings for knockout
      const entryIds = advancingEntries.map((e) => e.entryId)
      await initializeStandings(tx, organizationId, newKnockoutStage.id, entryIds)
    }

    return {
      advancingCount: advancingEntries.length,
      stageId: newKnockoutStage?.id,
    }
  })
}

// =============================================================================
// Helpers
// =============================================================================

async function getMatchEntriesByStage(tx: DbTransaction, stageId: string) {
  const rounds = await tx
    .select({ id: tournamentRound.id })
    .from(tournamentRound)
    .where(eq(tournamentRound.stageId, stageId))

  if (rounds.length === 0) return []

  const result: Array<{ matchId: string; entryId: string; slot: number }> = []
  for (const round of rounds) {
    const roundMatches = await tx
      .select({ id: tournamentMatch.id })
      .from(tournamentMatch)
      .where(eq(tournamentMatch.roundId, round.id))

    for (const match of roundMatches) {
      const entries = await tx
        .select()
        .from(tournamentMatchEntry)
        .where(eq(tournamentMatchEntry.matchId, match.id))

      for (const entry of entries) {
        if (entry.entryId) {
          result.push({
            matchId: match.id,
            entryId: entry.entryId,
            slot: entry.slot,
          })
        }
      }
    }
  }

  return result
}

function buildOpponentsPlayedMap(
  matchEntries: Array<{ matchId: string; entryId: string; slot: number }>
) {
  // Group by matchId
  const matchGroups = new Map<string, string[]>()
  for (const me of matchEntries) {
    if (!matchGroups.has(me.matchId)) {
      matchGroups.set(me.matchId, [])
    }
    matchGroups.get(me.matchId)!.push(me.entryId)
  }

  const opponentsMap = new Map<string, Set<string>>()
  for (const entries of matchGroups.values()) {
    for (const entryId of entries) {
      if (!opponentsMap.has(entryId)) {
        opponentsMap.set(entryId, new Set())
      }
      for (const opponentId of entries) {
        if (opponentId !== entryId) {
          opponentsMap.get(entryId)!.add(opponentId)
        }
      }
    }
  }

  return opponentsMap
}

async function getByeMatchEntriesByStage(tx: DbTransaction, stageId: string) {
  const result: Array<{ entryId: string }> = []

  const rounds = await tx
    .select({ id: tournamentRound.id })
    .from(tournamentRound)
    .where(eq(tournamentRound.stageId, stageId))

  for (const round of rounds) {
    const byeMatches = await tx
      .select({ id: tournamentMatch.id })
      .from(tournamentMatch)
      .where(
        and(
          eq(tournamentMatch.roundId, round.id),
          eq(tournamentMatch.status, "bye")
        )
      )

    for (const match of byeMatches) {
      const entries = await tx
        .select()
        .from(tournamentMatchEntry)
        .where(eq(tournamentMatchEntry.matchId, match.id))

      for (const entry of entries) {
        if (entry.entryId) {
          result.push({ entryId: entry.entryId })
        }
      }
    }
  }

  return result
}

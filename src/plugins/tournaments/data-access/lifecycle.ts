import { and, eq, ne, inArray } from "drizzle-orm"
import { db } from "@/db"
import { tournamentEntry, tournamentMatch, tournamentMatchEntry, tournamentRound, tournamentStage, tournamentGroup } from "../schema"
import { BadRequestError, NotFoundError } from "@/exceptions"
import { assertTournamentTransition } from "../state-machine"
import type { TournamentFormat, TournamentConfig, TournamentStatus } from "../types"
import { generateBracket } from "../brackets"
import type { BracketEntry } from "../brackets"
import { getTournamentByIdForUpdate, updateTournamentStatus } from "./tournaments"
import { setEntriesToActive } from "./entries"
import { createStagesWithRoundsAndMatches, updateStageStatus } from "./stages"
import { autoAdvanceByes, reportScore, forfeitMatch } from "./matches"
import { initializeStandings, updateStandingForEntry, recalculateRanks } from "./standings"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// =============================================================================
// Start Tournament
// =============================================================================

export async function startTournament(
  tournamentId: string,
  organizationId: string
) {
  return db.transaction(async (tx) => {
    // 1. Lock tournament
    const t = await getTournamentByIdForUpdate(tx, tournamentId, organizationId)
    if (!t) {
      throw new NotFoundError("Tournament not found")
    }

    assertTournamentTransition(t.status as TournamentStatus, "in_progress")

    // 2. Get eligible entries
    const entries = await tx
      .select()
      .from(tournamentEntry)
      .where(
        and(
          eq(tournamentEntry.tournamentId, tournamentId),
          ne(tournamentEntry.status, "withdrawn"),
          ne(tournamentEntry.status, "disqualified")
        )
      )
      .orderBy(tournamentEntry.seed)

    if (entries.length < 2) {
      throw new BadRequestError("Need at least 2 entries to start")
    }

    // 3. Validate all entries are seeded
    const unseeded = entries.filter((e) => e.seed === null)
    if (unseeded.length > 0) {
      throw new BadRequestError(
        `${unseeded.length} entries are not seeded. Seed all entries before starting.`
      )
    }

    // 4. Generate bracket
    const bracketEntries: BracketEntry[] = entries.map((e) => ({
      entryId: e.id,
      seed: e.seed!,
    }))

    const config = (t.config ?? {}) as TournamentConfig
    const bracket = generateBracket(t.format as TournamentFormat, {
      entries: bracketEntries,
      config: {
        thirdPlaceMatch: config.thirdPlaceMatch,
        groupCount: config.groupCount,
        advancePerGroup: config.advancePerGroup,
        swissRounds: config.swissRounds,
        bestOf: config.bestOf,
      },
    })

    // 5. Bulk insert stages, rounds, matches, edges
    await createStagesWithRoundsAndMatches(
      tx,
      tournamentId,
      organizationId,
      bracket.stages
    )

    // 6. Initialize standings for round-robin / swiss / group stages
    for (const stage of bracket.stages) {
      if (
        stage.stageType === "round_robin" ||
        stage.stageType === "swiss" ||
        stage.stageType === "group"
      ) {
        // Get stage ID from DB
        const [stageRow] = await tx
          .select()
          .from(tournamentStage)
          .where(
            and(
              eq(tournamentStage.tournamentId, tournamentId),
              eq(tournamentStage.stageOrder, stage.stageOrder)
            )
          )
          .limit(1)

        if (!stageRow) continue

        if (stage.stageType === "group") {
          // Initialize standings per group
          const groups = await tx
            .select()
            .from(tournamentGroup)
            .where(eq(tournamentGroup.stageId, stageRow.id))

          for (const group of groups) {
            // Get rounds for this group
            const groupRounds = await tx
              .select({ id: tournamentRound.id })
              .from(tournamentRound)
              .where(
                and(
                  eq(tournamentRound.stageId, stageRow.id),
                  eq(tournamentRound.groupId, group.id)
                )
              )

            if (groupRounds.length === 0) continue

            // Get unique entry IDs from matches in this group's rounds
            const roundIds = groupRounds.map((r) => r.id)
            const groupMatches = await tx
              .select({ id: tournamentMatch.id })
              .from(tournamentMatch)
              .where(inArray(tournamentMatch.roundId, roundIds))

            const matchIds = groupMatches.map((m) => m.id)
            if (matchIds.length === 0) continue

            const groupMatchEntries = await tx
              .select({ entryId: tournamentMatchEntry.entryId })
              .from(tournamentMatchEntry)
              .where(inArray(tournamentMatchEntry.matchId, matchIds))

            const groupEntryIds = [...new Set(groupMatchEntries.map((me) => me.entryId))]
            if (groupEntryIds.length > 0) {
              await initializeStandings(tx, organizationId, stageRow.id, groupEntryIds, group.id)
            }
          }
        } else {
          // round_robin / swiss: flat standings (no groups)
          const entryIds = entries.map((e) => e.id)
          await initializeStandings(tx, organizationId, stageRow.id, entryIds)
        }
      }
    }

    // 7. Set entries to active
    await setEntriesToActive(tx, tournamentId)

    // 8. Process byes
    await autoAdvanceByes(tx, tournamentId, organizationId)

    // 9. Set tournament to in_progress
    const updated = await updateTournamentStatus(
      tx,
      tournamentId,
      organizationId,
      "in_progress"
    )

    // 10. Set first stage to in_progress
    const [firstStage] = await tx
      .select()
      .from(tournamentStage)
      .where(eq(tournamentStage.tournamentId, tournamentId))
      .orderBy(tournamentStage.stageOrder)
      .limit(1)

    if (firstStage) {
      await updateStageStatus(tx, firstStage.id, "in_progress")
    }

    return updated
  })
}

// =============================================================================
// Complete Match (with progression + standing updates)
// =============================================================================

export async function completeMatch(
  tournamentId: string,
  organizationId: string,
  matchId: string,
  expectedVersion: number,
  data: {
    scores: Record<string, unknown>
    winnerEntryId: string
  }
) {
  return db.transaction(async (tx) => {
    // 1. Report score (locks match, validates, resolves edges)
    const match = await reportScore(
      tx,
      matchId,
      organizationId,
      tournamentId,
      expectedVersion,
      data
    )

    // 2. Update standings if applicable
    await updateMatchStandings(tx, match.roundId, data.winnerEntryId, matchId)

    // 3. Check round/stage/tournament completion
    await checkCompletionCascade(tx, tournamentId, organizationId, match.roundId)

    return match
  })
}

// =============================================================================
// Forfeit Match (with progression)
// =============================================================================

export async function forfeitAndProgress(
  tournamentId: string,
  organizationId: string,
  matchId: string,
  forfeitEntryId: string
) {
  return db.transaction(async (tx) => {
    const match = await forfeitMatch(tx, matchId, organizationId, tournamentId, forfeitEntryId)

    if (match.winnerEntryId) {
      await updateMatchStandings(tx, match.roundId, match.winnerEntryId, matchId)
    }

    await checkCompletionCascade(tx, tournamentId, organizationId, match.roundId)

    return match
  })
}

// =============================================================================
// Cancel Tournament
// =============================================================================

export async function cancelTournament(
  tournamentId: string,
  organizationId: string
) {
  return db.transaction(async (tx) => {
    const t = await getTournamentByIdForUpdate(tx, tournamentId, organizationId)
    if (!t) {
      throw new NotFoundError("Tournament not found")
    }

    assertTournamentTransition(t.status as TournamentStatus, "cancelled")

    return updateTournamentStatus(tx, tournamentId, organizationId, "cancelled")
  })
}

// =============================================================================
// Disqualify Entry (forfeit all remaining matches + progression)
// =============================================================================

export async function disqualifyAndForfeit(
  tournamentId: string,
  organizationId: string,
  entryId: string
) {
  return db.transaction(async (tx) => {
    // 1. Get and validate entry
    const { disqualifyEntry } = await import("./entries")
    const entry = await disqualifyEntry(entryId, organizationId, tournamentId, tx)

    // 2. Find all non-terminal matches for this entry
    const entryMatches = await tx
      .select({
        matchId: tournamentMatchEntry.matchId,
      })
      .from(tournamentMatchEntry)
      .where(eq(tournamentMatchEntry.entryId, entryId))

    if (entryMatches.length === 0) return entry

    const matchIds = entryMatches.map((em) => em.matchId)
    const matches = await tx
      .select()
      .from(tournamentMatch)
      .where(
        and(
          inArray(tournamentMatch.id, matchIds),
          eq(tournamentMatch.tournamentId, tournamentId)
        )
      )

    const nonTerminalMatches = matches.filter(
      (m) =>
        m.status !== "completed" &&
        m.status !== "forfeit" &&
        m.status !== "bye" &&
        m.status !== "cancelled"
    )

    // 3. Forfeit each non-terminal match and cascade
    for (const match of nonTerminalMatches) {
      const result = await forfeitMatch(
        tx,
        match.id,
        organizationId,
        tournamentId,
        entryId
      )

      if (result.winnerEntryId) {
        await updateMatchStandings(tx, result.roundId, result.winnerEntryId, match.id)
      }

      await checkCompletionCascade(tx, tournamentId, organizationId, result.roundId)
    }

    return entry
  })
}

// =============================================================================
// Internal helpers
// =============================================================================

async function updateMatchStandings(
  tx: DbTransaction,
  roundId: string,
  winnerEntryId: string,
  matchId: string
) {
  // Get the round's stage
  const [round] = await tx
    .select()
    .from(tournamentRound)
    .where(eq(tournamentRound.id, roundId))
    .limit(1)

  if (!round) return

  const [stage] = await tx
    .select()
    .from(tournamentStage)
    .where(eq(tournamentStage.id, round.stageId))
    .limit(1)

  if (!stage) return

  // Only update standings for formats that use them
  if (
    stage.stageType !== "round_robin" &&
    stage.stageType !== "swiss" &&
    stage.stageType !== "group"
  ) {
    return
  }

  // Get match entries to find loser
  const { tournamentMatchEntry } = await import("../schema")
  const matchEntries = await tx
    .select()
    .from(tournamentMatchEntry)
    .where(eq(tournamentMatchEntry.matchId, matchId))

  const config = (stage.config ?? {}) as { points?: { win: number; loss: number; draw: number } }
  const pointsConfig = config.points ?? { win: 3, loss: 0, draw: 1 }

  for (const me of matchEntries) {
    if (me.entryId === winnerEntryId) {
      await updateStandingForEntry(
        tx,
        stage.id,
        me.entryId,
        { wins: 1, points: pointsConfig.win },
        round.groupId ?? undefined
      )
    } else {
      await updateStandingForEntry(
        tx,
        stage.id,
        me.entryId,
        { losses: 1, points: pointsConfig.loss },
        round.groupId ?? undefined
      )
    }
  }

  // Recalculate ranks
  await recalculateRanks(tx, stage.id, round.groupId ?? undefined)
}

async function checkCompletionCascade(
  tx: DbTransaction,
  tournamentId: string,
  organizationId: string,
  roundId: string
) {
  // Check if all matches in round are complete
  const roundMatches = await tx
    .select()
    .from(tournamentMatch)
    .where(eq(tournamentMatch.roundId, roundId))

  const allComplete = roundMatches.every(
    (m) =>
      m.status === "completed" ||
      m.status === "forfeit" ||
      m.status === "bye" ||
      m.status === "cancelled"
  )

  if (!allComplete) return

  // Mark round as completed
  await tx
    .update(tournamentRound)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(tournamentRound.id, roundId))

  // Get stage
  const [round] = await tx
    .select()
    .from(tournamentRound)
    .where(eq(tournamentRound.id, roundId))
    .limit(1)

  if (!round) return

  const [stage] = await tx
    .select()
    .from(tournamentStage)
    .where(eq(tournamentStage.id, round.stageId))
    .limit(1)

  if (!stage) return

  // Check if all rounds in stage are complete
  const stageRounds = await tx
    .select()
    .from(tournamentRound)
    .where(eq(tournamentRound.stageId, round.stageId))

  const stageComplete = stageRounds.every(
    (r) => r.status === "completed" || r.status === "cancelled"
  )

  if (stageComplete) {
    if (stage.stageType === "swiss") {
      const config = (stage.config ?? {}) as { swissRounds?: number }
      const maxRounds = config.swissRounds ?? 0

      if (maxRounds > 0 && stageRounds.length < maxRounds) {
        return
      }
    }

    await updateStageStatus(tx, round.stageId, "completed")

    // Check if all stages are complete
    const stages = await tx
      .select()
      .from(tournamentStage)
      .where(eq(tournamentStage.tournamentId, tournamentId))

    const allStagesComplete = stages.every(
      (s) => s.status === "completed" || s.status === "cancelled"
    )

    if (allStagesComplete) {
      await updateTournamentStatus(tx, tournamentId, organizationId, "completed")
    } else {
      // Start next stage
      const nextStage = stages
        .filter((s) => s.status === "pending")
        .sort((a, b) => a.stageOrder - b.stageOrder)[0]

      const shouldAutoStartNextStage = !(
        stage.stageType === "group" && nextStage?.stageType === "single_elimination"
      )

      if (nextStage && shouldAutoStartNextStage) {
        await updateStageStatus(tx, nextStage.id, "in_progress")
      }
    }
  }
}

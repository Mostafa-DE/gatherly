import { eq, asc, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  tournamentStage,
  tournamentGroup,
  tournamentRound,
  tournamentMatch,
  tournamentMatchEdge,
  tournamentMatchEntry,
} from "../schema"
import type { GeneratedStage } from "../brackets/types"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

// =============================================================================
// Queries
// =============================================================================

export async function getStagesByTournament(tournamentId: string) {
  return db
    .select()
    .from(tournamentStage)
    .where(eq(tournamentStage.tournamentId, tournamentId))
    .orderBy(asc(tournamentStage.stageOrder))
}

export async function getFullBracket(tournamentId: string) {
  const stages = await getStagesByTournament(tournamentId)
  if (stages.length === 0) {
    return { stages: [], groups: [], rounds: [], matches: [], matchEntries: [], edges: [] }
  }

  const stageIds = stages.map((s) => s.id)

  const groups = await db
    .select()
    .from(tournamentGroup)
    .where(inArray(tournamentGroup.stageId, stageIds))
    .orderBy(asc(tournamentGroup.groupOrder))

  const rounds = await db
    .select()
    .from(tournamentRound)
    .where(inArray(tournamentRound.stageId, stageIds))
    .orderBy(asc(tournamentRound.roundNumber))

  const matches = await db
    .select()
    .from(tournamentMatch)
    .where(eq(tournamentMatch.tournamentId, tournamentId))
    .orderBy(asc(tournamentMatch.matchNumber))

  if (matches.length === 0) {
    return { stages, groups, rounds, matches: [], matchEntries: [], edges: [] }
  }

  const matchIds = matches.map((m) => m.id)

  const matchEntries = await db
    .select()
    .from(tournamentMatchEntry)
    .where(inArray(tournamentMatchEntry.matchId, matchIds))
    .orderBy(asc(tournamentMatchEntry.slot))

  const edges = await db
    .select()
    .from(tournamentMatchEdge)
    .where(inArray(tournamentMatchEdge.fromMatchId, matchIds))

  return { stages, groups, rounds, matches, matchEntries, edges }
}

// =============================================================================
// Bulk insert (used by lifecycle.startTournament)
// =============================================================================

export async function createStagesWithRoundsAndMatches(
  tx: DbTransaction,
  tournamentId: string,
  organizationId: string,
  stages: GeneratedStage[]
) {
  const matchNumberToId = new Map<number, string>()

  for (const stage of stages) {
    // Insert stage
    const [stageRow] = await tx
      .insert(tournamentStage)
      .values({
        organizationId,
        tournamentId,
        stageType: stage.stageType,
        stageOrder: stage.stageOrder,
        status: "pending",
        config: stage.config,
      })
      .returning()

    // Insert groups if present
    const groupIdMap = new Map<number, string>()
    if (stage.groups) {
      for (const group of stage.groups) {
        const [groupRow] = await tx
          .insert(tournamentGroup)
          .values({
            stageId: stageRow.id,
            name: group.name,
            groupOrder: group.groupOrder,
          })
          .returning()
        groupIdMap.set(group.groupOrder - 1, groupRow.id) // 0-indexed
      }
    }

    // Insert rounds and matches
    const roundMap = new Map<string, string>() // "roundNum-groupIdx" -> roundId

    for (const round of stage.rounds) {
      const roundKey = `${round.roundNumber}-${round.groupIndex ?? "none"}`
      let roundId = roundMap.get(roundKey)

      if (!roundId) {
        const groupId = round.groupIndex !== undefined
          ? groupIdMap.get(round.groupIndex) ?? null
          : null

        const [roundRow] = await tx
          .insert(tournamentRound)
          .values({
            organizationId,
            stageId: stageRow.id,
            groupId,
            roundNumber: round.roundNumber,
            status: "pending",
          })
          .returning()

        roundId = roundRow.id
        roundMap.set(roundKey, roundId)
      }

      // Insert matches
      for (const match of round.matches) {
        const [matchRow] = await tx
          .insert(tournamentMatch)
          .values({
            organizationId,
            tournamentId,
            roundId,
            matchNumber: match.matchNumber,
            status: match.isBye ? "bye" : "pending",
          })
          .returning()

        matchNumberToId.set(match.matchNumber, matchRow.id)

        // Insert match entries (for pre-seeded first-round matches)
        for (const entry of match.entries) {
          if (entry.entryId) {
            await tx.insert(tournamentMatchEntry).values({
              matchId: matchRow.id,
              entryId: entry.entryId,
              slot: entry.slot,
            })
          }
        }
      }
    }

    // Insert edges
    for (const edge of stage.edges) {
      const fromMatchId = matchNumberToId.get(edge.fromMatchNumber)
      const toMatchId = matchNumberToId.get(edge.toMatchNumber)

      if (fromMatchId && toMatchId) {
        await tx.insert(tournamentMatchEdge).values({
          fromMatchId,
          toMatchId,
          outcomeType: edge.outcomeType,
          outcomeRank: edge.outcomeRank,
          toSlot: edge.toSlot,
        })
      }
    }
  }

  return matchNumberToId
}

export async function updateStageStatus(
  tx: DbTransaction,
  stageId: string,
  status: string
) {
  const [result] = await tx
    .update(tournamentStage)
    .set({ status, updatedAt: new Date() })
    .where(eq(tournamentStage.id, stageId))
    .returning()
  return result
}

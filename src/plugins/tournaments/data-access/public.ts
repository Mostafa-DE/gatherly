import { and, asc, desc, eq, inArray } from "drizzle-orm"
import { user } from "@/db/auth-schema"
import { db } from "@/db"
import {
  tournamentEntry,
  tournamentGroup,
  tournamentMatch,
  tournamentMatchEdge,
  tournamentMatchEntry,
  tournamentRound,
  tournamentStage,
  tournamentStanding,
  tournamentTeam,
} from "../schema"

const publicEntryColumns = {
  id: tournamentEntry.id,
  tournamentId: tournamentEntry.tournamentId,
  userId: tournamentEntry.userId,
  teamId: tournamentEntry.teamId,
  status: tournamentEntry.status,
  seed: tournamentEntry.seed,
  finalPlacement: tournamentEntry.finalPlacement,
} as const

const publicStageColumns = {
  id: tournamentStage.id,
  tournamentId: tournamentStage.tournamentId,
  stageType: tournamentStage.stageType,
  stageOrder: tournamentStage.stageOrder,
  status: tournamentStage.status,
} as const

const publicGroupColumns = {
  id: tournamentGroup.id,
  stageId: tournamentGroup.stageId,
  name: tournamentGroup.name,
  groupOrder: tournamentGroup.groupOrder,
} as const

const publicRoundColumns = {
  id: tournamentRound.id,
  stageId: tournamentRound.stageId,
  groupId: tournamentRound.groupId,
  roundNumber: tournamentRound.roundNumber,
  status: tournamentRound.status,
} as const

const publicMatchColumns = {
  id: tournamentMatch.id,
  tournamentId: tournamentMatch.tournamentId,
  roundId: tournamentMatch.roundId,
  matchNumber: tournamentMatch.matchNumber,
  status: tournamentMatch.status,
  scores: tournamentMatch.scores,
  winnerEntryId: tournamentMatch.winnerEntryId,
  scheduledAt: tournamentMatch.scheduledAt,
} as const

const publicMatchEntryColumns = {
  id: tournamentMatchEntry.id,
  matchId: tournamentMatchEntry.matchId,
  entryId: tournamentMatchEntry.entryId,
  slot: tournamentMatchEntry.slot,
  result: tournamentMatchEntry.result,
  score: tournamentMatchEntry.score,
} as const

const publicMatchEdgeColumns = {
  id: tournamentMatchEdge.id,
  fromMatchId: tournamentMatchEdge.fromMatchId,
  toMatchId: tournamentMatchEdge.toMatchId,
  outcomeType: tournamentMatchEdge.outcomeType,
  outcomeRank: tournamentMatchEdge.outcomeRank,
  toSlot: tournamentMatchEdge.toSlot,
} as const

const publicStandingColumns = {
  id: tournamentStanding.id,
  stageId: tournamentStanding.stageId,
  groupId: tournamentStanding.groupId,
  entryId: tournamentStanding.entryId,
  rank: tournamentStanding.rank,
  wins: tournamentStanding.wins,
  losses: tournamentStanding.losses,
  draws: tournamentStanding.draws,
  points: tournamentStanding.points,
  tiebreakers: tournamentStanding.tiebreakers,
} as const

async function getPublicEntrySummariesByIds(
  tournamentId: string,
  entryIds: string[]
) {
  if (entryIds.length === 0) return []

  return db
    .select({
      ...publicEntryColumns,
      participantType: tournamentEntry.userId,
      participantName: user.name,
      participantImage: user.image,
      teamName: tournamentTeam.name,
    })
    .from(tournamentEntry)
    .leftJoin(user, eq(tournamentEntry.userId, user.id))
    .leftJoin(tournamentTeam, eq(tournamentEntry.teamId, tournamentTeam.id))
    .where(
      and(
        eq(tournamentEntry.tournamentId, tournamentId),
        inArray(tournamentEntry.id, entryIds)
      )
    )
    .orderBy(asc(tournamentEntry.seed), asc(tournamentEntry.createdAt))
    .then((rows) =>
      rows.map((row) => ({
        ...row,
        participantType: row.participantType ? "individual" : "team",
        participantName: row.participantName ?? row.teamName ?? "Unknown participant",
        participantImage: row.participantImage ?? null,
      }))
    )
}

export async function getPublicBracket(tournamentId: string) {
  const stages = await db
    .select(publicStageColumns)
    .from(tournamentStage)
    .where(eq(tournamentStage.tournamentId, tournamentId))
    .orderBy(asc(tournamentStage.stageOrder))

  if (stages.length === 0) {
    return {
      stages: [],
      groups: [],
      rounds: [],
      matches: [],
      matchEntries: [],
      edges: [],
      entries: [],
    }
  }

  const stageIds = stages.map((stage) => stage.id)

  const groups = await db
    .select(publicGroupColumns)
    .from(tournamentGroup)
    .where(inArray(tournamentGroup.stageId, stageIds))
    .orderBy(asc(tournamentGroup.groupOrder))

  const rounds = await db
    .select(publicRoundColumns)
    .from(tournamentRound)
    .where(inArray(tournamentRound.stageId, stageIds))
    .orderBy(asc(tournamentRound.roundNumber))

  const matches = await db
    .select(publicMatchColumns)
    .from(tournamentMatch)
    .where(eq(tournamentMatch.tournamentId, tournamentId))
    .orderBy(asc(tournamentMatch.matchNumber))

  if (matches.length === 0) {
    return {
      stages,
      groups,
      rounds,
      matches: [],
      matchEntries: [],
      edges: [],
      entries: [],
    }
  }

  const matchIds = matches.map((match) => match.id)

  const matchEntries = await db
    .select(publicMatchEntryColumns)
    .from(tournamentMatchEntry)
    .where(inArray(tournamentMatchEntry.matchId, matchIds))
    .orderBy(asc(tournamentMatchEntry.slot))

  const edges = await db
    .select(publicMatchEdgeColumns)
    .from(tournamentMatchEdge)
    .where(inArray(tournamentMatchEdge.fromMatchId, matchIds))

  const entryIds = [...new Set(matchEntries.map((entry) => entry.entryId))]
  const entries = await getPublicEntrySummariesByIds(tournamentId, entryIds)

  return { stages, groups, rounds, matches, matchEntries, edges, entries }
}

export async function getPublicStandings(
  tournamentId: string,
  stageId?: string,
  groupId?: string
) {
  const stages = await db
    .select(publicStageColumns)
    .from(tournamentStage)
    .where(eq(tournamentStage.tournamentId, tournamentId))
    .orderBy(asc(tournamentStage.stageOrder))

  const stage = stageId
    ? stages.find((item) => item.id === stageId) ?? null
    : stages[0] ?? null

  if (!stage) {
    return { stage: null, groups: [], standings: [], entries: [] }
  }

  const groups = await db
    .select(publicGroupColumns)
    .from(tournamentGroup)
    .where(eq(tournamentGroup.stageId, stage.id))
    .orderBy(asc(tournamentGroup.groupOrder))

  const conditions = [eq(tournamentStanding.stageId, stage.id)]
  if (groupId) {
    conditions.push(eq(tournamentStanding.groupId, groupId))
  }

  const standings = await db
    .select(publicStandingColumns)
    .from(tournamentStanding)
    .where(and(...conditions))
    .orderBy(
      asc(tournamentStanding.rank),
      desc(tournamentStanding.points),
      desc(tournamentStanding.wins),
      asc(tournamentStanding.losses)
    )

  const entryIds = [...new Set(standings.map((standing) => standing.entryId))]
  const entries = await getPublicEntrySummariesByIds(tournamentId, entryIds)

  return { stage, groups, standings, entries }
}

export async function getPublicMatch(
  tournamentId: string,
  matchId: string
) {
  const [match] = await db
    .select(publicMatchColumns)
    .from(tournamentMatch)
    .where(
      and(
        eq(tournamentMatch.id, matchId),
        eq(tournamentMatch.tournamentId, tournamentId)
      )
    )
    .limit(1)

  if (!match) {
    return null
  }

  const [round] = await db
    .select(publicRoundColumns)
    .from(tournamentRound)
    .where(eq(tournamentRound.id, match.roundId))
    .limit(1)

  const [stage] = round
    ? await db
        .select(publicStageColumns)
        .from(tournamentStage)
        .where(eq(tournamentStage.id, round.stageId))
        .limit(1)
    : [null]

  const [group] = round?.groupId
    ? await db
        .select(publicGroupColumns)
        .from(tournamentGroup)
        .where(eq(tournamentGroup.id, round.groupId))
        .limit(1)
    : [null]

  const matchEntries = await db
    .select(publicMatchEntryColumns)
    .from(tournamentMatchEntry)
    .where(eq(tournamentMatchEntry.matchId, match.id))
    .orderBy(asc(tournamentMatchEntry.slot))

  const entryIds = [...new Set(matchEntries.map((entry) => entry.entryId))]
  const entries = await getPublicEntrySummariesByIds(tournamentId, entryIds)

  return {
    stage: stage ?? null,
    group: group ?? null,
    round: round ?? null,
    match,
    matchEntries,
    entries,
  }
}

import { and, eq, ne, inArray } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/auth-schema"
import { tournament, tournamentEntry, tournamentTeam } from "../schema"
import { BadRequestError, NotFoundError } from "@/exceptions"
import { generateBracket } from "../brackets"
import type { BracketEntry } from "../brackets"
import type { TournamentFormat, TournamentConfig } from "../types"

// =============================================================================
// Types
// =============================================================================

export type PreviewParticipant = {
  slot: number
  entryId: string | null
  seed: number | null
  name: string | null
  userId: string | null
}

export type PreviewMatch = {
  matchNumber: number
  roundNumber: number
  groupIndex?: number
  isBye: boolean
  participants: PreviewParticipant[]
}

export type PreviewRound = {
  roundNumber: number
  groupIndex?: number
  matches: PreviewMatch[]
}

export type PreviewStage = {
  stageType: string
  stageOrder: number
  groups?: Array<{ name: string; groupOrder: number }>
  rounds: PreviewRound[]
}

export type BracketPreviewResult = {
  totalEntries: number
  totalRounds: number
  byeCount: number
  stages: PreviewStage[]
}

// =============================================================================
// Preview Bracket
// =============================================================================

export async function previewBracket(
  tournamentId: string,
  organizationId: string
): Promise<BracketPreviewResult> {
  // 1. Get tournament
  const [t] = await db
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

  if (t.status === "in_progress" || t.status === "completed" || t.status === "cancelled") {
    throw new BadRequestError("Tournament already started. Use the bracket tab to view the live bracket.")
  }

  // 2. Get eligible entries (same filter as startTournament in lifecycle.ts)
  const entries = await db
    .select({
      id: tournamentEntry.id,
      seed: tournamentEntry.seed,
      userId: tournamentEntry.userId,
      teamId: tournamentEntry.teamId,
    })
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
    throw new BadRequestError("Need at least 2 entries to preview bracket")
  }

  const unseeded = entries.filter((e) => e.seed === null)
  if (unseeded.length > 0) {
    throw new BadRequestError(
      `${unseeded.length} entries are not seeded. Seed all entries before previewing.`
    )
  }

  // 3. Build name lookup (batch queries, no N+1)
  const userIds = entries.map((e) => e.userId).filter(Boolean) as string[]
  const teamIds = entries.map((e) => e.teamId).filter(Boolean) as string[]

  const nameMap = new Map<string, string>()

  if (userIds.length > 0) {
    const users = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(inArray(user.id, userIds))

    const userNameMap = new Map(users.map((u) => [u.id, u.name]))
    for (const entry of entries) {
      if (entry.userId && userNameMap.has(entry.userId)) {
        nameMap.set(entry.id, userNameMap.get(entry.userId)!)
      }
    }
  }

  if (teamIds.length > 0) {
    const teams = await db
      .select({ id: tournamentTeam.id, name: tournamentTeam.name })
      .from(tournamentTeam)
      .where(inArray(tournamentTeam.id, teamIds))

    const teamNameMap = new Map(teams.map((t) => [t.id, t.name]))
    for (const entry of entries) {
      if (entry.teamId && teamNameMap.has(entry.teamId)) {
        nameMap.set(entry.id, teamNameMap.get(entry.teamId)!)
      }
    }
  }

  // 4. Build bracket entries and seed-to-entry map
  const bracketEntries: BracketEntry[] = entries.map((e) => ({
    entryId: e.id,
    seed: e.seed!,
  }))

  const entryMap = new Map<string, { seed: number; name: string; userId: string | null }>(
    entries.map((e) => [
      e.id,
      { seed: e.seed!, name: nameMap.get(e.id) ?? "Unknown", userId: e.userId },
    ])
  )

  // 5. Generate bracket in-memory (pure function, no DB writes)
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

  // 6. Transform to preview format
  let totalRounds = 0
  let byeCount = 0

  const stages: PreviewStage[] = bracket.stages.map((stage) => {
    const roundsMap = new Map<string, PreviewRound>()

    for (const round of stage.rounds) {
      const key = `${round.roundNumber}-${round.groupIndex ?? ""}`
      if (!roundsMap.has(key)) {
        roundsMap.set(key, {
          roundNumber: round.roundNumber,
          groupIndex: round.groupIndex,
          matches: [],
        })
      }

      const previewRound = roundsMap.get(key)!

      for (const match of round.matches) {
        if (match.isBye) byeCount++

        const participants: PreviewParticipant[] = match.entries.map((me) => {
          const entry = me.entryId ? entryMap.get(me.entryId) : null
          return {
            slot: me.slot,
            entryId: me.entryId,
            seed: entry?.seed ?? null,
            name: entry?.name ?? null,
            userId: entry?.userId ?? null,
          }
        })

        previewRound.matches.push({
          matchNumber: match.matchNumber,
          roundNumber: match.roundNumber,
          groupIndex: match.groupIndex,
          isBye: match.isBye,
          participants,
        })
      }
    }

    const rounds = [...roundsMap.values()].sort((a, b) => a.roundNumber - b.roundNumber)
    const maxRound = rounds.length > 0 ? Math.max(...rounds.map((r) => r.roundNumber)) : 0
    if (maxRound > totalRounds) totalRounds = maxRound

    return {
      stageType: stage.stageType,
      stageOrder: stage.stageOrder,
      groups: stage.groups,
      rounds,
    }
  })

  return {
    totalEntries: entries.length,
    totalRounds,
    byeCount,
    stages,
  }
}

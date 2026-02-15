import { eq, and, desc } from "drizzle-orm"
import { db } from "@/db"
import { matchRecord, memberRank } from "@/plugins/ranking/schema"
import { user } from "@/db/auth-schema"
import { getDomain } from "@/plugins/ranking/domains"
import type { MatchRecord, MemberRank } from "@/db/types"
import { TRPCError } from "@trpc/server"

type RecordMatchInput = {
  organizationId: string
  rankingDefinitionId: string
  domainId: string
  sessionId: string
  matchFormat: string
  team1: string[]
  team2: string[]
  scores: unknown
  recordedBy: string
  notes?: string
}

export async function recordMatch(
  input: RecordMatchInput
): Promise<{ match: MatchRecord; updatedRanks: MemberRank[] }> {
  const domain = getDomain(input.domainId)
  if (!domain?.matchConfig) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Domain "${input.domainId}" does not support matches`,
    })
  }

  // Validate scores
  const validation = domain.matchConfig.validateScores(input.scores)
  if (!validation.isValid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.error ?? "Invalid scores",
    })
  }

  // Resolve match
  const result = domain.matchConfig.resolveMatch(input.scores)

  // Build per-player stats map
  const derivedStats: Record<string, Record<string, number>> = {}
  for (const userId of input.team1) {
    derivedStats[userId] = { ...result.team1Stats }
  }
  for (const userId of input.team2) {
    derivedStats[userId] = { ...result.team2Stats }
  }

  return db.transaction(async (tx) => {
    // 1. Insert match record
    const [match] = await tx
      .insert(matchRecord)
      .values({
        organizationId: input.organizationId,
        rankingDefinitionId: input.rankingDefinitionId,
        sessionId: input.sessionId,
        matchFormat: input.matchFormat,
        team1: input.team1,
        team2: input.team2,
        scores: input.scores,
        winner: result.winner,
        derivedStats,
        recordedBy: input.recordedBy,
        notes: input.notes ?? null,
      })
      .returning()

    // 2. Upsert memberRank for each player
    const allPlayers = [...input.team1, ...input.team2]
    const updatedRanks: MemberRank[] = []

    for (const userId of allPlayers) {
      const playerStats = derivedStats[userId]

      const [existing] = await tx
        .select()
        .from(memberRank)
        .where(
          and(
            eq(memberRank.rankingDefinitionId, input.rankingDefinitionId),
            eq(memberRank.userId, userId)
          )
        )
        .limit(1)

      if (existing) {
        const currentStats = (existing.stats as Record<string, number>) ?? {}
        const newStats = { ...currentStats }
        for (const [key, value] of Object.entries(playerStats)) {
          newStats[key] = (newStats[key] ?? 0) + value
        }

        const [updated] = await tx
          .update(memberRank)
          .set({
            stats: newStats,
            lastActivityAt: new Date(),
          })
          .where(eq(memberRank.id, existing.id))
          .returning()
        updatedRanks.push(updated)
      } else {
        const [created] = await tx
          .insert(memberRank)
          .values({
            organizationId: input.organizationId,
            rankingDefinitionId: input.rankingDefinitionId,
            userId,
            stats: playerStats,
            lastActivityAt: new Date(),
          })
          .returning()
        updatedRanks.push(created)
      }
    }

    return { match, updatedRanks }
  })
}

export async function listMatchesBySession(
  rankingDefinitionId: string,
  sessionId: string
) {
  return db
    .select({
      id: matchRecord.id,
      matchFormat: matchRecord.matchFormat,
      team1: matchRecord.team1,
      team2: matchRecord.team2,
      scores: matchRecord.scores,
      winner: matchRecord.winner,
      derivedStats: matchRecord.derivedStats,
      notes: matchRecord.notes,
      createdAt: matchRecord.createdAt,
      recordedByName: user.name,
    })
    .from(matchRecord)
    .innerJoin(user, eq(matchRecord.recordedBy, user.id))
    .where(
      and(
        eq(matchRecord.rankingDefinitionId, rankingDefinitionId),
        eq(matchRecord.sessionId, sessionId)
      )
    )
    .orderBy(desc(matchRecord.createdAt))
}

type CorrectMatchInput = RecordMatchInput & {
  matchId: string
}

export async function correctMatch(
  input: CorrectMatchInput
): Promise<{ match: MatchRecord; updatedRanks: MemberRank[] }> {
  const domain = getDomain(input.domainId)
  if (!domain?.matchConfig) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Domain "${input.domainId}" does not support matches`,
    })
  }

  // Validate new scores
  const validation = domain.matchConfig.validateScores(input.scores)
  if (!validation.isValid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: validation.error ?? "Invalid scores",
    })
  }

  // Resolve new match
  const result = domain.matchConfig.resolveMatch(input.scores)

  // Build new per-player stats
  const newDerivedStats: Record<string, Record<string, number>> = {}
  for (const userId of input.team1) {
    newDerivedStats[userId] = { ...result.team1Stats }
  }
  for (const userId of input.team2) {
    newDerivedStats[userId] = { ...result.team2Stats }
  }

  return db.transaction(async (tx) => {
    // 1. Fetch old match
    const [oldMatch] = await tx
      .select()
      .from(matchRecord)
      .where(
        and(
          eq(matchRecord.id, input.matchId),
          eq(matchRecord.organizationId, input.organizationId)
        )
      )
      .limit(1)

    if (!oldMatch) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Match not found",
      })
    }

    // 2. Reverse old stats from memberRanks
    const oldDerivedStats = oldMatch.derivedStats as Record<string, Record<string, number>>
    const oldPlayers = [
      ...((oldMatch.team1 as string[]) ?? []),
      ...((oldMatch.team2 as string[]) ?? []),
    ]

    for (const userId of oldPlayers) {
      const playerOldStats = oldDerivedStats[userId]
      if (!playerOldStats) continue

      const [existing] = await tx
        .select()
        .from(memberRank)
        .where(
          and(
            eq(memberRank.rankingDefinitionId, oldMatch.rankingDefinitionId),
            eq(memberRank.userId, userId)
          )
        )
        .limit(1)

      if (existing) {
        const currentStats = (existing.stats as Record<string, number>) ?? {}
        const reversedStats = { ...currentStats }
        for (const [key, value] of Object.entries(playerOldStats)) {
          reversedStats[key] = (reversedStats[key] ?? 0) - value
        }

        await tx
          .update(memberRank)
          .set({ stats: reversedStats })
          .where(eq(memberRank.id, existing.id))
      }
    }

    // 3. Delete old match
    await tx.delete(matchRecord).where(eq(matchRecord.id, input.matchId))

    // 4. Insert new match
    const [match] = await tx
      .insert(matchRecord)
      .values({
        organizationId: input.organizationId,
        rankingDefinitionId: input.rankingDefinitionId,
        sessionId: input.sessionId,
        matchFormat: input.matchFormat,
        team1: input.team1,
        team2: input.team2,
        scores: input.scores,
        winner: result.winner,
        derivedStats: newDerivedStats,
        recordedBy: input.recordedBy,
        notes: input.notes ?? null,
      })
      .returning()

    // 5. Accumulate new stats into memberRanks
    const allNewPlayers = [...input.team1, ...input.team2]
    const updatedRanks: MemberRank[] = []

    for (const userId of allNewPlayers) {
      const playerStats = newDerivedStats[userId]

      const [existing] = await tx
        .select()
        .from(memberRank)
        .where(
          and(
            eq(memberRank.rankingDefinitionId, input.rankingDefinitionId),
            eq(memberRank.userId, userId)
          )
        )
        .limit(1)

      if (existing) {
        const currentStats = (existing.stats as Record<string, number>) ?? {}
        const newStats = { ...currentStats }
        for (const [key, value] of Object.entries(playerStats)) {
          newStats[key] = (newStats[key] ?? 0) + value
        }

        const [updated] = await tx
          .update(memberRank)
          .set({
            stats: newStats,
            lastActivityAt: new Date(),
          })
          .where(eq(memberRank.id, existing.id))
          .returning()
        updatedRanks.push(updated)
      } else {
        const [created] = await tx
          .insert(memberRank)
          .values({
            organizationId: input.organizationId,
            rankingDefinitionId: input.rankingDefinitionId,
            userId,
            stats: playerStats,
            lastActivityAt: new Date(),
          })
          .returning()
        updatedRanks.push(created)
      }
    }

    return { match, updatedRanks }
  })
}

export async function listMatchesByDefinition(
  rankingDefinitionId: string,
  options: { limit?: number; offset?: number } = {}
) {
  const { limit = 20, offset = 0 } = options

  return db
    .select({
      id: matchRecord.id,
      matchFormat: matchRecord.matchFormat,
      team1: matchRecord.team1,
      team2: matchRecord.team2,
      scores: matchRecord.scores,
      winner: matchRecord.winner,
      derivedStats: matchRecord.derivedStats,
      sessionId: matchRecord.sessionId,
      notes: matchRecord.notes,
      createdAt: matchRecord.createdAt,
      recordedByName: user.name,
    })
    .from(matchRecord)
    .innerJoin(user, eq(matchRecord.recordedBy, user.id))
    .where(eq(matchRecord.rankingDefinitionId, rankingDefinitionId))
    .orderBy(desc(matchRecord.createdAt))
    .limit(limit)
    .offset(offset)
}

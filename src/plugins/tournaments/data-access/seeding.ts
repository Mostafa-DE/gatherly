import { and, eq, ne, sql } from "drizzle-orm"
import { db } from "@/db"
import { tournament, tournamentEntry } from "../schema"
import { BadRequestError, NotFoundError } from "@/exceptions"
import { getLeaderboard } from "@/plugins/ranking/data-access/member-ranks"
import { getRankingDefinitionById } from "@/plugins/ranking/data-access/ranking-definitions"
// =============================================================================
// Seed from Ranking
// =============================================================================

export async function seedFromRanking(
  tournamentId: string,
  organizationId: string,
  rankingDefinitionId: string,
  options?: { includeStats?: boolean }
) {
  return db.transaction(async (tx) => {
    // Get tournament
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
    if (t.status !== "draft" && t.status !== "registration" && t.status !== "check_in") {
      throw new BadRequestError("Cannot change seeds after tournament has started")
    }

    // Validate ranking definition belongs to same activity
    const definition = await getRankingDefinitionById(rankingDefinitionId, t.organizationId)
    if (!definition) {
      throw new NotFoundError("Ranking definition not found")
    }
    if (definition.activityId !== t.activityId) {
      throw new BadRequestError("Ranking definition does not belong to this tournament's activity")
    }

    // Get eligible entries
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

    if (entries.length === 0) {
      throw new BadRequestError("No entries to seed")
    }

    // Get leaderboard from ranking plugin
    const leaderboard = await getLeaderboard(rankingDefinitionId, false)

    // When includeStats is true, re-sort within same level by win rate then matches played
    if (options?.includeStats) {
      leaderboard.sort((a, b) => {
        const levelA = (a.levelOrder as number | null) ?? 999999
        const levelB = (b.levelOrder as number | null) ?? 999999
        if (levelA !== levelB) return levelA - levelB

        const statsA = (a.stats as Record<string, number> | null) ?? {}
        const statsB = (b.stats as Record<string, number> | null) ?? {}
        const winsA = statsA.match_wins ?? statsA.wins ?? 0
        const winsB = statsB.match_wins ?? statsB.wins ?? 0
        const playedA = statsA.matches_played ?? 0
        const playedB = statsB.matches_played ?? 0
        const rateA = playedA > 0 ? winsA / playedA : 0
        const rateB = playedB > 0 ? winsB / playedB : 0
        if (rateB !== rateA) return rateB - rateA

        return playedB - playedA
      })
    }

    // Build userId -> rank position map
    const rankMap = new Map<string, number>()
    for (let i = 0; i < leaderboard.length; i++) {
      rankMap.set(leaderboard[i].userId, i + 1)
    }

    // Sort entries: ranked entries first (by rank), then unranked entries
    const ranked = entries
      .filter((e) => e.userId && rankMap.has(e.userId))
      .sort((a, b) => rankMap.get(a.userId!)! - rankMap.get(b.userId!)!)

    const unranked = entries.filter((e) => !e.userId || !rankMap.has(e.userId))

    const sorted = [...ranked, ...unranked]

    // Clear existing seeds
    await tx
      .update(tournamentEntry)
      .set({ seed: null })
      .where(eq(tournamentEntry.tournamentId, tournamentId))

    // Set new seeds
    for (let i = 0; i < sorted.length; i++) {
      await tx
        .update(tournamentEntry)
        .set({ seed: i + 1, updatedAt: new Date() })
        .where(eq(tournamentEntry.id, sorted[i].id))
    }

    // Bump tournament version
    await tx
      .update(tournament)
      .set({
        version: sql`${tournament.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tournament.id, tournamentId))

    return sorted.map((e, i) => ({ entryId: e.id, seed: i + 1 }))
  })
}


import { eq, and, sql, asc, desc } from "drizzle-orm"
import { db } from "@/db"
import {
  memberRank,
  rankingDefinition,
  rankingLevel,
  rankStatEntry,
} from "@/plugins/ranking/schema"
import { activityMember } from "@/db/schema"
import { user } from "@/db/auth-schema"
import type { MemberRank, RankStatEntry } from "@/db/types"
import { NotFoundError } from "@/exceptions"

export async function getMemberRank(
  rankingDefinitionId: string,
  userId: string
): Promise<MemberRank | null> {
  const [result] = await db
    .select()
    .from(memberRank)
    .where(
      and(
        eq(memberRank.rankingDefinitionId, rankingDefinitionId),
        eq(memberRank.userId, userId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function getMemberRankWithLevel(
  rankingDefinitionId: string,
  userId: string
) {
  const [result] = await db
    .select({
      id: memberRank.id,
      userId: memberRank.userId,
      rankingDefinitionId: memberRank.rankingDefinitionId,
      stats: memberRank.stats,
      lastActivityAt: memberRank.lastActivityAt,
      currentLevelId: memberRank.currentLevelId,
      levelName: rankingLevel.name,
      levelColor: rankingLevel.color,
      levelOrder: rankingLevel.order,
    })
    .from(memberRank)
    .leftJoin(rankingLevel, eq(memberRank.currentLevelId, rankingLevel.id))
    .where(
      and(
        eq(memberRank.rankingDefinitionId, rankingDefinitionId),
        eq(memberRank.userId, userId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function getMemberRanksByUser(
  userId: string,
  organizationId: string
) {
  return db
    .select({
      id: memberRank.id,
      userId: memberRank.userId,
      rankingDefinitionId: memberRank.rankingDefinitionId,
      stats: memberRank.stats,
      lastActivityAt: memberRank.lastActivityAt,
      currentLevelId: memberRank.currentLevelId,
      levelName: rankingLevel.name,
      levelColor: rankingLevel.color,
      levelOrder: rankingLevel.order,
      definitionName: rankingDefinition.name,
      domainId: rankingDefinition.domainId,
      activityId: rankingDefinition.activityId,
    })
    .from(memberRank)
    .innerJoin(
      rankingDefinition,
      eq(memberRank.rankingDefinitionId, rankingDefinition.id)
    )
    .leftJoin(rankingLevel, eq(memberRank.currentLevelId, rankingLevel.id))
    .where(
      and(
        eq(memberRank.userId, userId),
        eq(memberRank.organizationId, organizationId)
      )
    )
}

export async function getLeaderboard(
  rankingDefinitionId: string,
  includeFormerMembers: boolean
) {
  // Get the definition to find its activity
  const [definition] = await db
    .select({ activityId: rankingDefinition.activityId })
    .from(rankingDefinition)
    .where(eq(rankingDefinition.id, rankingDefinitionId))
    .limit(1)

  if (!definition) {
    throw new NotFoundError("Ranking definition not found")
  }

  const query = db
    .select({
      id: memberRank.id,
      userId: memberRank.userId,
      stats: memberRank.stats,
      lastActivityAt: memberRank.lastActivityAt,
      currentLevelId: memberRank.currentLevelId,
      levelName: rankingLevel.name,
      levelColor: rankingLevel.color,
      levelOrder: rankingLevel.order,
      userName: user.name,
    })
    .from(memberRank)
    .innerJoin(user, eq(memberRank.userId, user.id))
    .leftJoin(rankingLevel, eq(memberRank.currentLevelId, rankingLevel.id))

  if (!includeFormerMembers) {
    // Only include current active activity members
    return query
      .innerJoin(
        activityMember,
        and(
          eq(activityMember.activityId, definition.activityId),
          eq(activityMember.userId, memberRank.userId),
          eq(activityMember.status, "active")
        )
      )
      .where(eq(memberRank.rankingDefinitionId, rankingDefinitionId))
      .orderBy(
        asc(sql`coalesce(${rankingLevel.order}, 999999)`),
        desc(sql`(${memberRank.stats}->>'wins')::int`),
        asc(user.name)
      )
  }

  return query
    .where(eq(memberRank.rankingDefinitionId, rankingDefinitionId))
    .orderBy(
      asc(sql`coalesce(${rankingLevel.order}, 999999)`),
      desc(sql`(${memberRank.stats}->>'wins')::int`),
      asc(user.name)
    )
}

export async function assignLevel(
  rankingDefinitionId: string,
  organizationId: string,
  userId: string,
  levelId: string | null
): Promise<MemberRank> {
  // Upsert: create member_rank if it doesn't exist, otherwise update level
  const [existing] = await db
    .select()
    .from(memberRank)
    .where(
      and(
        eq(memberRank.rankingDefinitionId, rankingDefinitionId),
        eq(memberRank.userId, userId)
      )
    )
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(memberRank)
      .set({ currentLevelId: levelId })
      .where(eq(memberRank.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(memberRank)
    .values({
      organizationId,
      rankingDefinitionId,
      userId,
      currentLevelId: levelId,
    })
    .returning()
  return created
}

export async function recordStats(
  organizationId: string,
  rankingDefinitionId: string,
  userId: string,
  recordedBy: string,
  input: {
    sessionId?: string
    stats: Record<string, number>
    notes?: string
  }
): Promise<{ entry: RankStatEntry; memberRank: MemberRank }> {
  return db.transaction(async (tx) => {
    // 1. Insert stat entry (audit trail)
    const [entry] = await tx
      .insert(rankStatEntry)
      .values({
        organizationId,
        rankingDefinitionId,
        userId,
        sessionId: input.sessionId ?? null,
        stats: input.stats,
        recordedBy,
        notes: input.notes ?? null,
      })
      .returning()

    // 2. Upsert member_rank with aggregated stats
    const [existing] = await tx
      .select()
      .from(memberRank)
      .where(
        and(
          eq(memberRank.rankingDefinitionId, rankingDefinitionId),
          eq(memberRank.userId, userId)
        )
      )
      .limit(1)

    let updatedMemberRank: MemberRank

    if (existing) {
      // Aggregate: add new stats to existing cumulative stats
      const currentStats = (existing.stats as Record<string, number>) ?? {}
      const newStats = { ...currentStats }
      for (const [key, value] of Object.entries(input.stats)) {
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
      updatedMemberRank = updated
    } else {
      const [created] = await tx
        .insert(memberRank)
        .values({
          organizationId,
          rankingDefinitionId,
          userId,
          stats: input.stats,
          lastActivityAt: new Date(),
        })
        .returning()
      updatedMemberRank = created
    }

    return { entry, memberRank: updatedMemberRank }
  })
}

export async function correctStatEntry(
  organizationId: string,
  rankingDefinitionId: string,
  entryId: string,
  recordedBy: string,
  input: {
    correctedStats: Record<string, number>
    notes?: string
  }
): Promise<{ entry: RankStatEntry; memberRank: MemberRank }> {
  return db.transaction(async (tx) => {
    // 1. Get the original entry
    const [original] = await tx
      .select()
      .from(rankStatEntry)
      .where(
        and(
          eq(rankStatEntry.id, entryId),
          eq(rankStatEntry.rankingDefinitionId, rankingDefinitionId)
        )
      )
      .limit(1)

    if (!original) {
      throw new NotFoundError("Stat entry not found")
    }

    // 2. Reverse old stats from memberRank
    const originalStats = original.stats as Record<string, number>

    const [existing] = await tx
      .select()
      .from(memberRank)
      .where(
        and(
          eq(memberRank.rankingDefinitionId, rankingDefinitionId),
          eq(memberRank.userId, original.userId)
        )
      )
      .limit(1)

    if (!existing) {
      throw new NotFoundError("Member rank not found")
    }

    const currentStats = (existing.stats as Record<string, number>) ?? {}
    const reversedStats = { ...currentStats }
    for (const [key, value] of Object.entries(originalStats)) {
      reversedStats[key] = (reversedStats[key] ?? 0) - value
    }

    // 3. Delete old entry
    await tx.delete(rankStatEntry).where(eq(rankStatEntry.id, entryId))

    // 4. Insert corrected entry
    const [entry] = await tx
      .insert(rankStatEntry)
      .values({
        organizationId,
        rankingDefinitionId,
        userId: original.userId,
        sessionId: original.sessionId,
        stats: input.correctedStats,
        recordedBy,
        notes: input.notes ?? null,
      })
      .returning()

    // 5. Apply corrected stats to memberRank
    const newStats = { ...reversedStats }
    for (const [key, value] of Object.entries(input.correctedStats)) {
      newStats[key] = (newStats[key] ?? 0) + value
    }

    const [updatedMemberRank] = await tx
      .update(memberRank)
      .set({ stats: newStats })
      .where(eq(memberRank.id, existing.id))
      .returning()

    return { entry, memberRank: updatedMemberRank }
  })
}

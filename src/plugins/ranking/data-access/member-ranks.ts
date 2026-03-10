import { eq, and, sql, asc, desc } from "drizzle-orm"
import { db } from "@/db"
import {
  memberRank,
  rankingDefinition,
  rankingLevel,
  rankStatEntry,
} from "@/plugins/ranking/schema"
import { getDomain, type TieBreakRule } from "@/plugins/ranking/domains"
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
      attributes: memberRank.attributes,
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
    .select({
      activityId: rankingDefinition.activityId,
      domainId: rankingDefinition.domainId,
    })
    .from(rankingDefinition)
    .where(eq(rankingDefinition.id, rankingDefinitionId))
    .limit(1)

  if (!definition) {
    throw new NotFoundError("Ranking definition not found")
  }

  const domain = getDomain(definition.domainId)
  const tieBreak = domain?.tieBreak ?? []

  const getStatValueExpr = (field: string) =>
    sql<number>`coalesce((${memberRank.stats}->>${field})::int, 0)`

  const parseDifferenceExpr = (field: string): [string, string] | null => {
    const match = field.match(/^\(\s*([a-zA-Z0-9_]+)\s*-\s*([a-zA-Z0-9_]+)\s*\)$/)
    if (!match) return null
    return [match[1], match[2]]
  }

  const buildTieBreakExpr = (rule: TieBreakRule) => {
    const diff = parseDifferenceExpr(rule.field)
    if (!diff) {
      return getStatValueExpr(rule.field)
    }
    const [left, right] = diff
    return sql<number>`(${getStatValueExpr(left)} - ${getStatValueExpr(right)})`
  }

  const tieBreakOrder = tieBreak.map((rule) => {
    const expr = buildTieBreakExpr(rule)
    return rule.direction === "asc" ? asc(expr) : desc(expr)
  })

  const query = db
    .select({
      id: memberRank.id,
      userId: memberRank.userId,
      stats: memberRank.stats,
      attributes: memberRank.attributes,
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
        ...tieBreakOrder,
        asc(user.name)
      )
  }

  return query
    .where(eq(memberRank.rankingDefinitionId, rankingDefinitionId))
    .orderBy(
      asc(sql`coalesce(${rankingLevel.order}, 999999)`),
      ...tieBreakOrder,
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

// =============================================================================
// Member Attributes
// =============================================================================

export async function updateMemberAttributes(
  rankingDefinitionId: string,
  organizationId: string,
  userId: string,
  attributes: Record<string, string | null>
): Promise<MemberRank> {
  // Upsert: create member_rank if it doesn't exist, otherwise update attributes
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
    // Merge new attributes with existing ones, null values remove keys
    const currentAttrs = (existing.attributes as Record<string, string>) ?? {}
    const merged: Record<string, string> = { ...currentAttrs }
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null) {
        delete merged[key]
      } else {
        merged[key] = value
      }
    }

    const [updated] = await db
      .update(memberRank)
      .set({ attributes: merged })
      .where(eq(memberRank.id, existing.id))
      .returning()
    return updated
  }

  // Create new member_rank with attributes (filter out null values)
  const attrs: Record<string, string> = {}
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== null) {
      attrs[key] = value
    }
  }

  const [created] = await db
    .insert(memberRank)
    .values({
      organizationId,
      rankingDefinitionId,
      userId,
      attributes: attrs,
    })
    .returning()
  return created
}

export async function getMemberAttributes(
  rankingDefinitionId: string,
  userId: string
): Promise<Record<string, unknown>> {
  const [result] = await db
    .select({ attributes: memberRank.attributes })
    .from(memberRank)
    .where(
      and(
        eq(memberRank.rankingDefinitionId, rankingDefinitionId),
        eq(memberRank.userId, userId)
      )
    )
    .limit(1)
  return (result?.attributes as Record<string, unknown>) ?? {}
}

// =============================================================================
// Individual Stats (per-participant per-session)
// =============================================================================

export async function getStatEntriesBySession(
  rankingDefinitionId: string,
  sessionId: string
): Promise<Record<string, Record<string, number>>> {
  const entries = await db
    .select({ userId: rankStatEntry.userId, stats: rankStatEntry.stats })
    .from(rankStatEntry)
    .where(
      and(
        eq(rankStatEntry.rankingDefinitionId, rankingDefinitionId),
        eq(rankStatEntry.sessionId, sessionId)
      )
    )
  return Object.fromEntries(
    entries.map((e) => [e.userId, e.stats as Record<string, number>])
  )
}

export async function recordBatchStats(
  organizationId: string,
  rankingDefinitionId: string,
  recordedBy: string,
  input: {
    sessionId: string
    entries: Array<{ userId: string; stats: Record<string, number> }>
    notes?: string
  }
): Promise<MemberRank[]> {
  return db.transaction(async (tx) => {
    const updatedRanks: MemberRank[] = []

    for (const entry of input.entries) {
      // Check for existing stat entry (idempotency via unique index)
      const [existingEntry] = await tx
        .select()
        .from(rankStatEntry)
        .where(
          and(
            eq(rankStatEntry.rankingDefinitionId, rankingDefinitionId),
            eq(rankStatEntry.userId, entry.userId),
            eq(rankStatEntry.sessionId, input.sessionId)
          )
        )
        .limit(1)

      const oldStats = existingEntry
        ? (existingEntry.stats as Record<string, number>)
        : null

      // Upsert stat entry
      if (existingEntry) {
        await tx
          .update(rankStatEntry)
          .set({
            stats: entry.stats,
            recordedBy,
            notes: input.notes ?? null,
          })
          .where(eq(rankStatEntry.id, existingEntry.id))
      } else {
        await tx.insert(rankStatEntry).values({
          organizationId,
          rankingDefinitionId,
          userId: entry.userId,
          sessionId: input.sessionId,
          stats: entry.stats,
          recordedBy,
          notes: input.notes ?? null,
        })
      }

      // Upsert member rank — compute delta (new - old)
      const [existingRank] = await tx
        .select()
        .from(memberRank)
        .where(
          and(
            eq(memberRank.rankingDefinitionId, rankingDefinitionId),
            eq(memberRank.userId, entry.userId)
          )
        )
        .limit(1)

      if (existingRank) {
        const currentStats = (existingRank.stats as Record<string, number>) ?? {}
        const newCumulative = { ...currentStats }

        // Reverse old entry stats if updating
        if (oldStats) {
          for (const [key, value] of Object.entries(oldStats)) {
            newCumulative[key] = (newCumulative[key] ?? 0) - value
          }
        }

        // Apply new stats
        for (const [key, value] of Object.entries(entry.stats)) {
          newCumulative[key] = (newCumulative[key] ?? 0) + value
        }

        const [updated] = await tx
          .update(memberRank)
          .set({ stats: newCumulative, lastActivityAt: new Date() })
          .where(eq(memberRank.id, existingRank.id))
          .returning()
        updatedRanks.push(updated)
      } else {
        const [created] = await tx
          .insert(memberRank)
          .values({
            organizationId,
            rankingDefinitionId,
            userId: entry.userId,
            stats: entry.stats,
            lastActivityAt: new Date(),
          })
          .returning()
        updatedRanks.push(created)
      }
    }

    return updatedRanks
  })
}

// =============================================================================
// Session Awards (e.g., MOTM — one player per session)
// =============================================================================

export async function getSessionAwardHolders(
  rankingDefinitionId: string,
  sessionId: string,
  awardIds: string[]
): Promise<Record<string, string | null>> {
  // Returns { awardId: userId | null } for each award
  const entries = await db
    .select({ userId: rankStatEntry.userId, stats: rankStatEntry.stats })
    .from(rankStatEntry)
    .where(
      and(
        eq(rankStatEntry.rankingDefinitionId, rankingDefinitionId),
        eq(rankStatEntry.sessionId, sessionId)
      )
    )

  const result: Record<string, string | null> = {}
  for (const awardId of awardIds) {
    result[awardId] = null
    for (const entry of entries) {
      const stats = entry.stats as Record<string, number>
      if (stats[awardId] && stats[awardId] > 0) {
        result[awardId] = entry.userId
        break
      }
    }
  }
  return result
}

export async function setSessionAward(
  organizationId: string,
  rankingDefinitionId: string,
  recordedBy: string,
  input: {
    sessionId: string
    awardId: string
    userId: string | null // null to clear
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    // Find current holder of this award in this session
    const entries = await tx
      .select()
      .from(rankStatEntry)
      .where(
        and(
          eq(rankStatEntry.rankingDefinitionId, rankingDefinitionId),
          eq(rankStatEntry.sessionId, input.sessionId)
        )
      )

    let currentHolderId: string | null = null
    for (const entry of entries) {
      const stats = entry.stats as Record<string, number>
      if (stats[input.awardId] && stats[input.awardId] > 0) {
        currentHolderId = entry.userId
        break
      }
    }

    // If same player, nothing to do
    if (currentHolderId === input.userId) return

    // Remove award from current holder
    if (currentHolderId) {
      const currentEntry = entries.find((e) => e.userId === currentHolderId)!
      const currentStats = { ...(currentEntry.stats as Record<string, number>) }
      delete currentStats[input.awardId]

      await tx
        .update(rankStatEntry)
        .set({ stats: currentStats, recordedBy })
        .where(eq(rankStatEntry.id, currentEntry.id))

      // Decrement in memberRank
      const [currentRank] = await tx
        .select()
        .from(memberRank)
        .where(
          and(
            eq(memberRank.rankingDefinitionId, rankingDefinitionId),
            eq(memberRank.userId, currentHolderId)
          )
        )
        .limit(1)

      if (currentRank) {
        const cumStats = { ...(currentRank.stats as Record<string, number>) }
        cumStats[input.awardId] = Math.max(0, (cumStats[input.awardId] ?? 0) - 1)
        await tx
          .update(memberRank)
          .set({ stats: cumStats })
          .where(eq(memberRank.id, currentRank.id))
      }
    }

    // Set award on new holder
    if (input.userId) {
      const existingEntry = entries.find((e) => e.userId === input.userId)

      if (existingEntry) {
        const newStats = { ...(existingEntry.stats as Record<string, number>) }
        newStats[input.awardId] = 1
        await tx
          .update(rankStatEntry)
          .set({ stats: newStats, recordedBy })
          .where(eq(rankStatEntry.id, existingEntry.id))
      } else {
        await tx.insert(rankStatEntry).values({
          organizationId,
          rankingDefinitionId,
          userId: input.userId,
          sessionId: input.sessionId,
          stats: { [input.awardId]: 1 },
          recordedBy,
        })
      }

      // Increment in memberRank
      const [newRank] = await tx
        .select()
        .from(memberRank)
        .where(
          and(
            eq(memberRank.rankingDefinitionId, rankingDefinitionId),
            eq(memberRank.userId, input.userId)
          )
        )
        .limit(1)

      if (newRank) {
        const cumStats = { ...(newRank.stats as Record<string, number>) }
        cumStats[input.awardId] = (cumStats[input.awardId] ?? 0) + 1
        await tx
          .update(memberRank)
          .set({ stats: cumStats, lastActivityAt: new Date() })
          .where(eq(memberRank.id, newRank.id))
      } else {
        await tx.insert(memberRank).values({
          organizationId,
          rankingDefinitionId,
          userId: input.userId,
          stats: { [input.awardId]: 1 },
          lastActivityAt: new Date(),
        })
      }
    }
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

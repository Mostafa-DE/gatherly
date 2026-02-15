import { eq, and, inArray, sql } from "drizzle-orm"
import { db } from "@/db"
import { rankingLevel, memberRank } from "@/plugins/ranking/schema"
import type { RankingLevel } from "@/db/types"
import { BadRequestError, NotFoundError } from "@/exceptions"
import type { LevelInput } from "@/plugins/ranking/schemas"

export async function getLevelsForDefinition(
  rankingDefinitionId: string
): Promise<RankingLevel[]> {
  return db
    .select()
    .from(rankingLevel)
    .where(eq(rankingLevel.rankingDefinitionId, rankingDefinitionId))
    .orderBy(rankingLevel.order)
}

export async function upsertLevels(
  rankingDefinitionId: string,
  organizationId: string,
  levels: LevelInput[]
) {
  return db.transaction(async (tx) => {
    // Get current levels
    const currentLevels = await tx
      .select()
      .from(rankingLevel)
      .where(eq(rankingLevel.rankingDefinitionId, rankingDefinitionId))

    const currentIds = new Set(currentLevels.map((l) => l.id))
    const incomingIds = new Set(levels.filter((l) => l.id).map((l) => l.id!))

    // Levels to delete (in current but not in incoming)
    const toDelete = currentLevels.filter((l) => !incomingIds.has(l.id))

    // Check that no deleted level has assigned members
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map((l) => l.id)
      const [assignedCount] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(memberRank)
        .where(inArray(memberRank.currentLevelId, deleteIds))

      if (assignedCount && assignedCount.count > 0) {
        throw new BadRequestError(
          "Cannot remove levels that have members assigned. Reassign members first."
        )
      }

      await tx
        .delete(rankingLevel)
        .where(inArray(rankingLevel.id, deleteIds))
    }

    // Upsert remaining levels
    const results: RankingLevel[] = []

    for (const level of levels) {
      if (level.id && currentIds.has(level.id)) {
        // Update existing level
        const [updated] = await tx
          .update(rankingLevel)
          .set({
            name: level.name,
            color: level.color ?? null,
            order: level.order,
          })
          .where(
            and(
              eq(rankingLevel.id, level.id),
              eq(rankingLevel.rankingDefinitionId, rankingDefinitionId)
            )
          )
          .returning()
        if (updated) results.push(updated)
      } else {
        // Insert new level
        const [inserted] = await tx
          .insert(rankingLevel)
          .values({
            organizationId,
            rankingDefinitionId,
            name: level.name,
            color: level.color ?? null,
            order: level.order,
          })
          .returning()
        results.push(inserted)
      }
    }

    return results.sort((a, b) => a.order - b.order)
  })
}

export async function deleteLevel(
  rankingDefinitionId: string,
  levelId: string
) {
  return db.transaction(async (tx) => {
    // Check for assigned members
    const [assignedCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(memberRank)
      .where(eq(memberRank.currentLevelId, levelId))

    if (assignedCount && assignedCount.count > 0) {
      throw new BadRequestError(
        `Cannot delete level: ${assignedCount.count} member(s) are assigned to it. Reassign them first.`
      )
    }

    const [deleted] = await tx
      .delete(rankingLevel)
      .where(
        and(
          eq(rankingLevel.id, levelId),
          eq(rankingLevel.rankingDefinitionId, rankingDefinitionId)
        )
      )
      .returning()

    if (!deleted) {
      throw new NotFoundError("Level not found")
    }

    return deleted
  })
}

import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { rankingDefinition, rankingLevel } from "@/plugins/ranking/schema"
import type { RankingDefinition } from "@/db/types"
import { ConflictError, NotFoundError } from "@/exceptions"
import type { LevelInput } from "@/plugins/ranking/schemas"

export async function getRankingDefinitionByActivity(
  activityId: string,
  organizationId: string
) {
  const [definition] = await db
    .select()
    .from(rankingDefinition)
    .where(
      and(
        eq(rankingDefinition.activityId, activityId),
        eq(rankingDefinition.organizationId, organizationId)
      )
    )
    .limit(1)

  if (!definition) return null

  const levels = await db
    .select()
    .from(rankingLevel)
    .where(eq(rankingLevel.rankingDefinitionId, definition.id))
    .orderBy(rankingLevel.order)

  return { ...definition, levels }
}

export async function getRankingDefinitionById(
  id: string,
  organizationId: string
): Promise<RankingDefinition | null> {
  const [result] = await db
    .select()
    .from(rankingDefinition)
    .where(
      and(
        eq(rankingDefinition.id, id),
        eq(rankingDefinition.organizationId, organizationId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function createRankingDefinition(
  organizationId: string,
  createdBy: string,
  input: {
    activityId: string
    name: string
    domainId: string
    levels: LevelInput[]
  }
) {
  return db.transaction(async (tx) => {
    // Check for existing definition on this activity
    const [existing] = await tx
      .select({ id: rankingDefinition.id })
      .from(rankingDefinition)
      .where(eq(rankingDefinition.activityId, input.activityId))
      .limit(1)

    if (existing) {
      throw new ConflictError("A ranking already exists for this activity")
    }

    const [definition] = await tx
      .insert(rankingDefinition)
      .values({
        organizationId,
        activityId: input.activityId,
        name: input.name,
        domainId: input.domainId,
        createdBy,
      })
      .returning()

    let levels: typeof rankingLevel.$inferSelect[] = []

    if (input.levels.length > 0) {
      levels = await tx
        .insert(rankingLevel)
        .values(
          input.levels.map((level) => ({
            organizationId,
            rankingDefinitionId: definition.id,
            name: level.name,
            color: level.color ?? null,
            order: level.order,
          }))
        )
        .returning()
    }

    return { ...definition, levels }
  })
}

export async function updateDefinitionName(
  id: string,
  organizationId: string,
  name: string
): Promise<RankingDefinition> {
  const [updated] = await db
    .update(rankingDefinition)
    .set({ name })
    .where(
      and(
        eq(rankingDefinition.id, id),
        eq(rankingDefinition.organizationId, organizationId)
      )
    )
    .returning()

  if (!updated) {
    throw new NotFoundError("Ranking definition not found")
  }

  return updated
}

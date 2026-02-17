import { eq, and, asc } from "drizzle-orm"
import { db } from "@/db"
import {
  rankingDefinition,
  rankingLevel,
} from "@/plugins/ranking/schema"
import type { FieldMeta, FieldType } from "./distance"
import type { AvailableField } from "@/data-access/member-profiles"

type WeightedField = {
  sourceId: string
  weight: number
}

// =============================================================================
// Build FieldMeta array from selected fields + available fields
// =============================================================================

export function buildFieldMeta(
  selectedFields: WeightedField[],
  availableFields: AvailableField[],
  levelOrderMap?: Map<string, number>
): FieldMeta[] {
  return selectedFields.map((sf) => {
    const available = availableFields.find((af) => af.sourceId === sf.sourceId)
    const type = mapFieldType(available?.type ?? "text")
    return {
      sourceId: sf.sourceId,
      type,
      weight: sf.weight,
      options: available?.options,
      levelOrderMap: type === "ranking_level" ? levelOrderMap : undefined,
      // numericRange is set later by computeNumericRanges()
    }
  })
}

function mapFieldType(type: string): FieldType {
  if (type === "ranking_level") return "ranking_level"
  if (type === "ranking_stat") return "ranking_stat"
  if (type === "select" || type === "radio") return "select"
  if (type === "multiselect") return "multiselect"
  if (type === "checkbox") return "checkbox"
  if (type === "number") return "number"
  return "text"
}

// =============================================================================
// Fetch Level Order Map (ranking levels → ordinal positions)
// =============================================================================

export async function fetchLevelOrderMap(
  activityId: string,
  orgId: string
): Promise<Map<string, number> | undefined> {
  const [rankDef] = await db
    .select({ id: rankingDefinition.id })
    .from(rankingDefinition)
    .where(
      and(
        eq(rankingDefinition.activityId, activityId),
        eq(rankingDefinition.organizationId, orgId)
      )
    )
    .limit(1)

  if (!rankDef) return undefined

  const levels = await db
    .select({ name: rankingLevel.name, order: rankingLevel.order })
    .from(rankingLevel)
    .where(eq(rankingLevel.rankingDefinitionId, rankDef.id))
    .orderBy(asc(rankingLevel.order))

  if (levels.length === 0) return undefined

  const map = new Map<string, number>()
  for (const level of levels) {
    map.set(level.name, level.order)
  }
  return map
}

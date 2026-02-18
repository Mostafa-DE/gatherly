// Pure metric computation — zero external deps beyond distance.ts
import type { GroupEntry } from "./algorithm"
import type { FieldMeta, FieldType } from "./distance"
import { computeNumericRanges, gowerDistance } from "./distance"
import type { Criteria } from "./schemas"

// =============================================================================
// Types
// =============================================================================

export type PerGroupBalanceMetric = {
  groupName: string
  fieldAverages: Record<string, number> // sourceId → avg
}

export type BalanceMetrics = {
  mode: "balanced"
  perGroup: PerGroupBalanceMetric[]
  balancePercent: number // 0-100
  perFieldGap: Record<string, number> // sourceId → maxGroupAvg - minGroupAvg
}

export type PerGroupClusterMetric = {
  groupName: string
  avgIntraDistance: number // 0-1
}

export type ClusterMetrics = {
  mode: "similarity" | "diversity"
  perGroup: PerGroupClusterMetric[]
  qualityPercent: number // 0-100
}

export type GroupMetrics = BalanceMetrics | ClusterMetrics | null

// =============================================================================
// Balance Metrics
// =============================================================================

export function computeBalanceMetrics(
  groups: Array<{ groupName: string; memberIds: string[] }>,
  entries: GroupEntry[],
  criteria: Extract<Criteria, { mode: "balanced" }>
): BalanceMetrics {
  const entryMap = new Map(entries.map((e) => [e.userId, e]))
  const { balanceFields } = criteria
  const totalWeight = balanceFields.reduce((s, bf) => s + bf.weight, 0) || 1

  // Per-group: compute avg for each balance field
  const perGroup: PerGroupBalanceMetric[] = groups.map((g) => {
    const fieldAverages: Record<string, number> = {}
    for (const bf of balanceFields) {
      let sum = 0
      let count = 0
      for (const uid of g.memberIds) {
        const entry = entryMap.get(uid)
        if (!entry) continue
        const val = Number(entry.data[bf.sourceId])
        if (!Number.isNaN(val)) {
          sum += val
          count++
        }
      }
      fieldAverages[bf.sourceId] = count > 0 ? sum / count : 0
    }
    return { groupName: g.groupName, fieldAverages }
  })

  // Per-field gap: maxGroupAvg - minGroupAvg across all groups
  const perFieldGap: Record<string, number> = {}
  let weightedCost = 0

  for (const bf of balanceFields) {
    const avgs = perGroup.map((pg) => pg.fieldAverages[bf.sourceId])
    const gap = Math.max(...avgs) - Math.min(...avgs)
    perFieldGap[bf.sourceId] = gap

    // Find field's global range for normalization
    let min = Infinity
    let max = -Infinity
    for (const entry of entries) {
      const val = Number(entry.data[bf.sourceId])
      if (!Number.isNaN(val)) {
        if (val < min) min = val
        if (val > max) max = val
      }
    }
    const range = max > min ? max - min : 1
    weightedCost += (bf.weight / totalWeight) * (gap / range)
  }

  const balancePercent = Math.round(Math.max(0, Math.min(100, 100 * (1 - weightedCost))))

  return { mode: "balanced", perGroup, balancePercent, perFieldGap }
}

// =============================================================================
// Cluster Metrics (Similarity / Diversity)
// =============================================================================

export function computeClusterMetrics(
  groups: Array<{ groupName: string; memberIds: string[] }>,
  entries: GroupEntry[],
  criteria: Extract<Criteria, { mode: "similarity" | "diversity" }>
): ClusterMetrics {
  const entryMap = new Map(entries.map((e) => [e.userId, e]))

  // Build FieldMeta from criteria + infer types from data
  const fields = inferFieldMeta(criteria.fields, entries)
  computeNumericRanges(entries, fields)

  // Per-group: avg pairwise gowerDistance
  const perGroup: PerGroupClusterMetric[] = groups.map((g) => {
    const members = g.memberIds
      .map((uid) => entryMap.get(uid))
      .filter((e): e is GroupEntry => e !== undefined)

    let totalDist = 0
    let pairCount = 0

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        totalDist += gowerDistance(members[i].data, members[j].data, fields)
        pairCount++
      }
    }

    const avgIntraDistance = pairCount > 0 ? totalDist / pairCount : 0
    return { groupName: g.groupName, avgIntraDistance }
  })

  // Overall avg distance (weighted by pair count)
  let totalDist = 0
  let totalPairs = 0
  for (const pg of perGroup) {
    // Reconstruct pair count from group size
    const groupSize = groups.find((g) => g.groupName === pg.groupName)!.memberIds.length
    const pairs = (groupSize * (groupSize - 1)) / 2
    totalDist += pg.avgIntraDistance * pairs
    totalPairs += pairs
  }
  const overallAvgDist = totalPairs > 0 ? totalDist / totalPairs : 0

  const qualityPercent =
    criteria.mode === "similarity"
      ? Math.round(100 * (1 - overallAvgDist))
      : Math.round(100 * overallAvgDist)

  return { mode: criteria.mode, perGroup, qualityPercent }
}

// =============================================================================
// Field Meta Inference
// =============================================================================

export function inferFieldMeta(
  criteriaFields: Array<{ sourceId: string; weight: number }>,
  entries: GroupEntry[]
): FieldMeta[] {
  return criteriaFields.map((cf) => {
    const type = inferFieldType(cf.sourceId, entries)
    return {
      sourceId: cf.sourceId,
      type,
      weight: cf.weight,
    }
  })
}

function inferFieldType(sourceId: string, entries: GroupEntry[]): FieldType {
  for (const entry of entries) {
    const val = entry.data[sourceId]
    if (val === null || val === undefined) continue

    if (typeof val === "boolean") return "checkbox"
    if (typeof val === "number") return "number"
    if (Array.isArray(val)) return "multiselect"
    // String — could be select or text; default to select
    return "select"
  }
  return "text"
}

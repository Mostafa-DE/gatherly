// Pure functions for grouping — zero external dependencies
import type { FieldMeta } from "./distance"
import {
  buildDistanceMatrix,
  computeNumericRanges,
} from "./distance"
import type { PenaltyMatrix } from "./variety"
import { getPenalty } from "./variety"

export type GroupEntry = {
  userId: string
  data: Record<string, unknown>
}

export type GroupResult = {
  groupName: string
  memberIds: string[]
}

export type ClusterConfig = {
  groupCount: number
  fields: FieldMeta[]
  objective: "similarity" | "diversity"
  varietyPenalty?: PenaltyMatrix
  varietyWeight?: number
}

export type MultiBalancedConfig = {
  teamCount: number
  balanceFields: Array<{ sourceId: string; weight: number }>
  partitionFields?: string[]
  varietyPenalty?: PenaltyMatrix
  varietyWeight?: number
}

const MAX_EXACT_CLUSTER_ENTRIES = 1200
const MAX_BALANCED_SWAP_ENTRIES = 2000

/**
 * Split entries into groups by a single attribute field.
 * Entries missing the field value are bucketed as "Unknown".
 */
export function splitByAttribute(
  entries: GroupEntry[],
  fieldId: string
): GroupResult[] {
  return splitByAttributes(entries, [fieldId])
}

/**
 * Split entries into groups by 1-2 attribute fields (cross-product).
 * Groups are named by combined values (e.g. "Female + Advanced").
 * Entries missing a field value get "Unknown" for that field.
 */
export function splitByAttributes(
  entries: GroupEntry[],
  fieldIds: string[]
): GroupResult[] {
  if (entries.length === 0 || fieldIds.length === 0) {
    return []
  }

  const buckets = new Map<string, string[]>()

  for (const entry of entries) {
    const parts: string[] = fieldIds.map((fid) => {
      const value = entry.data[fid]
      if (value === null || value === undefined || value === "") {
        return "Unknown"
      }
      return String(value)
    })

    const key = parts.join(" + ")

    const existing = buckets.get(key)
    if (existing) {
      existing.push(entry.userId)
    } else {
      buckets.set(key, [entry.userId])
    }
  }

  // Sort groups alphabetically by name for deterministic output
  const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return sorted.map(([groupName, memberIds]) => ({
    groupName,
    memberIds,
  }))
}

// =============================================================================
// Cluster by Distance (Similarity / Diversity)
// =============================================================================

/**
 * Cluster entries using farthest-first seeding + greedy assignment.
 * - similarity: assign each entry to the group with the closest centroid
 * - diversity: assign each entry to the group with the farthest centroid
 */
export function clusterByDistance(
  entries: GroupEntry[],
  config: ClusterConfig
): GroupResult[] {
  const { groupCount, fields, objective, varietyPenalty, varietyWeight = 0 } = config
  const n = entries.length

  if (n === 0) return []

  const k = Math.min(groupCount, n)
  computeNumericRanges(entries, fields)

  if (n > MAX_EXACT_CLUSTER_ENTRIES) {
    // Score projection fallback — variety not supported (no distance matrix)
    return clusterByScoreProjection(entries, k, fields, objective)
  }

  // 1. Build exact distance matrix
  const dist = buildDistanceMatrix(entries, fields)

  // 1b. Blend variety penalty into distance matrix
  if (varietyWeight > 0 && varietyPenalty && varietyPenalty.size > 0) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const penalty = getPenalty(varietyPenalty, entries[i].userId, entries[j].userId)
        if (penalty > 0) {
          if (objective === "similarity") {
            // Higher penalty → more distance → less likely to group together
            dist[i][j] += varietyWeight * penalty
            dist[j][i] = dist[i][j]
          } else {
            // diversity: Higher penalty → less distance → less attractive for diversity grouping
            dist[i][j] = Math.max(0, dist[i][j] - varietyWeight * penalty)
            dist[j][i] = dist[i][j]
          }
        }
      }
    }
  }

  // 2. Farthest-first seed selection
  const seeds: number[] = [0] // deterministic first seed
  const isSeed = new Array<boolean>(n).fill(false)
  isSeed[0] = true
  const minDistToSeed = new Array<number>(n).fill(Infinity)

  // Update min distances for first seed
  for (let i = 0; i < n; i++) {
    minDistToSeed[i] = dist[i][0]
  }

  while (seeds.length < k) {
    // Pick entry with maximum minimum-distance to any existing seed
    let bestIdx = -1
    let bestDist = -1
    for (let i = 0; i < n; i++) {
      if (isSeed[i]) continue
      if (minDistToSeed[i] > bestDist) {
        bestDist = minDistToSeed[i]
        bestIdx = i
      }
    }
    if (bestIdx === -1) break
    seeds.push(bestIdx)
    isSeed[bestIdx] = true

    // Update min distances with new seed
    for (let i = 0; i < n; i++) {
      minDistToSeed[i] = Math.min(minDistToSeed[i], dist[i][bestIdx])
    }
  }

  // 3. Initialize groups with seeds
  const assignments = new Array<number>(n).fill(-1)
  for (let g = 0; g < seeds.length; g++) {
    assignments[seeds[g]] = g
  }

  // 4. Greedy assignment — sort non-seed entries by nearest-seed distance
  const unassigned: number[] = []
  for (let i = 0; i < n; i++) {
    if (assignments[i] === -1) unassigned.push(i)
  }

  // Sort by closest seed distance (assign nearest first for determinism)
  unassigned.sort((a, b) => minDistToSeed[a] - minDistToSeed[b])

  // Group members tracker for centroid computation
  const groupMembers: number[][] = Array.from({ length: k }, () => [])
  for (let g = 0; g < seeds.length; g++) {
    groupMembers[g].push(seeds[g])
  }

  for (const idx of unassigned) {
    let bestGroup = 0
    let bestAvgDist = avgDistToGroup(idx, groupMembers[0], dist)

    for (let g = 1; g < k; g++) {
      const avgDist = avgDistToGroup(idx, groupMembers[g], dist)
      if (objective === "similarity") {
        if (avgDist < bestAvgDist) {
          bestAvgDist = avgDist
          bestGroup = g
        }
      } else {
        // diversity: assign to farthest group
        if (avgDist > bestAvgDist) {
          bestAvgDist = avgDist
          bestGroup = g
        }
      }
    }

    assignments[idx] = bestGroup
    groupMembers[bestGroup].push(idx)
  }

  // 5. Build results
  return groupMembers.map((members, i) => ({
    groupName: `Group ${i + 1}`,
    memberIds: members.map((idx) => entries[idx].userId),
  }))
}

function avgDistToGroup(
  idx: number,
  groupMembers: number[],
  dist: number[][]
): number {
  if (groupMembers.length === 0) return Infinity
  let sum = 0
  for (const m of groupMembers) {
    sum += dist[idx][m]
  }
  return sum / groupMembers.length
}

// =============================================================================
// Balanced Teams (Snake Draft + Partition + Swap)
// =============================================================================

/**
 * Sum of variety penalties between a member and all other members in the team.
 */
function varietyCostForMember(
  memberIdx: number,
  teamMembers: number[],
  entries: GroupEntry[],
  penaltyMatrix: PenaltyMatrix
): number {
  let cost = 0
  for (const other of teamMembers) {
    if (other === memberIdx) continue
    cost += getPenalty(penaltyMatrix, entries[memberIdx].userId, entries[other].userId)
  }
  return cost
}

/**
 * Create balanced teams by multiple numeric fields with optional partition.
 *
 * Without partition: composite score snake draft → swap optimization across all fields.
 * With partition: split entries into pools by partition value, snake draft within each
 * pool, assemble teams from corresponding buckets, then swap-optimize.
 */
export function multiBalancedTeams(
  entries: GroupEntry[],
  config: MultiBalancedConfig
): GroupResult[] {
  const { teamCount, balanceFields, partitionFields, varietyPenalty, varietyWeight = 0 } = config
  const n = entries.length

  if (n === 0) return []

  const k = Math.min(teamCount, n)

  // Extract all field ratings per entry
  const fieldRatings: number[][] = balanceFields.map((bf) =>
    entries.map((e) => Number(e.data[bf.sourceId]) || 0)
  )
  const totalWeight = balanceFields.reduce((sum, bf) => sum + bf.weight, 0) || 1

  // Composite score per entry
  const compositeScores = entries.map((_, ei) => {
    let sum = 0
    for (let fi = 0; fi < balanceFields.length; fi++) {
      sum += balanceFields[fi].weight * fieldRatings[fi][ei]
    }
    return sum / totalWeight
  })

  let teams: number[][]

  if (!partitionFields || partitionFields.length === 0) {
    // Simple multi-field: snake draft by composite score
    const indexed = entries.map((_, i) => i)
    indexed.sort((a, b) => compositeScores[b] - compositeScores[a])

    teams = Array.from({ length: k }, () => [] as number[])
    let forward = true
    for (let i = 0; i < indexed.length; ) {
      if (forward) {
        for (let t = 0; t < k && i < indexed.length; t++, i++) {
          teams[t].push(indexed[i])
        }
      } else {
        for (let t = k - 1; t >= 0 && i < indexed.length; t--, i++) {
          teams[t].push(indexed[i])
        }
      }
      forward = !forward
    }
  } else {
    // Partition: split into pools by cross-product of partition field values
    const pools = new Map<string, number[]>()
    for (let i = 0; i < n; i++) {
      const parts = partitionFields.map((pf) =>
        String(entries[i].data[pf] ?? "Unknown")
      )
      const key = parts.join(" + ")
      const pool = pools.get(key)
      if (pool) pool.push(i)
      else pools.set(key, [i])
    }

    // Sort each pool descending by composite score
    for (const pool of pools.values()) {
      pool.sort((a, b) => compositeScores[b] - compositeScores[a])
    }

    // Snake draft within each pool into k buckets, then assemble teams
    teams = Array.from({ length: k }, () => [] as number[])

    for (const pool of pools.values()) {
      let forward = true
      let bi = 0
      for (const idx of pool) {
        const t = forward ? bi : k - 1 - bi
        teams[t].push(idx)
        bi++
        if (bi === k) {
          bi = 0
          forward = !forward
        }
      }
    }
  }

  // Swap optimization: minimize weighted sum of per-field spreads
  if (n <= MAX_BALANCED_SWAP_ENTRIES) {
    const vw = varietyWeight > 0 && varietyPenalty && varietyPenalty.size > 0 ? varietyWeight : 0

    const computeCost = (t: number[][]) => {
      let cost = 0
      for (let fi = 0; fi < balanceFields.length; fi++) {
        const ratings = fieldRatings[fi]
        let minAvg = Infinity
        let maxAvg = -Infinity
        for (let ti = 0; ti < k; ti++) {
          if (t[ti].length === 0) continue
          let sum = 0
          for (const idx of t[ti]) sum += ratings[idx]
          const avg = sum / t[ti].length
          if (avg < minAvg) minAvg = avg
          if (avg > maxAvg) maxAvg = avg
        }
        cost += (balanceFields[fi].weight / totalWeight) * (maxAvg - minAvg)
      }
      return cost
    }

    let currentCost = computeCost(teams)
    const MAX_SWAP_ITERATIONS = 100

    for (let iter = 0; iter < MAX_SWAP_ITERATIONS; iter++) {
      let improved = false

      for (let ti = 0; ti < k && !improved; ti++) {
        for (let tj = ti + 1; tj < k && !improved; tj++) {
          if (teams[ti].length === 0 || teams[tj].length === 0) continue

          for (let mi = 0; mi < teams[ti].length && !improved; mi++) {
            for (let mj = 0; mj < teams[tj].length && !improved; mj++) {
              // Try swap
              const a = teams[ti][mi]
              const b = teams[tj][mj]
              teams[ti][mi] = b
              teams[tj][mj] = a

              let newCost = computeCost(teams)

              if (vw > 0) {
                // Swap back to compute old variety cost
                teams[ti][mi] = a
                teams[tj][mj] = b
                const oldV = varietyCostForMember(a, teams[ti], entries, varietyPenalty!)
                  + varietyCostForMember(b, teams[tj], entries, varietyPenalty!)
                // Swap again for new variety cost
                teams[ti][mi] = b
                teams[tj][mj] = a
                const newV = varietyCostForMember(b, teams[ti], entries, varietyPenalty!)
                  + varietyCostForMember(a, teams[tj], entries, varietyPenalty!)
                const varietyImprovement = oldV - newV
                newCost = newCost - vw * varietyImprovement * 0.1
              }

              if (newCost < currentCost - 1e-9) {
                currentCost = newCost
                improved = true
              } else {
                // Swap back
                teams[ti][mi] = a
                teams[tj][mj] = b
              }
            }
          }
        }
      }

      if (!improved) break
    }
  }

  return teams.map((members, i) => ({
    groupName: `Team ${i + 1}`,
    memberIds: members.map((idx) => entries[idx].userId),
  }))
}

function clusterByScoreProjection(
  entries: GroupEntry[],
  groupCount: number,
  fields: FieldMeta[],
  objective: "similarity" | "diversity"
): GroupResult[] {
  const scored = entries.map((entry) => ({
    userId: entry.userId,
    score: computeProjectionScore(entry, fields),
  }))

  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.userId.localeCompare(b.userId)
  })

  const groups: string[][] = Array.from({ length: groupCount }, () => [])
  const n = scored.length

  if (objective === "similarity") {
    // Keep nearby scores together (quantile slicing).
    for (let i = 0; i < n; i++) {
      const g = Math.min(groupCount - 1, Math.floor((i * groupCount) / n))
      groups[g].push(scored[i].userId)
    }
  } else {
    // Spread score spectrum across groups via deterministic snake assignment.
    let g = 0
    let dir: 1 | -1 = 1
    for (let i = 0; i < n; i++) {
      groups[g].push(scored[i].userId)
      if (groupCount === 1) continue
      if (g === groupCount - 1) dir = -1
      else if (g === 0) dir = 1
      g += dir
    }
  }

  return groups.map((memberIds, i) => ({
    groupName: `Group ${i + 1}`,
    memberIds,
  }))
}

function computeProjectionScore(entry: GroupEntry, fields: FieldMeta[]): number {
  let weightedSum = 0
  let weightSum = 0

  for (const field of fields) {
    if (field.weight === 0) continue
    const value = entry.data[field.sourceId]
    const normalized = normalizeFieldValue(value, field)
    weightedSum += field.weight * normalized
    weightSum += field.weight
  }

  if (weightSum === 0) return 0
  return weightedSum / weightSum
}

function normalizeFieldValue(value: unknown, field: FieldMeta): number {
  switch (field.type) {
    case "number":
    case "ranking_stat": {
      const num = Number(value)
      if (Number.isNaN(num)) return 0
      const min = field.numericRange?.min ?? num
      const max = field.numericRange?.max ?? num
      const range = max - min
      if (range === 0) return 0.5
      return clamp01((num - min) / range)
    }
    case "ranking_level": {
      if (field.levelOrderMap) {
        const order = field.levelOrderMap.get(String(value))
        if (order === undefined) return 0
        const values = [...field.levelOrderMap.values()]
        const min = Math.min(...values)
        const max = Math.max(...values)
        const range = max - min
        if (range === 0) return 0.5
        return clamp01((order - min) / range)
      }
      return hashToUnit(String(value))
    }
    case "checkbox":
      return value === true ? 1 : 0
    case "multiselect": {
      const arr = Array.isArray(value) ? value : [value]
      const normalized = arr.map((v) => String(v)).sort().join("|")
      return hashToUnit(normalized)
    }
    case "select":
    case "text":
    default:
      return hashToUnit(String(value).toLowerCase())
  }
}

function hashToUnit(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}


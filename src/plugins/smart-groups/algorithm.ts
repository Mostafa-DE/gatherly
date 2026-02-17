// Pure functions for grouping — zero external dependencies
import type { FieldMeta } from "./distance"
import {
  buildDistanceMatrix,
  computeNumericRanges,
} from "./distance"

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
}

export type BalancedConfig = {
  teamCount: number
  balanceField: string
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
  const { groupCount, fields, objective } = config
  const n = entries.length

  if (n === 0) return []

  const k = Math.min(groupCount, n)
  computeNumericRanges(entries, fields)

  if (n > MAX_EXACT_CLUSTER_ENTRIES) {
    return clusterByScoreProjection(entries, k, fields, objective)
  }

  // 1. Build exact distance matrix
  const dist = buildDistanceMatrix(entries, fields)

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
// Balanced Teams (Snake Draft + Swap Optimization)
// =============================================================================

/**
 * Create balanced teams by a numeric field using snake draft + swap optimization.
 * Entries must have a numeric value for balanceField (caller filters missing).
 */
export function balancedTeams(
  entries: GroupEntry[],
  config: BalancedConfig
): GroupResult[] {
  const { teamCount, balanceField } = config
  const n = entries.length

  if (n === 0) return []

  const k = Math.min(teamCount, n)

  // 1. Extract ratings and sort descending
  const indexed = entries.map((e, i) => ({
    index: i,
    rating: Number(e.data[balanceField]) || 0,
  }))
  indexed.sort((a, b) => b.rating - a.rating)

  // 2. Snake draft
  const teams: number[][] = Array.from({ length: k }, () => [])
  let forward = true

  for (let i = 0; i < indexed.length; ) {
    if (forward) {
      for (let t = 0; t < k && i < indexed.length; t++, i++) {
        teams[t].push(indexed[i].index)
      }
    } else {
      for (let t = k - 1; t >= 0 && i < indexed.length; t--, i++) {
        teams[t].push(indexed[i].index)
      }
    }
    forward = !forward
  }

  // 3. Swap optimization
  const ratings = entries.map((e) => Number(e.data[balanceField]) || 0)
  const teamSums = teams.map((team) => {
    let sum = 0
    for (const idx of team) {
      sum += ratings[idx]
    }
    return sum
  })
  const teamSizes = teams.map((team) => team.length)
  const MAX_SWAP_ITERATIONS = 100
  let currentSpread = spreadFromSums(teamSums, teamSizes)

  if (n > MAX_BALANCED_SWAP_ENTRIES) {
    return teams.map((members, i) => ({
      groupName: `Team ${i + 1}`,
      memberIds: members.map((idx) => entries[idx].userId),
    }))
  }

  for (let iter = 0; iter < MAX_SWAP_ITERATIONS; iter++) {
    let improved = false

    for (let ti = 0; ti < k && !improved; ti++) {
      for (let tj = ti + 1; tj < k && !improved; tj++) {
        if (teamSizes[ti] === 0 || teamSizes[tj] === 0) continue

        for (let mi = 0; mi < teams[ti].length && !improved; mi++) {
          const memberTi = teams[ti][mi]
          const ratingTi = ratings[memberTi]

          for (let mj = 0; mj < teams[tj].length && !improved; mj++) {
            const memberTj = teams[tj][mj]
            const ratingTj = ratings[memberTj]

            const newSumTi = teamSums[ti] - ratingTi + ratingTj
            const newSumTj = teamSums[tj] - ratingTj + ratingTi
            const newSpread = spreadWithSwap(
              teamSums,
              teamSizes,
              ti,
              newSumTi,
              tj,
              newSumTj
            )

            if (newSpread < currentSpread - 1e-9) {
              teams[ti][mi] = memberTj
              teams[tj][mj] = memberTi
              teamSums[ti] = newSumTi
              teamSums[tj] = newSumTj
              currentSpread = newSpread
              improved = true
            }
          }
        }
      }
    }

    if (!improved) break
  }

  // 4. Build results
  return teams.map((members, i) => ({
    groupName: `Team ${i + 1}`,
    memberIds: members.map((idx) => entries[idx].userId),
  }))
}

function spreadFromSums(teamSums: number[], teamSizes: number[]): number {
  let minAvg = Infinity
  let maxAvg = -Infinity

  for (let i = 0; i < teamSums.length; i++) {
    const avg = teamSizes[i] === 0 ? 0 : teamSums[i] / teamSizes[i]
    if (avg < minAvg) minAvg = avg
    if (avg > maxAvg) maxAvg = avg
  }

  return maxAvg - minAvg
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

function spreadWithSwap(
  teamSums: number[],
  teamSizes: number[],
  teamI: number,
  newSumI: number,
  teamJ: number,
  newSumJ: number
): number {
  let minAvg = Infinity
  let maxAvg = -Infinity

  for (let i = 0; i < teamSums.length; i++) {
    const sum =
      i === teamI
        ? newSumI
        : i === teamJ
          ? newSumJ
          : teamSums[i]
    const avg = teamSizes[i] === 0 ? 0 : sum / teamSizes[i]
    if (avg < minAvg) minAvg = avg
    if (avg > maxAvg) maxAvg = avg
  }

  return maxAvg - minAvg
}

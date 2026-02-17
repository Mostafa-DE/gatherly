// Pure distance functions — zero external dependencies
import type { GroupEntry } from "./algorithm"

export type FieldType =
  | "select"
  | "multiselect"
  | "checkbox"
  | "number"
  | "text"
  | "ranking_level"
  | "ranking_stat"

export type FieldMeta = {
  sourceId: string
  type: FieldType
  weight: number
  options?: string[]
  numericRange?: { min: number; max: number }
  levelOrderMap?: Map<string, number>
}

// =============================================================================
// Jaccard Distance
// =============================================================================

export function jaccard(a: unknown[], b: unknown[]): number {
  if (a.length === 0 && b.length === 0) return 0
  const setA = new Set(a.map(String))
  const setB = new Set(b.map(String))
  let intersection = 0
  for (const v of setA) {
    if (setB.has(v)) intersection++
  }
  const union = setA.size + setB.size - intersection
  if (union === 0) return 0
  return 1 - intersection / union
}

// =============================================================================
// Field Distance (single field, returns 0-1)
// =============================================================================

export function fieldDistance(
  a: unknown,
  b: unknown,
  meta: FieldMeta
): number {
  // Missing data → maximum distance
  if (a === null || a === undefined || b === null || b === undefined) return 1

  switch (meta.type) {
    case "select":
    case "text":
      return String(a).toLowerCase() === String(b).toLowerCase() ? 0 : 1

    case "checkbox":
      return a === b ? 0 : 1

    case "multiselect": {
      const arrA = Array.isArray(a) ? a : [a]
      const arrB = Array.isArray(b) ? b : [b]
      return jaccard(arrA, arrB)
    }

    case "number":
    case "ranking_stat": {
      const numA = Number(a)
      const numB = Number(b)
      if (Number.isNaN(numA) || Number.isNaN(numB)) return 1
      const range = meta.numericRange
        ? meta.numericRange.max - meta.numericRange.min
        : 0
      if (range === 0) return 0
      return Math.abs(numA - numB) / range
    }

    case "ranking_level": {
      if (!meta.levelOrderMap) return String(a) === String(b) ? 0 : 1
      const orderA = meta.levelOrderMap.get(String(a))
      const orderB = meta.levelOrderMap.get(String(b))
      if (orderA === undefined || orderB === undefined) return 1
      const orders = [...meta.levelOrderMap.values()]
      const maxOrder = Math.max(...orders)
      const minOrder = Math.min(...orders)
      const diff = maxOrder - minOrder
      if (diff === 0) return 0
      return Math.abs(orderA - orderB) / diff
    }

    default:
      return String(a) === String(b) ? 0 : 1
  }
}

// =============================================================================
// Gower Distance (weighted multi-field, returns 0-1)
// =============================================================================

export function gowerDistance(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fields: FieldMeta[]
): number {
  let weightedSum = 0
  let weightSum = 0

  for (const field of fields) {
    if (field.weight === 0) continue
    const d = fieldDistance(a[field.sourceId], b[field.sourceId], field)
    weightedSum += field.weight * d
    weightSum += field.weight
  }

  if (weightSum === 0) return 0
  return weightedSum / weightSum
}

// =============================================================================
// Distance Matrix (NxN symmetric)
// =============================================================================

export function buildDistanceMatrix(
  entries: GroupEntry[],
  fields: FieldMeta[]
): number[][] {
  const n = entries.length
  const matrix: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0)
  )

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = gowerDistance(entries[i].data, entries[j].data, fields)
      matrix[i][j] = d
      matrix[j][i] = d
    }
  }

  return matrix
}

// =============================================================================
// Compute Numeric Ranges (mutates fields in-place)
// =============================================================================

export function computeNumericRanges(
  entries: GroupEntry[],
  fields: FieldMeta[]
): void {
  for (const field of fields) {
    if (field.type !== "number" && field.type !== "ranking_stat") continue

    let min = Infinity
    let max = -Infinity

    for (const entry of entries) {
      const val = Number(entry.data[field.sourceId])
      if (Number.isNaN(val)) continue
      if (val < min) min = val
      if (val > max) max = val
    }

    if (min === Infinity) {
      field.numericRange = { min: 0, max: 0 }
    } else {
      field.numericRange = { min, max }
    }
  }
}

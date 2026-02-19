import { describe, it, expect } from "vitest"
import {
  fieldDistance,
  gowerDistance,
  buildDistanceMatrix,
  computeNumericRanges,
  jaccard,
  type FieldMeta,
} from "./distance"
import type { GroupEntry } from "./algorithm"

// =============================================================================
// jaccard
// =============================================================================

describe("jaccard", () => {
  it("returns 0 for two empty arrays", () => {
    expect(jaccard([], [])).toBe(0)
  })

  it("returns 0 for identical arrays", () => {
    expect(jaccard(["a", "b"], ["a", "b"])).toBe(0)
  })

  it("returns 1 for disjoint arrays", () => {
    expect(jaccard(["a", "b"], ["c", "d"])).toBe(1)
  })

  it("returns correct distance for partial overlap", () => {
    // intersection = {b}, union = {a,b,c} → 1 - 1/3 = 2/3
    expect(jaccard(["a", "b"], ["b", "c"])).toBeCloseTo(2 / 3)
  })

  it("handles duplicates by converting to strings", () => {
    // Set deduplication: both become {"a","b"}
    expect(jaccard(["a", "a", "b"], ["a", "b"])).toBe(0)
  })

  it("handles one empty and one non-empty array", () => {
    expect(jaccard([], ["a", "b"])).toBe(1)
    expect(jaccard(["a"], [])).toBe(1)
  })

  it("handles numeric values via string conversion", () => {
    expect(jaccard([1, 2], [1, 2])).toBe(0)
    expect(jaccard([1], [2])).toBe(1)
  })
})

// =============================================================================
// fieldDistance
// =============================================================================

describe("fieldDistance", () => {
  it("select: 0 if equal, 1 if different", () => {
    const meta: FieldMeta = { sourceId: "x", type: "select", weight: 1 }
    expect(fieldDistance("A", "A", meta)).toBe(0)
    expect(fieldDistance("A", "B", meta)).toBe(1)
  })

  it("text: case-insensitive comparison", () => {
    const meta: FieldMeta = { sourceId: "x", type: "text", weight: 1 }
    expect(fieldDistance("Hello", "hello", meta)).toBe(0)
    expect(fieldDistance("Hello", "World", meta)).toBe(1)
  })

  it("checkbox: 0 if equal, 1 if different", () => {
    const meta: FieldMeta = { sourceId: "x", type: "checkbox", weight: 1 }
    expect(fieldDistance(true, true, meta)).toBe(0)
    expect(fieldDistance(true, false, meta)).toBe(1)
  })

  it("multiselect: jaccard distance", () => {
    const meta: FieldMeta = { sourceId: "x", type: "multiselect", weight: 1 }
    expect(fieldDistance(["a", "b"], ["a", "b"], meta)).toBe(0)
    expect(fieldDistance(["a"], ["b"], meta)).toBe(1)
    expect(fieldDistance(["a", "b"], ["b", "c"], meta)).toBeCloseTo(2 / 3)
  })

  it("number: range-normalized distance", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "number",
      weight: 1,
      numericRange: { min: 0, max: 10 },
    }
    expect(fieldDistance(0, 10, meta)).toBe(1)
    expect(fieldDistance(3, 7, meta)).toBeCloseTo(0.4)
    expect(fieldDistance(5, 5, meta)).toBe(0)
  })

  it("number: returns 0 when range is 0", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "number",
      weight: 1,
      numericRange: { min: 5, max: 5 },
    }
    expect(fieldDistance(5, 5, meta)).toBe(0)
  })

  it("ranking_stat: same as number", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "ranking_stat",
      weight: 1,
      numericRange: { min: 0, max: 20 },
    }
    expect(fieldDistance(5, 15, meta)).toBeCloseTo(0.5)
  })

  it("ranking_attribute: 0 if equal, 1 if different (case-insensitive)", () => {
    const meta: FieldMeta = { sourceId: "x", type: "ranking_attribute", weight: 1 }
    expect(fieldDistance("GK", "GK", meta)).toBe(0)
    expect(fieldDistance("GK", "gk", meta)).toBe(0)
    expect(fieldDistance("Defender", "Attacker", meta)).toBe(1)
  })

  it("ranking_attribute: returns 1 for null/undefined values", () => {
    const meta: FieldMeta = { sourceId: "x", type: "ranking_attribute", weight: 1 }
    expect(fieldDistance(null, "GK", meta)).toBe(1)
    expect(fieldDistance("GK", undefined, meta)).toBe(1)
  })

  it("ranking_level: ordinal distance via levelOrderMap", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "ranking_level",
      weight: 1,
      levelOrderMap: new Map([
        ["D", 0],
        ["C", 1],
        ["B", 2],
        ["A", 3],
      ]),
    }
    expect(fieldDistance("D", "A", meta)).toBe(1)
    expect(fieldDistance("C", "B", meta)).toBeCloseTo(1 / 3)
    expect(fieldDistance("B", "B", meta)).toBe(0)
  })

  it("ranking_level: returns 1 for unknown level names", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "ranking_level",
      weight: 1,
      levelOrderMap: new Map([["D", 0], ["A", 1]]),
    }
    expect(fieldDistance("D", "Z", meta)).toBe(1)
  })

  it("returns 1 when either value is null or undefined", () => {
    const meta: FieldMeta = { sourceId: "x", type: "select", weight: 1 }
    expect(fieldDistance(null, "A", meta)).toBe(1)
    expect(fieldDistance("A", undefined, meta)).toBe(1)
    expect(fieldDistance(null, null, meta)).toBe(1)
  })

  it("number: returns 1 when either value is NaN", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "number",
      weight: 1,
      numericRange: { min: 0, max: 10 },
    }
    expect(fieldDistance("abc", 5, meta)).toBe(1)
    expect(fieldDistance(5, "xyz", meta)).toBe(1)
    expect(fieldDistance("abc", "xyz", meta)).toBe(1)
  })

  it("number: returns 0 when no numericRange provided (range defaults to 0)", () => {
    const meta: FieldMeta = { sourceId: "x", type: "number", weight: 1 }
    expect(fieldDistance(3, 7, meta)).toBe(0)
  })

  it("ranking_level: falls back to string equality without levelOrderMap", () => {
    const meta: FieldMeta = { sourceId: "x", type: "ranking_level", weight: 1 }
    expect(fieldDistance("A", "A", meta)).toBe(0)
    expect(fieldDistance("A", "B", meta)).toBe(1)
  })

  it("ranking_level: returns 0 when all levels have same order", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "ranking_level",
      weight: 1,
      levelOrderMap: new Map([["A", 0], ["B", 0]]),
    }
    expect(fieldDistance("A", "B", meta)).toBe(0)
  })

  it("multiselect: wraps non-array values into arrays", () => {
    const meta: FieldMeta = { sourceId: "x", type: "multiselect", weight: 1 }
    expect(fieldDistance("a", "a", meta)).toBe(0)
    expect(fieldDistance("a", "b", meta)).toBe(1)
  })

  it("multiselect: handles empty arrays", () => {
    const meta: FieldMeta = { sourceId: "x", type: "multiselect", weight: 1 }
    expect(fieldDistance([], [], meta)).toBe(0)
    expect(fieldDistance(["a"], [], meta)).toBe(1)
  })

  it("select: case-insensitive comparison", () => {
    const meta: FieldMeta = { sourceId: "x", type: "select", weight: 1 }
    expect(fieldDistance("Male", "male", meta)).toBe(0)
    expect(fieldDistance("FEMALE", "female", meta)).toBe(0)
  })

  it("ranking_stat: returns 1 when NaN", () => {
    const meta: FieldMeta = {
      sourceId: "x",
      type: "ranking_stat",
      weight: 1,
      numericRange: { min: 0, max: 10 },
    }
    expect(fieldDistance("abc", 5, meta)).toBe(1)
  })

  it("checkbox: handles string booleans as non-equal to booleans", () => {
    const meta: FieldMeta = { sourceId: "x", type: "checkbox", weight: 1 }
    expect(fieldDistance("true", true, meta)).toBe(1)
    expect(fieldDistance(false, false, meta)).toBe(0)
  })
})

// =============================================================================
// gowerDistance
// =============================================================================

describe("gowerDistance", () => {
  it("returns 0 for identical data", () => {
    const fields: FieldMeta[] = [
      { sourceId: "a", type: "select", weight: 1 },
      { sourceId: "b", type: "number", weight: 1, numericRange: { min: 0, max: 10 } },
    ]
    const data = { a: "X", b: 5 }
    expect(gowerDistance(data, data, fields)).toBe(0)
  })

  it("returns 1 for maximally different data", () => {
    const fields: FieldMeta[] = [
      { sourceId: "a", type: "select", weight: 1 },
      { sourceId: "b", type: "number", weight: 1, numericRange: { min: 0, max: 10 } },
    ]
    expect(gowerDistance({ a: "X", b: 0 }, { a: "Y", b: 10 }, fields)).toBe(1)
  })

  it("respects field weights", () => {
    const fields: FieldMeta[] = [
      { sourceId: "a", type: "select", weight: 0 },  // weight 0 → ignored
      { sourceId: "b", type: "number", weight: 1, numericRange: { min: 0, max: 10 } },
    ]
    // Field a differs but weight=0, field b: |3-7|/10 = 0.4
    expect(gowerDistance({ a: "X", b: 3 }, { a: "Y", b: 7 }, fields)).toBeCloseTo(0.4)
  })

  it("returns 0 when all weights are 0", () => {
    const fields: FieldMeta[] = [
      { sourceId: "a", type: "select", weight: 0 },
    ]
    expect(gowerDistance({ a: "X" }, { a: "Y" }, fields)).toBe(0)
  })

  it("handles mixed types", () => {
    const fields: FieldMeta[] = [
      { sourceId: "gender", type: "select", weight: 1 },
      { sourceId: "score", type: "number", weight: 1, numericRange: { min: 0, max: 100 } },
    ]
    // gender: same → 0, score: |20-80|/100 = 0.6 → avg = 0.3
    expect(
      gowerDistance({ gender: "M", score: 20 }, { gender: "M", score: 80 }, fields)
    ).toBeCloseTo(0.3)
  })

  it("handles missing fields in data as null → distance 1", () => {
    const fields: FieldMeta[] = [
      { sourceId: "a", type: "select", weight: 1 },
      { sourceId: "b", type: "select", weight: 1 },
    ]
    // "a" matches, "b" missing in second object → distance 1
    // weighted avg = (0 + 1) / 2 = 0.5
    expect(gowerDistance({ a: "X", b: "Y" }, { a: "X" }, fields)).toBeCloseTo(0.5)
  })

  it("handles uneven weights correctly", () => {
    const fields: FieldMeta[] = [
      { sourceId: "a", type: "select", weight: 3 },
      { sourceId: "b", type: "select", weight: 1 },
    ]
    // a: different → 1, b: same → 0
    // weighted avg = (3*1 + 1*0) / (3+1) = 0.75
    expect(gowerDistance({ a: "X", b: "Y" }, { a: "Z", b: "Y" }, fields)).toBeCloseTo(0.75)
  })

  it("handles empty fields array", () => {
    expect(gowerDistance({ a: "X" }, { a: "Y" }, [])).toBe(0)
  })

  it("handles all field types together", () => {
    const fields: FieldMeta[] = [
      { sourceId: "gender", type: "select", weight: 1 },
      { sourceId: "score", type: "number", weight: 1, numericRange: { min: 0, max: 100 } },
      { sourceId: "tags", type: "multiselect", weight: 1 },
      { sourceId: "active", type: "checkbox", weight: 1 },
    ]
    const a = { gender: "M", score: 50, tags: ["a", "b"], active: true }
    const b = { gender: "M", score: 50, tags: ["a", "b"], active: true }
    expect(gowerDistance(a, b, fields)).toBe(0)
  })
})

// =============================================================================
// buildDistanceMatrix
// =============================================================================

describe("buildDistanceMatrix", () => {
  it("builds symmetric matrix with 0 diagonal", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { x: "A" } },
      { userId: "u2", data: { x: "B" } },
      { userId: "u3", data: { x: "A" } },
    ]
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]
    const matrix = buildDistanceMatrix(entries, fields)

    // Diagonal = 0
    expect(matrix[0][0]).toBe(0)
    expect(matrix[1][1]).toBe(0)
    expect(matrix[2][2]).toBe(0)

    // Symmetric
    expect(matrix[0][1]).toBe(matrix[1][0])
    expect(matrix[0][2]).toBe(matrix[2][0])
    expect(matrix[1][2]).toBe(matrix[2][1])

    // u1 and u3 are same ("A"), u2 is different ("B")
    expect(matrix[0][2]).toBe(0)
    expect(matrix[0][1]).toBe(1)
  })

  it("returns empty matrix for empty entries", () => {
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]
    const matrix = buildDistanceMatrix([], fields)
    expect(matrix).toEqual([])
  })

  it("returns 1x1 matrix of [0] for single entry", () => {
    const entries: GroupEntry[] = [{ userId: "u1", data: { x: "A" } }]
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]
    const matrix = buildDistanceMatrix(entries, fields)
    expect(matrix).toEqual([[0]])
  })

  it("computes correct distances with multiple weighted fields", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { gender: "M", score: 0 } },
      { userId: "u2", data: { gender: "M", score: 100 } },
      { userId: "u3", data: { gender: "F", score: 0 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "gender", type: "select", weight: 1 },
      { sourceId: "score", type: "number", weight: 1, numericRange: { min: 0, max: 100 } },
    ]
    const matrix = buildDistanceMatrix(entries, fields)

    // u1 vs u2: gender same(0) + score diff(1) → avg 0.5
    expect(matrix[0][1]).toBeCloseTo(0.5)
    // u1 vs u3: gender diff(1) + score same(0) → avg 0.5
    expect(matrix[0][2]).toBeCloseTo(0.5)
    // u2 vs u3: gender diff(1) + score diff(1) → avg 1
    expect(matrix[1][2]).toBeCloseTo(1)
  })

  it("handles 4 entries with known distances", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { x: "A" } },
      { userId: "u2", data: { x: "A" } },
      { userId: "u3", data: { x: "B" } },
      { userId: "u4", data: { x: "B" } },
    ]
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]
    const matrix = buildDistanceMatrix(entries, fields)

    expect(matrix).toHaveLength(4)
    expect(matrix[0][1]).toBe(0) // A-A
    expect(matrix[2][3]).toBe(0) // B-B
    expect(matrix[0][2]).toBe(1) // A-B
    expect(matrix[1][3]).toBe(1) // A-B
  })
})

// =============================================================================
// computeNumericRanges
// =============================================================================

describe("computeNumericRanges", () => {
  it("sets min/max from entries", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 30 } },
      { userId: "u3", data: { score: 20 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    expect(fields[0].numericRange).toEqual({ min: 10, max: 30 })
  })

  it("handles single value (range = 0)", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 5 } },
      { userId: "u2", data: { score: 5 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    expect(fields[0].numericRange).toEqual({ min: 5, max: 5 })
  })

  it("handles all NaN values", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: "abc" } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    expect(fields[0].numericRange).toEqual({ min: 0, max: 0 })
  })

  it("skips non-numeric field types", () => {
    const fields: FieldMeta[] = [
      { sourceId: "name", type: "select", weight: 1 },
    ]
    computeNumericRanges([], fields)
    expect(fields[0].numericRange).toBeUndefined()
  })

  it("handles ranking_stat type", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { wins: 2 } },
      { userId: "u2", data: { wins: 8 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "wins", type: "ranking_stat", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    expect(fields[0].numericRange).toEqual({ min: 2, max: 8 })
  })

  it("ignores NaN values but includes null (Number(null)=0)", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: "bad" } },
      { userId: "u3", data: { score: 30 } },
      { userId: "u4", data: { score: null } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    // "bad" → NaN → skipped, null → Number(null)=0 → included
    expect(fields[0].numericRange).toEqual({ min: 0, max: 30 })
  })

  it("handles multiple numeric fields independently", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { wins: 1, losses: 10 } },
      { userId: "u2", data: { wins: 5, losses: 2 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "wins", type: "number", weight: 1 },
      { sourceId: "losses", type: "ranking_stat", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    expect(fields[0].numericRange).toEqual({ min: 1, max: 5 })
    expect(fields[1].numericRange).toEqual({ min: 2, max: 10 })
  })

  it("handles missing field in entries (undefined values)", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 5 } },
      { userId: "u2", data: {} },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    // undefined → NaN → skipped, only score=5
    expect(fields[0].numericRange).toEqual({ min: 5, max: 5 })
  })

  it("handles negative numbers", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { temp: -10 } },
      { userId: "u2", data: { temp: 20 } },
      { userId: "u3", data: { temp: -5 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "temp", type: "number", weight: 1 },
    ]
    computeNumericRanges(entries, fields)
    expect(fields[0].numericRange).toEqual({ min: -10, max: 20 })
  })

  it("does not overwrite existing numericRange on non-numeric fields", () => {
    const fields: FieldMeta[] = [
      { sourceId: "name", type: "text", weight: 1, numericRange: { min: 0, max: 1 } },
    ]
    computeNumericRanges([{ userId: "u1", data: { name: "Alice" } }], fields)
    // Should not touch the existing numericRange on a text field
    expect(fields[0].numericRange).toEqual({ min: 0, max: 1 })
  })
})

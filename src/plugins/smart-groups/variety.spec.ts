import { describe, it, expect } from "vitest"
import { pairKey, buildPenaltyMatrix, getPenalty, type PenaltyMatrix } from "./variety"

// =============================================================================
// pairKey
// =============================================================================

describe("pairKey", () => {
  it("returns canonical order (a < b)", () => {
    expect(pairKey("alice", "bob")).toBe("alice:bob")
  })

  it("returns canonical order when args are reversed", () => {
    expect(pairKey("bob", "alice")).toBe("alice:bob")
  })

  it("returns consistent key regardless of argument order", () => {
    expect(pairKey("u1", "u2")).toBe(pairKey("u2", "u1"))
  })

  it("handles equal IDs", () => {
    expect(pairKey("u1", "u1")).toBe("u1:u1")
  })

  it("handles UUID-like IDs", () => {
    const a = "550e8400-e29b-41d4-a716-446655440000"
    const b = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    const key = pairKey(a, b)
    expect(key).toBe(`${a}:${b}`)
    expect(pairKey(b, a)).toBe(key)
  })
})

// =============================================================================
// buildPenaltyMatrix
// =============================================================================

describe("buildPenaltyMatrix", () => {
  it("builds penalties from co-occurrence counts", () => {
    const cooccurrences = new Map([
      ["u1:u2", 3],
      ["u1:u3", 7],
    ])

    const matrix = buildPenaltyMatrix(cooccurrences)

    expect(matrix.get("u1:u2")).toBeCloseTo(0.3) // 3/10
    expect(matrix.get("u1:u3")).toBeCloseTo(0.7) // 7/10
  })

  it("caps penalty at 1 when count >= maxLookback", () => {
    const cooccurrences = new Map([
      ["u1:u2", 10],
      ["u1:u3", 15],
    ])

    const matrix = buildPenaltyMatrix(cooccurrences)

    expect(matrix.get("u1:u2")).toBe(1)
    expect(matrix.get("u1:u3")).toBe(1)
  })

  it("uses custom maxLookback", () => {
    const cooccurrences = new Map([
      ["u1:u2", 3],
    ])

    const matrix = buildPenaltyMatrix(cooccurrences, 5)

    expect(matrix.get("u1:u2")).toBeCloseTo(0.6) // 3/5
  })

  it("returns 0 penalty for count=0", () => {
    const cooccurrences = new Map([
      ["u1:u2", 0],
    ])

    const matrix = buildPenaltyMatrix(cooccurrences)

    expect(matrix.get("u1:u2")).toBe(0)
  })

  it("returns empty matrix for empty cooccurrences", () => {
    const matrix = buildPenaltyMatrix(new Map())
    expect(matrix.size).toBe(0)
  })

  it("handles single-run lookback (maxLookback=1)", () => {
    const cooccurrences = new Map([
      ["u1:u2", 1],
    ])

    const matrix = buildPenaltyMatrix(cooccurrences, 1)
    expect(matrix.get("u1:u2")).toBe(1)
  })

  it("preserves all keys from input", () => {
    const cooccurrences = new Map([
      ["u1:u2", 2],
      ["u1:u3", 4],
      ["u2:u3", 6],
    ])

    const matrix = buildPenaltyMatrix(cooccurrences)

    expect(matrix.size).toBe(3)
    expect(matrix.has("u1:u2")).toBe(true)
    expect(matrix.has("u1:u3")).toBe(true)
    expect(matrix.has("u2:u3")).toBe(true)
  })
})

// =============================================================================
// getPenalty
// =============================================================================

describe("getPenalty", () => {
  it("returns penalty for known pair", () => {
    const matrix: PenaltyMatrix = new Map([
      ["u1:u2", 0.5],
    ])
    expect(getPenalty(matrix, "u1", "u2")).toBe(0.5)
  })

  it("returns penalty regardless of argument order", () => {
    const matrix: PenaltyMatrix = new Map([
      ["u1:u2", 0.7],
    ])
    expect(getPenalty(matrix, "u2", "u1")).toBe(0.7)
  })

  it("returns 0 for unknown pair", () => {
    const matrix: PenaltyMatrix = new Map([
      ["u1:u2", 0.5],
    ])
    expect(getPenalty(matrix, "u1", "u3")).toBe(0)
    expect(getPenalty(matrix, "u3", "u4")).toBe(0)
  })

  it("returns 0 for empty matrix", () => {
    const matrix: PenaltyMatrix = new Map()
    expect(getPenalty(matrix, "u1", "u2")).toBe(0)
  })

  it("handles same user pair", () => {
    const matrix: PenaltyMatrix = new Map([
      ["u1:u1", 0.5],
    ])
    expect(getPenalty(matrix, "u1", "u1")).toBe(0.5)
  })

  it("returns correct penalty for multiple pairs", () => {
    const matrix: PenaltyMatrix = new Map([
      ["u1:u2", 0.1],
      ["u1:u3", 0.5],
      ["u2:u3", 1.0],
    ])
    expect(getPenalty(matrix, "u1", "u2")).toBe(0.1)
    expect(getPenalty(matrix, "u3", "u1")).toBe(0.5)
    expect(getPenalty(matrix, "u2", "u3")).toBe(1.0)
  })
})

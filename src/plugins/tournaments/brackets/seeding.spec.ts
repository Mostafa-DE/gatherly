import { describe, it, expect } from "vitest"
import {
  padToPowerOfTwo,
  standardSeedPlacement,
  placeSeeds,
  snakeDraft,
  shuffleSeeds,
} from "./seeding"
import type { BracketEntry } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

describe("padToPowerOfTwo", () => {
  it("returns empty for empty input", () => {
    expect(padToPowerOfTwo([])).toEqual([])
  })

  it("returns 1 for 1 entry (1 is already a power of 2)", () => {
    const result = padToPowerOfTwo(makeEntries(1))
    expect(result).toHaveLength(1)
    expect(result[0]).not.toBeNull()
  })

  it("does not pad for exact power of two", () => {
    const entries = makeEntries(4)
    const result = padToPowerOfTwo(entries)
    expect(result).toHaveLength(4)
    expect(result.every((e) => e !== null)).toBe(true)
  })

  it("pads 3 entries to 4", () => {
    const result = padToPowerOfTwo(makeEntries(3))
    expect(result).toHaveLength(4)
    expect(result.filter((e) => e !== null)).toHaveLength(3)
  })

  it("pads 5 entries to 8", () => {
    const result = padToPowerOfTwo(makeEntries(5))
    expect(result).toHaveLength(8)
    expect(result.filter((e) => e !== null)).toHaveLength(5)
  })

  it("pads 16 entries correctly (already power of 2)", () => {
    const result = padToPowerOfTwo(makeEntries(16))
    expect(result).toHaveLength(16)
  })

  it("pads 17 entries to 32", () => {
    const result = padToPowerOfTwo(makeEntries(17))
    expect(result).toHaveLength(32)
  })
})

describe("standardSeedPlacement", () => {
  it("returns [1] for size 1", () => {
    expect(standardSeedPlacement(1)).toEqual([1])
  })

  it("returns [1, 2] for size 2", () => {
    expect(standardSeedPlacement(2)).toEqual([1, 2])
  })

  it("places seeds so 1 meets 2 only in final (size 4)", () => {
    const placement = standardSeedPlacement(4)
    expect(placement).toHaveLength(4)
    // Seed 1 and seed 2 should be in different halves
    const seed1Pos = placement.indexOf(1)
    const seed2Pos = placement.indexOf(2)
    const half1 = [0, 1]
    const half2 = [2, 3]
    const s1Half = half1.includes(seed1Pos) ? 1 : 2
    const s2Half = half2.includes(seed2Pos) ? 2 : 1
    expect(s1Half).not.toBe(s2Half)
  })

  it("contains all seeds 1..N for size 8", () => {
    const placement = standardSeedPlacement(8)
    expect(placement).toHaveLength(8)
    const sorted = [...placement].sort((a, b) => a - b)
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it("contains all seeds for size 16", () => {
    const placement = standardSeedPlacement(16)
    expect(placement).toHaveLength(16)
    const sorted = [...placement].sort((a, b) => a - b)
    expect(sorted).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  })
})

describe("placeSeeds", () => {
  it("places 4 entries with byes for 3 entries", () => {
    const entries = makeEntries(3)
    const result = placeSeeds(entries)
    expect(result).toHaveLength(4)
    // Should have exactly one null (bye)
    expect(result.filter((e) => e === null)).toHaveLength(1)
  })

  it("places 8 entries with no byes", () => {
    const entries = makeEntries(8)
    const result = placeSeeds(entries)
    expect(result).toHaveLength(8)
    expect(result.every((e) => e !== null)).toBe(true)
  })

  it("seed 1 is at position 0", () => {
    const entries = makeEntries(8)
    const result = placeSeeds(entries)
    expect(result[0]?.seed).toBe(1)
  })
})

describe("snakeDraft", () => {
  it("distributes evenly with exact divisor", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const groups = snakeDraft(items, 4)
    expect(groups).toHaveLength(4)
    expect(groups.every((g) => g.length === 2)).toBe(true)
  })

  it("snake order ensures balanced seeding", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const groups = snakeDraft(items, 2)
    // Forward: [1, 2], reverse: [4, 3], forward: [5, 6], reverse: [8, 7]
    // Group 0: [1, 4, 5, 8], Group 1: [2, 3, 6, 7]
    expect(groups[0]).toEqual([1, 4, 5, 8])
    expect(groups[1]).toEqual([2, 3, 6, 7])
  })

  it("handles uneven distribution", () => {
    const items = [1, 2, 3, 4, 5]
    const groups = snakeDraft(items, 3)
    expect(groups).toHaveLength(3)
    const totalItems = groups.reduce((sum, g) => sum + g.length, 0)
    expect(totalItems).toBe(5)
  })

  it("handles single group", () => {
    const items = [1, 2, 3]
    const groups = snakeDraft(items, 1)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual([1, 2, 3])
  })
})

describe("shuffleSeeds", () => {
  it("returns same number of entries", () => {
    const entries = makeEntries(8)
    const result = shuffleSeeds(entries, 42)
    expect(result).toHaveLength(8)
  })

  it("reassigns seeds 1..N", () => {
    const entries = makeEntries(8)
    const result = shuffleSeeds(entries, 42)
    const seeds = result.map((e) => e.seed).sort((a, b) => a - b)
    expect(seeds).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it("preserves all entry IDs", () => {
    const entries = makeEntries(8)
    const result = shuffleSeeds(entries, 42)
    const ids = result.map((e) => e.entryId).sort()
    const originalIds = entries.map((e) => e.entryId).sort()
    expect(ids).toEqual(originalIds)
  })

  it("is deterministic with same seed", () => {
    const entries = makeEntries(16)
    const r1 = shuffleSeeds(entries, 123)
    const r2 = shuffleSeeds(entries, 123)
    expect(r1.map((e) => e.entryId)).toEqual(r2.map((e) => e.entryId))
  })

  it("produces different order with different seed", () => {
    const entries = makeEntries(16)
    const r1 = shuffleSeeds(entries, 1)
    const r2 = shuffleSeeds(entries, 2)
    const ids1 = r1.map((e) => e.entryId)
    const ids2 = r2.map((e) => e.entryId)
    // Extremely unlikely to be identical
    expect(ids1).not.toEqual(ids2)
  })
})

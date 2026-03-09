import { describe, it, expect } from "vitest"
import { generateFreeForAll } from "./free-for-all"
import type { BracketEntry } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

describe("generateFreeForAll", () => {
  it("throws for fewer than 2 entries", () => {
    expect(() =>
      generateFreeForAll({ entries: makeEntries(1), config: {} })
    ).toThrow("at least 2")
  })

  describe("4 entries", () => {
    const result = generateFreeForAll({ entries: makeEntries(4), config: {} })
    const stage = result.stages[0]

    it("creates free_for_all stage", () => {
      expect(stage.stageType).toBe("free_for_all")
    })

    it("creates 1 round with 1 match", () => {
      expect(stage.rounds).toHaveLength(1)
      expect(stage.rounds[0].matches).toHaveLength(1)
    })

    it("match has all 4 entries", () => {
      expect(stage.rounds[0].matches[0].entries).toHaveLength(4)
    })

    it("entries have sequential slots", () => {
      const slots = stage.rounds[0].matches[0].entries.map((e) => e.slot)
      expect(slots).toEqual([1, 2, 3, 4])
    })

    it("not a bye match", () => {
      expect(stage.rounds[0].matches[0].isBye).toBe(false)
    })

    it("no edges", () => {
      expect(stage.edges).toHaveLength(0)
    })
  })

  describe("8 entries", () => {
    const result = generateFreeForAll({ entries: makeEntries(8), config: {} })
    const match = result.stages[0].rounds[0].matches[0]

    it("all 8 entries in single match", () => {
      expect(match.entries).toHaveLength(8)
    })

    it("entries ordered by seed", () => {
      const ids = match.entries.map((e) => e.entryId)
      expect(ids).toEqual([
        "entry-1", "entry-2", "entry-3", "entry-4",
        "entry-5", "entry-6", "entry-7", "entry-8",
      ])
    })
  })

  describe("32 entries", () => {
    const result = generateFreeForAll({ entries: makeEntries(32), config: {} })
    const match = result.stages[0].rounds[0].matches[0]

    it("all 32 entries in single match", () => {
      expect(match.entries).toHaveLength(32)
    })

    it("match number is 1", () => {
      expect(match.matchNumber).toBe(1)
    })
  })
})

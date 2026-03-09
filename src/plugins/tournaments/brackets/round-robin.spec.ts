import { describe, it, expect } from "vitest"
import { generateRoundRobin } from "./round-robin"
import type { BracketEntry } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

describe("generateRoundRobin", () => {
  it("throws for fewer than 2 entries", () => {
    expect(() =>
      generateRoundRobin({ entries: makeEntries(1), config: {} })
    ).toThrow("at least 2")
  })

  describe("4 entries (even)", () => {
    const result = generateRoundRobin({ entries: makeEntries(4), config: {} })
    const stage = result.stages[0]

    it("creates round_robin stage", () => {
      expect(stage.stageType).toBe("round_robin")
    })

    it("creates 3 rounds (n-1)", () => {
      expect(stage.rounds).toHaveLength(3)
    })

    it("each round has 2 matches (n/2)", () => {
      for (const round of stage.rounds) {
        expect(round.matches).toHaveLength(2)
      }
    })

    it("creates 6 total matches (n*(n-1)/2)", () => {
      const total = stage.rounds.reduce((sum, r) => sum + r.matches.length, 0)
      expect(total).toBe(6)
    })

    it("no edges (round robin has no progression)", () => {
      expect(stage.edges).toHaveLength(0)
    })

    it("no bye matches", () => {
      const byes = stage.rounds.flatMap((r) => r.matches.filter((m) => m.isBye))
      expect(byes).toHaveLength(0)
    })

    it("every entry plays every other entry exactly once", () => {
      const matchups = new Set<string>()
      for (const round of stage.rounds) {
        for (const match of round.matches) {
          const ids = match.entries
            .map((e) => e.entryId)
            .filter(Boolean)
            .sort()
          matchups.add(ids.join("-"))
        }
      }
      expect(matchups.size).toBe(6) // C(4,2) = 6
    })
  })

  describe("5 entries (odd)", () => {
    const result = generateRoundRobin({ entries: makeEntries(5), config: {} })
    const stage = result.stages[0]

    it("creates 5 rounds (effectiveN - 1 = 6 - 1)", () => {
      expect(stage.rounds).toHaveLength(5)
    })

    it("each round has 3 matches (effectiveN / 2 = 3)", () => {
      for (const round of stage.rounds) {
        expect(round.matches).toHaveLength(3)
      }
    })

    it("has exactly 5 bye matches (one per round)", () => {
      const byes = stage.rounds.flatMap((r) => r.matches.filter((m) => m.isBye))
      expect(byes).toHaveLength(5)
    })

    it("non-bye matches total to C(5,2) = 10", () => {
      const nonByes = stage.rounds.flatMap((r) => r.matches.filter((m) => !m.isBye))
      expect(nonByes).toHaveLength(10)
    })
  })

  describe("8 entries", () => {
    const result = generateRoundRobin({ entries: makeEntries(8), config: {} })
    const stage = result.stages[0]

    it("creates 7 rounds", () => {
      expect(stage.rounds).toHaveLength(7)
    })

    it("creates 28 total matches", () => {
      const total = stage.rounds.reduce((sum, r) => sum + r.matches.length, 0)
      expect(total).toBe(28)
    })

    it("no entry plays itself", () => {
      for (const round of stage.rounds) {
        for (const match of round.matches) {
          if (!match.isBye) {
            expect(match.entries[0].entryId).not.toBe(match.entries[1].entryId)
          }
        }
      }
    })
  })

  describe("16 entries", () => {
    const result = generateRoundRobin({ entries: makeEntries(16), config: {} })
    const stage = result.stages[0]

    it("creates 15 rounds", () => {
      expect(stage.rounds).toHaveLength(15)
    })

    it("creates 120 total matches (C(16,2))", () => {
      const total = stage.rounds.reduce((sum, r) => sum + r.matches.length, 0)
      expect(total).toBe(120)
    })
  })

  describe("match numbering", () => {
    const result = generateRoundRobin({ entries: makeEntries(4), config: {} })
    const numbers = result.stages[0].rounds.flatMap((r) =>
      r.matches.map((m) => m.matchNumber)
    )

    it("match numbers are unique", () => {
      expect(new Set(numbers).size).toBe(numbers.length)
    })

    it("match numbers are sequential", () => {
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6])
    })
  })
})

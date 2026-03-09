import { describe, it, expect } from "vitest"
import { generateSingleElimination } from "./single-elimination"
import type { BracketEntry, GeneratedEdge } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

function allMatchNumbers(output: ReturnType<typeof generateSingleElimination>): number[] {
  return output.stages[0].rounds.flatMap((r) => r.matches.map((m) => m.matchNumber))
}

function validateEdgeGraph(edges: GeneratedEdge[], matchNumbers: number[]) {
  const matchSet = new Set(matchNumbers)

  // All edge references should point to valid matches
  for (const edge of edges) {
    expect(matchSet.has(edge.fromMatchNumber)).toBe(true)
    expect(matchSet.has(edge.toMatchNumber)).toBe(true)
  }

  // No duplicate toMatchId + toSlot
  const slotKeys = edges.map((e) => `${e.toMatchNumber}-${e.toSlot}`)
  expect(new Set(slotKeys).size).toBe(slotKeys.length)
}

describe("generateSingleElimination", () => {
  it("throws for fewer than 2 entries", () => {
    expect(() =>
      generateSingleElimination({ entries: makeEntries(1), config: {} })
    ).toThrow("at least 2")
  })

  describe("4 entries", () => {
    const result = generateSingleElimination({ entries: makeEntries(4), config: {} })
    const stage = result.stages[0]

    it("creates single elimination stage", () => {
      expect(stage.stageType).toBe("single_elimination")
      expect(stage.stageOrder).toBe(1)
    })

    it("creates 2 rounds", () => {
      expect(stage.rounds).toHaveLength(2)
    })

    it("creates 3 total matches (2 + 1)", () => {
      const total = stage.rounds.reduce((sum, r) => sum + r.matches.length, 0)
      expect(total).toBe(3)
    })

    it("round 1 has 2 matches", () => {
      expect(stage.rounds[0].matches).toHaveLength(2)
    })

    it("final has 1 match", () => {
      expect(stage.rounds[1].matches).toHaveLength(1)
    })

    it("round 1 matches have entries assigned", () => {
      for (const match of stage.rounds[0].matches) {
        expect(match.entries).toHaveLength(2)
        expect(match.isBye).toBe(false)
      }
    })

    it("creates 2 winner edges to final", () => {
      expect(stage.edges).toHaveLength(2)
      expect(stage.edges.every((e) => e.outcomeType === "winner")).toBe(true)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })
  })

  describe("8 entries", () => {
    const result = generateSingleElimination({ entries: makeEntries(8), config: {} })
    const stage = result.stages[0]

    it("creates 3 rounds", () => {
      expect(stage.rounds).toHaveLength(3)
    })

    it("creates 7 total matches (4 + 2 + 1)", () => {
      const total = stage.rounds.reduce((sum, r) => sum + r.matches.length, 0)
      expect(total).toBe(7)
    })

    it("has 6 edges (all winner)", () => {
      expect(stage.edges).toHaveLength(6)
      expect(stage.edges.every((e) => e.outcomeType === "winner")).toBe(true)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })

    it("no byes when participant count is power of 2", () => {
      const byes = stage.rounds[0].matches.filter((m) => m.isBye)
      expect(byes).toHaveLength(0)
    })
  })

  describe("6 entries (non-power of 2)", () => {
    const result = generateSingleElimination({ entries: makeEntries(6), config: {} })
    const stage = result.stages[0]

    it("pads to 8 (3 rounds)", () => {
      expect(stage.rounds).toHaveLength(3)
    })

    it("round 1 has 4 matches (8/2)", () => {
      expect(stage.rounds[0].matches).toHaveLength(4)
    })

    it("has 2 bye matches in round 1", () => {
      const byes = stage.rounds[0].matches.filter((m) => m.isBye)
      expect(byes).toHaveLength(2)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })
  })

  describe("16 entries", () => {
    const result = generateSingleElimination({ entries: makeEntries(16), config: {} })
    const stage = result.stages[0]

    it("creates 4 rounds", () => {
      expect(stage.rounds).toHaveLength(4)
    })

    it("creates 15 total matches (8+4+2+1)", () => {
      const total = stage.rounds.reduce((sum, r) => sum + r.matches.length, 0)
      expect(total).toBe(15)
    })

    it("has 14 edges", () => {
      expect(stage.edges).toHaveLength(14)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })
  })

  describe("32 entries", () => {
    const result = generateSingleElimination({ entries: makeEntries(32), config: {} })
    const stage = result.stages[0]

    it("creates 5 rounds", () => {
      expect(stage.rounds).toHaveLength(5)
    })

    it("creates 31 total matches", () => {
      const total = stage.rounds.reduce((sum, r) => sum + r.matches.length, 0)
      expect(total).toBe(31)
    })
  })

  describe("third place match", () => {
    const result = generateSingleElimination({
      entries: makeEntries(8),
      config: { thirdPlaceMatch: true },
    })
    const stage = result.stages[0]

    it("adds an extra round for third place", () => {
      expect(stage.rounds).toHaveLength(4) // 3 normal + 1 third place
    })

    it("third place match receives losers from semifinals", () => {
      const loserEdges = stage.edges.filter((e) => e.outcomeType === "loser")
      expect(loserEdges).toHaveLength(2)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })
  })

  describe("match numbering", () => {
    const result = generateSingleElimination({ entries: makeEntries(8), config: {} })
    const numbers = allMatchNumbers(result)

    it("match numbers are sequential starting from 1", () => {
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7])
    })

    it("match numbers are unique", () => {
      expect(new Set(numbers).size).toBe(numbers.length)
    })
  })
})

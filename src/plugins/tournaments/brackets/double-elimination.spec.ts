import { describe, it, expect } from "vitest"
import { generateDoubleElimination } from "./double-elimination"
import type { BracketEntry, GeneratedEdge } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

function allMatchNumbers(output: ReturnType<typeof generateDoubleElimination>): number[] {
  return output.stages[0].rounds.flatMap((r) => r.matches.map((m) => m.matchNumber))
}

function validateEdgeGraph(edges: GeneratedEdge[], matchNumbers: number[]) {
  const matchSet = new Set(matchNumbers)

  for (const edge of edges) {
    expect(matchSet.has(edge.fromMatchNumber)).toBe(true)
    expect(matchSet.has(edge.toMatchNumber)).toBe(true)
  }

  // No duplicate toMatchNumber + toSlot
  const slotKeys = edges.map((e) => `${e.toMatchNumber}-${e.toSlot}`)
  expect(new Set(slotKeys).size).toBe(slotKeys.length)
}

describe("generateDoubleElimination", () => {
  it("throws for fewer than 4 entries", () => {
    expect(() =>
      generateDoubleElimination({ entries: makeEntries(3), config: {} })
    ).toThrow("at least 4")
  })

  describe("4 entries", () => {
    const result = generateDoubleElimination({ entries: makeEntries(4), config: {} })
    const stage = result.stages[0]

    it("creates double_elimination stage", () => {
      expect(stage.stageType).toBe("double_elimination")
    })

    it("has both winner and loser edges", () => {
      const winnerEdges = stage.edges.filter((e) => e.outcomeType === "winner")
      const loserEdges = stage.edges.filter((e) => e.outcomeType === "loser")
      expect(winnerEdges.length).toBeGreaterThan(0)
      expect(loserEdges.length).toBeGreaterThan(0)
    })

    it("ends with grand final", () => {
      const lastRound = stage.rounds[stage.rounds.length - 1]
      expect(lastRound.matches).toHaveLength(1)
    })

    it("grand final receives edges from both WB and LB winners", () => {
      const lastMatch = stage.rounds[stage.rounds.length - 1].matches[0]
      const edgesToGF = stage.edges.filter(
        (e) => e.toMatchNumber === lastMatch.matchNumber
      )
      expect(edgesToGF).toHaveLength(2)
      expect(edgesToGF.every((e) => e.outcomeType === "winner")).toBe(true)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })

    it("match numbers are unique", () => {
      const numbers = allMatchNumbers(result)
      expect(new Set(numbers).size).toBe(numbers.length)
    })
  })

  describe("8 entries", () => {
    const result = generateDoubleElimination({ entries: makeEntries(8), config: {} })
    const stage = result.stages[0]

    it("WB has 3 rounds (log2(8))", () => {
      // WB rounds are numbered 1, 2, 3
      const wbRounds = stage.rounds.filter((r) => r.roundNumber <= 3)
      expect(wbRounds).toHaveLength(3)
    })

    it("WB round 1 has 4 matches", () => {
      expect(stage.rounds[0].matches).toHaveLength(4)
    })

    it("has loser edges from WB matches to LB", () => {
      const loserEdges = stage.edges.filter((e) => e.outcomeType === "loser")
      expect(loserEdges.length).toBeGreaterThan(0)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })

    it("match numbers are unique and sequential", () => {
      const numbers = allMatchNumbers(result)
      expect(new Set(numbers).size).toBe(numbers.length)
      const sorted = [...numbers].sort((a, b) => a - b)
      expect(sorted[0]).toBe(1)
      expect(sorted[sorted.length - 1]).toBe(numbers.length)
    })
  })

  describe("16 entries", () => {
    const result = generateDoubleElimination({ entries: makeEntries(16), config: {} })
    const stage = result.stages[0]

    it("WB has 4 rounds", () => {
      const wbRounds = stage.rounds.filter((r) => r.roundNumber <= 4)
      expect(wbRounds).toHaveLength(4)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })

    it("all round 1 entries are assigned", () => {
      for (const match of stage.rounds[0].matches) {
        expect(match.entries).toHaveLength(2)
        expect(match.entries[0].entryId).not.toBeNull()
        expect(match.entries[1].entryId).not.toBeNull()
      }
    })
  })

  describe("32 entries", () => {
    const result = generateDoubleElimination({ entries: makeEntries(32), config: {} })
    const stage = result.stages[0]

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })

    it("WB round 1 has 16 matches", () => {
      expect(stage.rounds[0].matches).toHaveLength(16)
    })
  })

  describe("non-power-of-2 entries (6)", () => {
    const result = generateDoubleElimination({ entries: makeEntries(6), config: {} })
    const stage = result.stages[0]

    it("pads to 8 bracket", () => {
      // WB round 1 should have 4 matches (8/2)
      expect(stage.rounds[0].matches).toHaveLength(4)
    })

    it("has bye matches in round 1", () => {
      const byes = stage.rounds[0].matches.filter((m) => m.isBye)
      expect(byes).toHaveLength(2)
    })

    it("has valid edge graph", () => {
      validateEdgeGraph(stage.edges, allMatchNumbers(result))
    })
  })
})

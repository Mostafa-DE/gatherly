import { describe, it, expect } from "vitest"
import { generateGroupKnockout, generateKnockoutFromGroups } from "./group-knockout"
import type { BracketEntry } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

function getGroupEntryIds(
  result: ReturnType<typeof generateGroupKnockout>,
  groupIndex: number
) {
  return [...new Set(
    result.stages[0].rounds
      .filter((round) => round.groupIndex === groupIndex)
      .flatMap((round) => round.matches)
      .flatMap((match) => match.entries)
      .map((entry) => entry.entryId)
      .filter((entryId): entryId is string => entryId !== null)
  )].sort()
}

describe("generateGroupKnockout", () => {
  it("throws when not enough entries for groups", () => {
    expect(() =>
      generateGroupKnockout({
        entries: makeEntries(6),
        config: { groupCount: 4 },
      })
    ).toThrow("at least 8")
  })

  describe("8 entries, 2 groups", () => {
    const result = generateGroupKnockout({
      entries: makeEntries(8),
      config: { groupCount: 2, advancePerGroup: 2 },
    })

    it("creates 2 stages (group + knockout)", () => {
      expect(result.stages).toHaveLength(2)
    })

    it("first stage is group type", () => {
      expect(result.stages[0].stageType).toBe("group")
      expect(result.stages[0].stageOrder).toBe(1)
    })

    it("second stage is single_elimination placeholder", () => {
      expect(result.stages[1].stageType).toBe("single_elimination")
      expect(result.stages[1].stageOrder).toBe(2)
    })

    it("group stage has 2 groups", () => {
      expect(result.stages[0].groups).toHaveLength(2)
      expect(result.stages[0].groups![0].name).toBe("Group A")
      expect(result.stages[0].groups![1].name).toBe("Group B")
    })

    it("group stage has no edges", () => {
      expect(result.stages[0].edges).toHaveLength(0)
    })

    it("group stage has rounds with groupIndex", () => {
      for (const round of result.stages[0].rounds) {
        expect(round.groupIndex).toBeDefined()
      }
    })

    it("each group has all round-robin matches", () => {
      // 4 entries per group → C(4,2) = 6 matches per group
      const group0Matches = result.stages[0].rounds
        .filter((r) => r.groupIndex === 0)
        .flatMap((r) => r.matches)
      const group1Matches = result.stages[0].rounds
        .filter((r) => r.groupIndex === 1)
        .flatMap((r) => r.matches)
      expect(group0Matches).toHaveLength(6)
      expect(group1Matches).toHaveLength(6)
    })

    it("snake drafts seeded entries into balanced groups", () => {
      expect(getGroupEntryIds(result, 0)).toEqual([
        "entry-1",
        "entry-4",
        "entry-5",
        "entry-8",
      ])
      expect(getGroupEntryIds(result, 1)).toEqual([
        "entry-2",
        "entry-3",
        "entry-6",
        "entry-7",
      ])
    })

    it("knockout stage is empty placeholder", () => {
      expect(result.stages[1].rounds).toHaveLength(0)
      expect(result.stages[1].edges).toHaveLength(0)
    })

    it("knockout stage config has advancePerGroup", () => {
      expect(result.stages[1].config.advancePerGroup).toBe(2)
    })
  })

  describe("16 entries, 4 groups", () => {
    const result = generateGroupKnockout({
      entries: makeEntries(16),
      config: { groupCount: 4, advancePerGroup: 2 },
    })

    it("creates 2 stages", () => {
      expect(result.stages).toHaveLength(2)
    })

    it("group stage has 4 groups", () => {
      expect(result.stages[0].groups).toHaveLength(4)
    })

    it("each group has 4 entries (C(4,2) = 6 matches)", () => {
      for (let g = 0; g < 4; g++) {
        const groupMatches = result.stages[0].rounds
          .filter((r) => r.groupIndex === g)
          .flatMap((r) => r.matches)
        expect(groupMatches).toHaveLength(6)
      }
    })

    it("match numbers are unique", () => {
      const allNumbers = result.stages[0].rounds.flatMap((r) =>
        r.matches.map((m) => m.matchNumber)
      )
      expect(new Set(allNumbers).size).toBe(allNumbers.length)
    })
  })

  describe("32 entries, 4 groups", () => {
    const result = generateGroupKnockout({
      entries: makeEntries(32),
      config: { groupCount: 4, advancePerGroup: 2 },
    })

    it("each group has 8 entries (C(8,2) = 28 matches)", () => {
      for (let g = 0; g < 4; g++) {
        const groupMatches = result.stages[0].rounds
          .filter((r) => r.groupIndex === g)
          .flatMap((r) => r.matches)
        expect(groupMatches).toHaveLength(28)
      }
    })
  })

  describe("defaults", () => {
    it("defaults to 4 groups and 2 advance per group", () => {
      const result = generateGroupKnockout({
        entries: makeEntries(16),
        config: {},
      })
      expect(result.stages[0].groups).toHaveLength(4)
      expect(result.stages[1].config.advancePerGroup).toBe(2)
    })
  })
})

describe("generateKnockoutFromGroups", () => {
  it("generates single elimination from advancing entries", () => {
    const advancing = makeEntries(8)
    const result = generateKnockoutFromGroups(advancing, {})

    expect(result.stages).toHaveLength(1)
    expect(result.stages[0].stageType).toBe("single_elimination")
  })

  it("re-seeds entries starting from 1", () => {
    const advancing: BracketEntry[] = [
      { entryId: "a", seed: 10 },
      { entryId: "b", seed: 20 },
      { entryId: "c", seed: 30 },
      { entryId: "d", seed: 40 },
    ]
    const result = generateKnockoutFromGroups(advancing, {})
    // Should work fine as entries are re-seeded
    expect(result.stages[0].rounds[0].matches).toHaveLength(2)
  })

  it("supports third place match", () => {
    const advancing = makeEntries(4)
    const result = generateKnockoutFromGroups(advancing, { thirdPlaceMatch: true })
    const stage = result.stages[0]
    const loserEdges = stage.edges.filter((e) => e.outcomeType === "loser")
    expect(loserEdges).toHaveLength(2)
  })
})

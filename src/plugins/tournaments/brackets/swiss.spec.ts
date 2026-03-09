import { describe, it, expect } from "vitest"
import { generateSwissFirstRound, generateSwissRound } from "./swiss"
import type { BracketEntry } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

describe("generateSwissFirstRound", () => {
  it("throws for fewer than 4 entries", () => {
    expect(() =>
      generateSwissFirstRound({ entries: makeEntries(3), config: {} })
    ).toThrow("at least 4")
  })

  describe("4 entries", () => {
    const result = generateSwissFirstRound({ entries: makeEntries(4), config: {} })
    const stage = result.stages[0]

    it("creates swiss stage", () => {
      expect(stage.stageType).toBe("swiss")
    })

    it("creates 1 round", () => {
      expect(stage.rounds).toHaveLength(1)
    })

    it("creates 2 matches", () => {
      expect(stage.rounds[0].matches).toHaveLength(2)
    })

    it("no byes with even count", () => {
      const byes = stage.rounds[0].matches.filter((m) => m.isBye)
      expect(byes).toHaveLength(0)
    })

    it("pairs adjacent seeds (1v2, 3v4)", () => {
      const m1 = stage.rounds[0].matches[0]
      const m2 = stage.rounds[0].matches[1]
      expect(m1.entries[0].entryId).toBe("entry-1")
      expect(m1.entries[1].entryId).toBe("entry-2")
      expect(m2.entries[0].entryId).toBe("entry-3")
      expect(m2.entries[1].entryId).toBe("entry-4")
    })

    it("no edges (swiss has no auto-progression)", () => {
      expect(stage.edges).toHaveLength(0)
    })

    it("config contains swissRounds", () => {
      expect(stage.config).toHaveProperty("swissRounds")
    })
  })

  describe("5 entries (odd)", () => {
    const result = generateSwissFirstRound({ entries: makeEntries(5), config: {} })
    const stage = result.stages[0]

    it("creates 3 matches (2 normal + 1 bye)", () => {
      expect(stage.rounds[0].matches).toHaveLength(3)
    })

    it("last match is a bye", () => {
      const last = stage.rounds[0].matches[2]
      expect(last.isBye).toBe(true)
      expect(last.entries[1].entryId).toBeNull()
    })

    it("bye goes to lowest seeded (last) entry", () => {
      const byeMatch = stage.rounds[0].matches.find((m) => m.isBye)!
      expect(byeMatch.entries[0].entryId).toBe("entry-5")
    })
  })

  describe("8 entries", () => {
    const result = generateSwissFirstRound({ entries: makeEntries(8), config: {} })
    const stage = result.stages[0]

    it("creates 4 matches", () => {
      expect(stage.rounds[0].matches).toHaveLength(4)
    })

    it("all entries are present in matches", () => {
      const entryIds = stage.rounds[0].matches.flatMap((m) =>
        m.entries.map((e) => e.entryId).filter(Boolean)
      )
      expect(entryIds).toHaveLength(8)
    })
  })

  describe("16 entries", () => {
    const result = generateSwissFirstRound({ entries: makeEntries(16), config: {} })

    it("creates 8 matches", () => {
      expect(result.stages[0].rounds[0].matches).toHaveLength(8)
    })
  })

  describe("32 entries", () => {
    const result = generateSwissFirstRound({ entries: makeEntries(32), config: {} })

    it("creates 16 matches", () => {
      expect(result.stages[0].rounds[0].matches).toHaveLength(16)
    })
  })

  describe("custom swissRounds config", () => {
    it("uses provided swissRounds value", () => {
      const result = generateSwissFirstRound({
        entries: makeEntries(8),
        config: { swissRounds: 5 },
      })
      expect(result.stages[0].config.swissRounds).toBe(5)
    })

    it("defaults to ceil(log2(n))", () => {
      const result = generateSwissFirstRound({
        entries: makeEntries(8),
        config: {},
      })
      expect(result.stages[0].config.swissRounds).toBe(3) // ceil(log2(8))
    })
  })
})

describe("generateSwissRound", () => {
  function makeStandings(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      entryId: `entry-${i + 1}`,
      seed: i + 1,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      opponentsPlayed: new Set<string>(),
    }))
  }

  it("pairs all entries in round 2", () => {
    const standings = makeStandings(4)
    // Simulate round 1 results: entry-1 beat entry-2, entry-3 beat entry-4
    standings[0].points = 3
    standings[0].wins = 1
    standings[0].opponentsPlayed.add("entry-2")
    standings[1].losses = 1
    standings[1].opponentsPlayed.add("entry-1")
    standings[2].points = 3
    standings[2].wins = 1
    standings[2].opponentsPlayed.add("entry-4")
    standings[3].losses = 1
    standings[3].opponentsPlayed.add("entry-3")

    const round = generateSwissRound(standings, 2)
    expect(round.roundNumber).toBe(2)
    expect(round.matches).toHaveLength(2)
  })

  it("avoids rematches when possible", () => {
    const standings = makeStandings(4)
    standings[0].points = 3
    standings[0].opponentsPlayed.add("entry-2")
    standings[1].opponentsPlayed.add("entry-1")
    standings[2].points = 3
    standings[2].opponentsPlayed.add("entry-4")
    standings[3].opponentsPlayed.add("entry-3")

    const round = generateSwissRound(standings, 2)

    for (const match of round.matches) {
      if (!match.isBye) {
        const id1 = match.entries[0].entryId!
        const id2 = match.entries[1].entryId!
        const s1 = standings.find((s) => s.entryId === id1)!
        // Verify no rematch
        expect(s1.opponentsPlayed.has(id2)).toBe(false)
      }
    }
  })

  it("gives bye to lowest ranked with odd count", () => {
    const standings = makeStandings(5)
    const round = generateSwissRound(standings, 2)
    const byeMatch = round.matches.find((m) => m.isBye)
    expect(byeMatch).toBeDefined()
    expect(byeMatch!.entries[0].entryId).toBe("entry-5")
  })

  it("skips bye for player who already had one", () => {
    const standings = makeStandings(5)
    standings[4].opponentsPlayed.add("BYE")
    const round = generateSwissRound(standings, 2)
    const byeMatch = round.matches.find((m) => m.isBye)
    expect(byeMatch).toBeDefined()
    expect(byeMatch!.entries[0].entryId).not.toBe("entry-5")
  })
})

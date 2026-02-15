import { describe, expect, it } from "vitest"
import {
  getDomain,
  getFormatFromCapacity,
  getMatchModeFormats,
  isDomainValid,
  listDomains,
} from "./index"

function getRequiredMatchConfig(domainId: string) {
  const domain = getDomain(domainId)
  expect(domain).toBeDefined()
  expect(domain?.matchConfig).toBeDefined()
  return domain!.matchConfig!
}

describe("ranking domain utilities", () => {
  describe("domain registry", () => {
    it("returns domains by id and undefined for unknown domains", () => {
      const football = getDomain("football")

      expect(football?.id).toBe("football")
      expect(getDomain("unknown-domain")).toBeUndefined()
    })

    it("lists available domains and keeps ids unique", () => {
      const domains = listDomains()
      const ids = domains.map((domain) => domain.id)

      expect(ids).toEqual(expect.arrayContaining([
        "football",
        "padel",
        "reading",
        "badminton",
        "laser-tag",
      ]))
      expect(new Set(ids).size).toBe(ids.length)
    })

    it("validates whether a domain id exists", () => {
      expect(isDomainValid("football")).toBe(true)
      expect(isDomainValid("reading")).toBe(true)
      expect(isDomainValid("not-a-domain")).toBe(false)
    })
  })

  describe("getMatchModeFormats", () => {
    it("returns match-mode format metadata for match-enabled domains", () => {
      expect(getMatchModeFormats("football")).toEqual({
        formats: ["5v5", "6v6", "7v7", "11v11"],
        defaultFormat: "5v5",
        formatRules: {
          "5v5": { playersPerTeam: 5 },
          "6v6": { playersPerTeam: 6 },
          "7v7": { playersPerTeam: 7 },
          "11v11": { playersPerTeam: 11 },
        },
      })
    })

    it("returns null for non-match and unknown domains", () => {
      expect(getMatchModeFormats("reading")).toBeNull()
      expect(getMatchModeFormats("unknown-domain")).toBeNull()
    })
  })

  describe("getFormatFromCapacity", () => {
    it("derives fixed-size formats from capacity", () => {
      expect(getFormatFromCapacity("padel", 2)).toBe("singles")
      expect(getFormatFromCapacity("padel", 4)).toBe("doubles")
    })

    it("derives ranged formats from capacity", () => {
      expect(getFormatFromCapacity("laser-tag", 2)).toBe("team")
      expect(getFormatFromCapacity("laser-tag", 26)).toBe("team")
    })

    it("returns null when capacity does not map to a format", () => {
      expect(getFormatFromCapacity("laser-tag", 28)).toBeNull()
      expect(getFormatFromCapacity("reading", 2)).toBeNull()
      expect(getFormatFromCapacity("unknown-domain", 2)).toBeNull()
    })
  })

  describe("football validator and resolver", () => {
    const matchConfig = getRequiredMatchConfig("football")

    it("accepts valid score payloads and rejects invalid ones", () => {
      expect(matchConfig.validateScores({ team1: 3, team2: 1 })).toEqual({ isValid: true })

      expect(matchConfig.validateScores(null)).toEqual({
        isValid: false,
        error: "Scores must be an object with team1 and team2",
      })
      expect(matchConfig.validateScores({ team1: "3", team2: 1 })).toEqual({
        isValid: false,
        error: "Both team scores must be numbers",
      })
      expect(matchConfig.validateScores({ team1: 1.5, team2: 1 })).toEqual({
        isValid: false,
        error: "Goals must be whole numbers",
      })
      expect(matchConfig.validateScores({ team1: -1, team2: 1 })).toEqual({
        isValid: false,
        error: "Goals cannot be negative",
      })
    })

    it("resolves winners and derived stats", () => {
      expect(matchConfig.resolveMatch({ team1: 2, team2: 0 })).toEqual({
        winner: "team1",
        team1Stats: {
          matches_played: 1,
          wins: 1,
          draws: 0,
          losses: 0,
          goals_scored: 2,
          goals_conceded: 0,
        },
        team2Stats: {
          matches_played: 1,
          wins: 0,
          draws: 0,
          losses: 1,
          goals_scored: 0,
          goals_conceded: 2,
        },
      })

      expect(matchConfig.resolveMatch({ team1: 1, team2: 1 }).winner).toBe("draw")
    })
  })

  describe("padel validator and resolver", () => {
    const matchConfig = getRequiredMatchConfig("padel")

    it("accepts valid set payloads and rejects invalid ones", () => {
      expect(matchConfig.validateScores([
        [6, 4],
        [7, 5],
      ])).toEqual({ isValid: true })

      expect(matchConfig.validateScores({})).toEqual({
        isValid: false,
        error: "Scores must be an array of sets",
      })
      expect(matchConfig.validateScores([])).toEqual({
        isValid: false,
        error: "At least 1 set is required",
      })
      expect(matchConfig.validateScores([[6]])).toEqual({
        isValid: false,
        error: "Set 1: must be two numbers",
      })
      expect(matchConfig.validateScores([[6, 6]])).toEqual({
        isValid: false,
        error: "Set 1: invalid score (6-6)",
      })
    })

    it("resolves winners and derived set stats", () => {
      expect(matchConfig.resolveMatch([
        [6, 4],
        [5, 7],
        [7, 6],
      ])).toEqual({
        winner: "team1",
        team1Stats: {
          matches_played: 1,
          sets_won: 2,
          sets_lost: 1,
          wins: 1,
          losses: 0,
        },
        team2Stats: {
          matches_played: 1,
          sets_won: 1,
          sets_lost: 2,
          wins: 0,
          losses: 1,
        },
      })

      expect(matchConfig.resolveMatch([
        [6, 4],
        [4, 6],
      ]).winner).toBe("draw")
    })
  })

  describe("laser-tag validator and resolver", () => {
    const matchConfig = getRequiredMatchConfig("laser-tag")

    it("accepts valid score payloads and rejects invalid ones", () => {
      expect(matchConfig.validateScores({ team1: 105, team2: 98 })).toEqual({
        isValid: true,
      })

      expect(matchConfig.validateScores("bad")).toEqual({
        isValid: false,
        error: "Scores must be an object with team1 and team2",
      })
      expect(matchConfig.validateScores({ team1: 10.5, team2: 10 })).toEqual({
        isValid: false,
        error: "Scores must be whole numbers",
      })
      expect(matchConfig.validateScores({ team1: -1, team2: 10 })).toEqual({
        isValid: false,
        error: "Scores cannot be negative",
      })
    })

    it("resolves winners and derived match stats", () => {
      expect(matchConfig.resolveMatch({ team1: 10, team2: 11 })).toEqual({
        winner: "team2",
        team1Stats: {
          matches_played: 1,
          wins: 0,
          draws: 0,
          losses: 1,
        },
        team2Stats: {
          matches_played: 1,
          wins: 1,
          draws: 0,
          losses: 0,
        },
      })

      expect(matchConfig.resolveMatch({ team1: 9, team2: 9 }).winner).toBe("draw")
    })
  })

  describe("badminton validator and resolver", () => {
    const matchConfig = getRequiredMatchConfig("badminton")

    it("accepts valid game payloads and rejects invalid ones", () => {
      expect(matchConfig.validateScores([
        [21, 19],
        [20, 22],
        [30, 29],
      ])).toEqual({ isValid: true })

      expect(matchConfig.validateScores({})).toEqual({
        isValid: false,
        error: "Scores must be an array of games",
      })
      expect(matchConfig.validateScores([
        [21, 19],
        [21, 19],
        [21, 19],
        [21, 19],
      ])).toEqual({
        isValid: false,
        error: "Maximum 3 games allowed (best of 3)",
      })
      expect(matchConfig.validateScores([[21, 20]])).toEqual({
        isValid: false,
        error: "Game 1: invalid score (21-20)",
      })
      expect(matchConfig.validateScores([[21]])).toEqual({
        isValid: false,
        error: "Game 1: must be two numbers",
      })
    })

    it("resolves winners and derived game stats", () => {
      expect(matchConfig.resolveMatch([
        [21, 19],
        [19, 21],
        [21, 18],
      ])).toEqual({
        winner: "team1",
        team1Stats: {
          matches_played: 1,
          wins: 1,
          losses: 0,
          games_won: 2,
          games_lost: 1,
        },
        team2Stats: {
          matches_played: 1,
          wins: 0,
          losses: 1,
          games_won: 1,
          games_lost: 2,
        },
      })

      expect(matchConfig.resolveMatch([
        [21, 10],
        [10, 21],
      ]).winner).toBe("draw")
    })
  })
})

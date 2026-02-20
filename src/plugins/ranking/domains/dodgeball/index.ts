import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { DodgeballMatchInput } from "./match-input"
import { DodgeballMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type DodgeballScore = { team1: number; team2: number }

export function validateDodgeballScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both team scores must be numbers" }
  }

  if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
    return { isValid: false, error: "Rounds must be whole numbers" }
  }

  if (team1 < 0 || team2 < 0) {
    return { isValid: false, error: "Rounds cannot be negative" }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveDodgeballMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as DodgeballScore

  const winner =
    team1 > team2
      ? ("team1" as const)
      : team2 > team1
        ? ("team2" as const)
        : ("draw" as const)

  const baseStats = {
    matches_played: 1,
    wins: 0,
    draws: 0,
    losses: 0,
    rounds_won: 0,
    rounds_lost: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
      rounds_won: team1,
      rounds_lost: team2,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
      rounds_won: team2,
      rounds_lost: team1,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const dodgeballDomain: RankingDomain = {
  id: "dodgeball",
  name: "Dodgeball",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
    { id: "rounds_won", label: "Rounds Won" },
    { id: "rounds_lost", label: "Rounds Lost" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(rounds_won - rounds_lost)", direction: "desc" },
  ],
  defaultLevels: [
    { name: "Recreational", color: "#6B7280" },
    { name: "Intermediate", color: "#3B82F6" },
    { name: "Competitive", color: "#10B981" },
  ],
  attributeFields: [
    {
      id: "throw_hand",
      label: "Throwing Hand",
      options: ["Right", "Left"],
    },
  ],
  matchConfig: {
    supportedFormats: ["6v6", "8v8"],
    defaultFormat: "6v6",
    formatRules: {
      "6v6": { playersPerTeam: 6 },
      "8v8": { playersPerTeam: 8 },
    },
    validateScores: validateDodgeballScores,
    resolveMatch: resolveDodgeballMatch,
    MatchInput: DodgeballMatchInput,
    MatchDisplay: DodgeballMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { FoosballMatchInput } from "./match-input"
import { FoosballMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type FoosballScore = { team1: number; team2: number }

export function validateFoosballScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both team scores must be numbers" }
  }

  if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
    return { isValid: false, error: "Goals must be whole numbers" }
  }

  if (team1 < 0 || team2 < 0) {
    return { isValid: false, error: "Goals cannot be negative" }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveFoosballMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as FoosballScore

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
    goals_scored: 0,
    goals_conceded: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
      goals_scored: team1,
      goals_conceded: team2,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
      goals_scored: team2,
      goals_conceded: team1,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const foosballDomain: RankingDomain = {
  id: "foosball",
  name: "Foosball",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
    { id: "goals_scored", label: "Goals Scored" },
    { id: "goals_conceded", label: "Goals Conceded" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(goals_scored - goals_conceded)", direction: "desc" },
  ],
  defaultLevels: [
    { name: "Beginner", color: "#9CA3AF" },
    { name: "D", color: "#6B7280" },
    { name: "C", color: "#3B82F6" },
    { name: "B", color: "#10B981" },
    { name: "A", color: "#F59E0B" },
    { name: "AA", color: "#EF4444" },
  ],
  attributeFields: [
    {
      id: "preferred_position",
      label: "Preferred Position",
      options: ["Offense", "Defense"],
    },
  ],
  matchConfig: {
    supportedFormats: ["singles", "doubles"],
    defaultFormat: "doubles",
    formatRules: {
      singles: { playersPerTeam: 1 },
      doubles: { playersPerTeam: 2 },
    },
    validateScores: validateFoosballScores,
    resolveMatch: resolveFoosballMatch,
    MatchInput: FoosballMatchInput,
    MatchDisplay: FoosballMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

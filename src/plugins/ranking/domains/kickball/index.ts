import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { KickballMatchInput } from "./match-input"
import { KickballMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type KickballScore = { team1: number; team2: number }

export function validateKickballScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both team scores must be numbers" }
  }

  if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
    return { isValid: false, error: "Runs must be whole numbers" }
  }

  if (team1 < 0 || team2 < 0) {
    return { isValid: false, error: "Runs cannot be negative" }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveKickballMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as KickballScore

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
    runs_scored: 0,
    runs_conceded: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
      runs_scored: team1,
      runs_conceded: team2,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
      runs_scored: team2,
      runs_conceded: team1,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const kickballDomain: RankingDomain = {
  id: "kickball",
  name: "Kickball",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
    { id: "runs_scored", label: "Runs Scored" },
    { id: "runs_conceded", label: "Runs Conceded" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(runs_scored - runs_conceded)", direction: "desc" },
  ],
  defaultLevels: [
    { name: "Recreational", color: "#6B7280" },
    { name: "Intermediate", color: "#3B82F6" },
    { name: "Competitive", color: "#10B981" },
  ],
  matchConfig: {
    supportedFormats: ["5v5", "7v7", "9v9"],
    defaultFormat: "7v7",
    formatRules: {
      "5v5": { playersPerTeam: 5 },
      "7v7": { playersPerTeam: 7 },
      "9v9": { playersPerTeam: 9 },
    },
    validateScores: validateKickballScores,
    resolveMatch: resolveKickballMatch,
    MatchInput: KickballMatchInput,
    MatchDisplay: KickballMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

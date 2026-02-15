import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { LaserTagMatchInput } from "./match-input"
import { LaserTagMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type LaserTagScore = { team1: number; team2: number }

export function validateLaserTagScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both team scores must be numbers" }
  }

  if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
    return { isValid: false, error: "Scores must be whole numbers" }
  }

  if (team1 < 0 || team2 < 0) {
    return { isValid: false, error: "Scores cannot be negative" }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveLaserTagMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as LaserTagScore

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
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const laserTagDomain: RankingDomain = {
  id: "laser-tag",
  name: "Laser Tag",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "draws", direction: "desc" },
  ],
  defaultLevels: [
    { name: "Beginner", color: "#6B7280" },
    { name: "Amateur", color: "#3B82F6" },
    { name: "Intermediate", color: "#10B981" },
    { name: "Advanced", color: "#F59E0B" },
    { name: "Pro", color: "#EF4444" },
  ],
  matchConfig: {
    supportedFormats: ["team"],
    defaultFormat: "team",
    formatRules: {
      team: { minPlayersPerTeam: 1, maxPlayersPerTeam: 13 },
    },
    validateScores: validateLaserTagScores,
    resolveMatch: resolveLaserTagMatch,
    MatchInput: LaserTagMatchInput,
    MatchDisplay: LaserTagMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

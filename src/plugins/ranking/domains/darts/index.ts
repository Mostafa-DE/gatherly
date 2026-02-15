import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { DartsMatchInput } from "./match-input"
import { DartsMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type DartsScore = { team1: number; team2: number }

export function validateDartsScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both team scores must be numbers" }
  }

  if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
    return { isValid: false, error: "Legs must be whole numbers" }
  }

  if (team1 < 0 || team2 < 0) {
    return { isValid: false, error: "Legs cannot be negative" }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveDartsMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as DartsScore

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
    legs_won: 0,
    legs_lost: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
      legs_won: team1,
      legs_lost: team2,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
      legs_won: team2,
      legs_lost: team1,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const dartsDomain: RankingDomain = {
  id: "darts",
  name: "Darts",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
    { id: "legs_won", label: "Legs Won" },
    { id: "legs_lost", label: "Legs Lost" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(legs_won - legs_lost)", direction: "desc" },
  ],
  defaultLevels: [
    { name: "D", color: "#6B7280" },
    { name: "C", color: "#3B82F6" },
    { name: "B", color: "#10B981" },
    { name: "A", color: "#F59E0B" },
  ],
  matchConfig: {
    supportedFormats: ["singles", "doubles"],
    defaultFormat: "singles",
    formatRules: {
      singles: { playersPerTeam: 1 },
      doubles: { playersPerTeam: 2 },
    },
    validateScores: validateDartsScores,
    resolveMatch: resolveDartsMatch,
    MatchInput: DartsMatchInput,
    MatchDisplay: DartsMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

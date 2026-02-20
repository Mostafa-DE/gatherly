import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { PoolMatchInput } from "./match-input"
import { PoolMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type PoolScore = { team1: number; team2: number }

export function validatePoolScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both team scores must be numbers" }
  }

  if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
    return { isValid: false, error: "Games must be whole numbers" }
  }

  if (team1 < 0 || team2 < 0) {
    return { isValid: false, error: "Games cannot be negative" }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolvePoolMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as PoolScore

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
    games_won: 0,
    games_lost: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
      games_won: team1,
      games_lost: team2,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
      games_won: team2,
      games_lost: team1,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const poolDomain: RankingDomain = {
  id: "pool",
  name: "Pool / Billiards",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
    { id: "games_won", label: "Games Won" },
    { id: "games_lost", label: "Games Lost" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(games_won - games_lost)", direction: "desc" },
  ],
  defaultLevels: [
    { name: "D", color: "#9CA3AF" },
    { name: "C", color: "#6B7280" },
    { name: "B", color: "#3B82F6" },
    { name: "A", color: "#10B981" },
    { name: "AA", color: "#F59E0B" },
    { name: "AAA", color: "#EF4444" },
  ],
  attributeFields: [
    {
      id: "preferred_game",
      label: "Preferred Game",
      options: ["8-Ball", "9-Ball", "10-Ball"],
    },
  ],
  matchConfig: {
    supportedFormats: ["singles", "doubles"],
    defaultFormat: "singles",
    formatRules: {
      singles: { playersPerTeam: 1 },
      doubles: { playersPerTeam: 2 },
    },
    validateScores: validatePoolScores,
    resolveMatch: resolvePoolMatch,
    MatchInput: PoolMatchInput,
    MatchDisplay: PoolMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

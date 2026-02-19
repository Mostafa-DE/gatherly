import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { FlagFootballMatchInput } from "./match-input"
import { FlagFootballMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type FlagFootballScore = { team1: number; team2: number }

export function validateFlagFootballScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both team scores must be numbers" }
  }

  if (!Number.isInteger(team1) || !Number.isInteger(team2)) {
    return { isValid: false, error: "Points must be whole numbers" }
  }

  if (team1 < 0 || team2 < 0) {
    return { isValid: false, error: "Points cannot be negative" }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveFlagFootballMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as FlagFootballScore

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
    points_scored: 0,
    points_conceded: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
      points_scored: team1,
      points_conceded: team2,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
      points_scored: team2,
      points_conceded: team1,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const flagFootballDomain: RankingDomain = {
  id: "flag-football",
  name: "Flag Football",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
    { id: "points_scored", label: "Points Scored" },
    { id: "points_conceded", label: "Points Conceded" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(points_scored - points_conceded)", direction: "desc" },
  ],
  defaultLevels: [
    { name: "Recreational", color: "#6B7280" },
    { name: "Intermediate", color: "#3B82F6" },
    { name: "Competitive", color: "#10B981" },
  ],
  attributeFields: [
    {
      id: "position",
      label: "Position",
      options: ["QB", "WR", "RB", "Lineman", "DB"],
    },
  ],
  groupingPreset: {
    mode: "balanced",
    balanceStatIds: [
      { statId: "wins", weight: 1 },
      { statId: "points_scored", weight: 0.5 },
    ],
    partitionByLevel: true,
    partitionByAttribute: "position",
    teamCount: 2,
  },
  matchConfig: {
    supportedFormats: ["5v5", "7v7"],
    defaultFormat: "5v5",
    formatRules: {
      "5v5": { playersPerTeam: 5 },
      "7v7": { playersPerTeam: 7 },
    },
    validateScores: validateFlagFootballScores,
    resolveMatch: resolveFlagFootballMatch,
    MatchInput: FlagFootballMatchInput,
    MatchDisplay: FlagFootballMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

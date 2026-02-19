import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { FootballMatchInput } from "./match-input"
import { FootballMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type FootballScore = { team1: number; team2: number }

export function validateFootballScores(scores: unknown): MatchScoreValidation {
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

export function resolveFootballMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as FootballScore

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

export const footballDomain: RankingDomain = {
  id: "football",
  name: "Football",
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
    { name: "Beginner", color: "#6B7280" },
    { name: "Amateur", color: "#3B82F6" },
    { name: "Intermediate", color: "#10B981" },
    { name: "Advanced", color: "#F59E0B" },
    { name: "Pro", color: "#EF4444" },
  ],
  attributeFields: [
    {
      id: "position",
      label: "Position",
      options: ["GK", "Defender", "Midfielder", "Attacker"],
    },
  ],
  groupingPreset: {
    mode: "balanced",
    balanceStatIds: [
      { statId: "wins", weight: 1 },
      { statId: "goals_scored", weight: 0.5 },
    ],
    partitionByLevel: true,
    partitionByAttribute: "position",
    teamCount: 2,
  },
  matchConfig: {
    supportedFormats: ["5v5", "6v6", "7v7", "11v11"],
    defaultFormat: "5v5",
    formatRules: {
      "5v5": { playersPerTeam: 5 },
      "6v6": { playersPerTeam: 6 },
      "7v7": { playersPerTeam: 7 },
      "11v11": { playersPerTeam: 11 },
    },
    validateScores: validateFootballScores,
    resolveMatch: resolveFootballMatch,
    MatchInput: FootballMatchInput,
    MatchDisplay: FootballMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { VolleyballMatchInput } from "./match-input"
import { VolleyballMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation (FIVB rules)
// =============================================================================

type SetScore = [number, number]

function isValidSet(set: SetScore, isDeciding: boolean): boolean {
  const [a, b] = set
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return false
  }
  const target = isDeciding ? 15 : 25
  const high = Math.max(a, b)
  const low = Math.min(a, b)

  // Standard win: first to target with 2+ lead
  if (high >= target && high - low >= 2) {
    // One side must be exactly at or above target, the other below
    // No cap — deuce continues indefinitely (FIVB rules)
    return true
  }
  return false
}

export function validateVolleyballScores(scores: unknown): MatchScoreValidation {
  if (!Array.isArray(scores)) {
    return { isValid: false, error: "Scores must be an array of sets" }
  }
  if (scores.length < 1) {
    return { isValid: false, error: "At least 1 set is required" }
  }
  if (scores.length > 5) {
    return { isValid: false, error: "Maximum 5 sets allowed (best of 5)" }
  }
  for (let i = 0; i < scores.length; i++) {
    const set = scores[i]
    if (
      !Array.isArray(set) ||
      set.length !== 2 ||
      !Number.isInteger(set[0]) ||
      !Number.isInteger(set[1])
    ) {
      return { isValid: false, error: `Set ${i + 1}: must be two numbers` }
    }
    const isDeciding = i === 4 // 5th set uses 15-point rules
    if (!isValidSet(set as SetScore, isDeciding)) {
      const target = isDeciding ? 15 : 25
      return {
        isValid: false,
        error: `Set ${i + 1}: invalid score (${set[0]}-${set[1]}). First to ${target}, win by 2`,
      }
    }
  }
  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveVolleyballMatch(scores: unknown): MatchResult {
  const sets = scores as SetScore[]
  let team1Sets = 0
  let team2Sets = 0

  for (const [a, b] of sets) {
    if (a > b) team1Sets++
    else team2Sets++
  }

  const winner =
    team1Sets > team2Sets
      ? ("team1" as const)
      : team2Sets > team1Sets
        ? ("team2" as const)
        : ("draw" as const)

  const baseStats = {
    matches_played: 1,
    wins: 0,
    losses: 0,
    sets_won: 0,
    sets_lost: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      sets_won: team1Sets,
      sets_lost: team2Sets,
      wins: winner === "team1" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
    },
    team2Stats: {
      ...baseStats,
      sets_won: team2Sets,
      sets_lost: team1Sets,
      wins: winner === "team2" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const volleyballDomain: RankingDomain = {
  id: "volleyball",
  name: "Volleyball",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "losses", label: "Losses" },
    { id: "sets_won", label: "Sets Won" },
    { id: "sets_lost", label: "Sets Lost" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(sets_won - sets_lost)", direction: "desc" },
  ],
  attributeFields: [
    {
      id: "position",
      label: "Position",
      options: ["Setter", "Libero", "OH", "MB", "Opposite"],
    },
  ],
  groupingPreset: {
    mode: "balanced",
    balanceStatIds: [
      { statId: "wins", weight: 1 },
    ],
    partitionByLevel: true,
    partitionByAttribute: "position",
    teamCount: 2,
  },
  matchConfig: {
    supportedFormats: ["2v2", "3v3", "4v4", "6v6"],
    defaultFormat: "6v6",
    formatRules: {
      "2v2": { playersPerTeam: 2 },
      "3v3": { playersPerTeam: 3 },
      "4v4": { playersPerTeam: 4 },
      "6v6": { playersPerTeam: 6 },
    },
    validateScores: validateVolleyballScores,
    resolveMatch: resolveVolleyballMatch,
    MatchInput: VolleyballMatchInput,
    MatchDisplay: VolleyballMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { PadelMatchInput } from "./match-input"
import { PadelMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type SetScore = [number, number]

function isValidSet(set: SetScore): boolean {
  const [a, b] = set
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return false
  }
  // Standard set: first to 6 with 2+ game lead (6-0 through 6-4)
  if ((a === 6 && b <= 4) || (b === 6 && a <= 4)) return true
  // 7-5
  if ((a === 7 && b === 5) || (b === 7 && a === 5)) return true
  // Tiebreak: 7-6
  if ((a === 7 && b === 6) || (b === 7 && a === 6)) return true
  return false
}

export function validatePadelScores(scores: unknown): MatchScoreValidation {
  if (!Array.isArray(scores)) {
    return { isValid: false, error: "Scores must be an array of sets" }
  }
  if (scores.length < 1) {
    return { isValid: false, error: "At least 1 set is required" }
  }
  if (scores.length > 5) {
    return { isValid: false, error: "Maximum 5 sets allowed" }
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
    if (!isValidSet(set as SetScore)) {
      return {
        isValid: false,
        error: `Set ${i + 1}: invalid score (${set[0]}-${set[1]})`,
      }
    }
  }
  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolvePadelMatch(scores: unknown): MatchResult {
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
    set_wins: 0,
    set_losses: 0,
    match_wins: 0,
    match_losses: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      set_wins: team1Sets,
      set_losses: team2Sets,
      match_wins: winner === "team1" ? 1 : 0,
      match_losses: winner === "team2" ? 1 : 0,
    },
    team2Stats: {
      ...baseStats,
      set_wins: team2Sets,
      set_losses: team1Sets,
      match_wins: winner === "team2" ? 1 : 0,
      match_losses: winner === "team1" ? 1 : 0,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const padelDomain: RankingDomain = {
  id: "padel",
  name: "Padel",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "match_wins", label: "Match Wins" },
    { id: "match_losses", label: "Match Losses" },
    { id: "set_wins", label: "Set Wins" },
    { id: "set_losses", label: "Set Losses" },
  ],
  tieBreak: [
    { field: "match_wins", direction: "desc" },
    { field: "(set_wins - set_losses)", direction: "desc" },
  ],
  defaultLevels: [
    { name: "D-", color: "#9CA3AF" },
    { name: "D", color: "#6B7280" },
    { name: "D+", color: "#4B5563" },
    { name: "C-", color: "#60A5FA" },
    { name: "C", color: "#3B82F6" },
    { name: "C+", color: "#2563EB" },
    { name: "B-", color: "#34D399" },
    { name: "B", color: "#10B981" },
    { name: "B+", color: "#059669" },
    { name: "A-", color: "#FBBF24" },
    { name: "A", color: "#F59E0B" },
    { name: "A+", color: "#D97706" },
  ],
  attributeFields: [
    {
      id: "dominant_side",
      label: "Dominant Side",
      options: ["Right", "Left"],
    },
    {
      id: "court_side",
      label: "Court Side Preference",
      options: ["Right (Drive)", "Left (Reves)", "Both"],
    },
  ],
  groupingPreset: {
    mode: "balanced",
    balanceStatIds: [
      { statId: "match_wins", weight: 1 },
      { statId: "set_wins", weight: 0.5 },
    ],
    partitionByLevel: true,
    partitionByAttribute: "dominant_side",
    teamCount: 2,
  },
  matchConfig: {
    supportedFormats: ["singles", "doubles"],
    defaultFormat: "doubles",
    formatRules: {
      singles: { playersPerTeam: 1 },
      doubles: { playersPerTeam: 2 },
    },
    validateScores: validatePadelScores,
    resolveMatch: resolvePadelMatch,
    MatchInput: PadelMatchInput,
    MatchDisplay: PadelMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

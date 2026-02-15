import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { TennisMatchInput } from "./match-input"
import { TennisMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation (ITF rules)
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

export function validateTennisScores(scores: unknown): MatchScoreValidation {
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

export function resolveTennisMatch(scores: unknown): MatchResult {
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

export const tennisDomain: RankingDomain = {
  id: "tennis",
  name: "Tennis",
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
  matchConfig: {
    supportedFormats: ["singles", "doubles"],
    defaultFormat: "singles",
    formatRules: {
      singles: { playersPerTeam: 1 },
      doubles: { playersPerTeam: 2 },
    },
    validateScores: validateTennisScores,
    resolveMatch: resolveTennisMatch,
    MatchInput: TennisMatchInput,
    MatchDisplay: TennisMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

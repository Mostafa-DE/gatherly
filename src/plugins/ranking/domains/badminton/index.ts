import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { BadmintonMatchInput } from "./match-input"
import { BadmintonMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation (BWF rules)
// =============================================================================

type GameScore = [number, number]

function isValidGame(game: GameScore): boolean {
  const [a, b] = game
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return false
  }
  // Standard: first to 21, win by 2 (21-0 through 21-19)
  if ((a === 21 && b <= 19) || (b === 21 && a <= 19)) return true
  // Deuce: both >= 20, win by 2 (22-20, 23-21, ... up to 29-27)
  if (a >= 20 && b >= 20 && Math.abs(a - b) === 2) {
    if (Math.max(a, b) <= 30) return true
  }
  // Cap: at 29-29, next point wins (30-29)
  if ((a === 30 && b === 29) || (b === 30 && a === 29)) return true
  return false
}

export function validateBadmintonScores(scores: unknown): MatchScoreValidation {
  if (!Array.isArray(scores)) {
    return { isValid: false, error: "Scores must be an array of games" }
  }
  if (scores.length < 1) {
    return { isValid: false, error: "At least 1 game is required" }
  }
  if (scores.length > 3) {
    return { isValid: false, error: "Maximum 3 games allowed (best of 3)" }
  }
  for (let i = 0; i < scores.length; i++) {
    const game = scores[i]
    if (
      !Array.isArray(game) ||
      game.length !== 2 ||
      !Number.isInteger(game[0]) ||
      !Number.isInteger(game[1])
    ) {
      return { isValid: false, error: `Game ${i + 1}: must be two numbers` }
    }
    if (!isValidGame(game as GameScore)) {
      return {
        isValid: false,
        error: `Game ${i + 1}: invalid score (${game[0]}-${game[1]})`,
      }
    }
  }
  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveBadmintonMatch(scores: unknown): MatchResult {
  const games = scores as GameScore[]
  let team1Games = 0
  let team2Games = 0

  for (const [a, b] of games) {
    if (a > b) team1Games++
    else team2Games++
  }

  const winner =
    team1Games > team2Games
      ? ("team1" as const)
      : team2Games > team1Games
        ? ("team2" as const)
        : ("draw" as const)

  const baseStats = {
    matches_played: 1,
    wins: 0,
    losses: 0,
    games_won: 0,
    games_lost: 0,
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      games_won: team1Games,
      games_lost: team2Games,
      wins: winner === "team1" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
    },
    team2Stats: {
      ...baseStats,
      games_won: team2Games,
      games_lost: team1Games,
      wins: winner === "team2" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const badmintonDomain: RankingDomain = {
  id: "badminton",
  name: "Badminton",
  statFields: [
    { id: "matches_played", label: "Matches Played" },
    { id: "wins", label: "Wins" },
    { id: "losses", label: "Losses" },
    { id: "games_won", label: "Games Won" },
    { id: "games_lost", label: "Games Lost" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "(games_won - games_lost)", direction: "desc" },
  ],
  attributeFields: [
    {
      id: "dominant_hand",
      label: "Dominant Hand",
      options: ["Right", "Left"],
    },
  ],
  matchConfig: {
    supportedFormats: ["singles", "doubles"],
    defaultFormat: "singles",
    formatRules: {
      singles: { playersPerTeam: 1 },
      doubles: { playersPerTeam: 2 },
    },
    validateScores: validateBadmintonScores,
    resolveMatch: resolveBadmintonMatch,
    MatchInput: BadmintonMatchInput,
    MatchDisplay: BadmintonMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

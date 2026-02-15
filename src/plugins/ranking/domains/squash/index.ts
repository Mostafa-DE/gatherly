import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { SquashMatchInput } from "./match-input"
import { SquashMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation (WSF PAR-11 rules)
// =============================================================================

type GameScore = [number, number]

function isValidGame(game: GameScore): boolean {
  const [a, b] = game
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return false
  }
  // Standard game: first to 11, win by 2
  if ((a === 11 && b <= 9) || (b === 11 && a <= 9)) return true
  // Extended: both >= 10, win by 2
  if (a >= 10 && b >= 10 && Math.abs(a - b) === 2) return true
  return false
}

export function validateSquashScores(scores: unknown): MatchScoreValidation {
  if (!Array.isArray(scores)) {
    return { isValid: false, error: "Scores must be an array of games" }
  }
  if (scores.length < 1) {
    return { isValid: false, error: "At least 1 game is required" }
  }
  if (scores.length > 5) {
    return { isValid: false, error: "Maximum 5 games allowed (best of 5)" }
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
        error: `Game ${i + 1}: invalid score (${game[0]}-${game[1]}). Must be first to 11, win by 2`,
      }
    }
  }
  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveSquashMatch(scores: unknown): MatchResult {
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

export const squashDomain: RankingDomain = {
  id: "squash",
  name: "Squash",
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
  defaultLevels: [
    { name: "C", color: "#6B7280" },
    { name: "B", color: "#3B82F6" },
    { name: "BB", color: "#10B981" },
    { name: "A", color: "#F59E0B" },
    { name: "AA", color: "#EF4444" },
  ],
  matchConfig: {
    supportedFormats: ["singles"],
    defaultFormat: "singles",
    formatRules: {
      singles: { playersPerTeam: 1 },
    },
    validateScores: validateSquashScores,
    resolveMatch: resolveSquashMatch,
    MatchInput: SquashMatchInput,
    MatchDisplay: SquashMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

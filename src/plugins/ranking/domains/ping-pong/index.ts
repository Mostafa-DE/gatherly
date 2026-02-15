import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { PingPongMatchInput } from "./match-input"
import { PingPongMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation (ITTF rules)
// =============================================================================

type GameScore = [number, number]

function isValidGame(game: GameScore): boolean {
  const [a, b] = game
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return false
  }
  const high = Math.max(a, b)
  const low = Math.min(a, b)

  // Standard win: first to 11 (11-0 through 11-9)
  if (high === 11 && low <= 9) return true
  // Deuce: both >= 10, win by 2, no cap (ITTF rules)
  if (high >= 12 && low >= 10 && high - low === 2) return true
  return false
}

export function validatePingPongScores(scores: unknown): MatchScoreValidation {
  if (!Array.isArray(scores)) {
    return { isValid: false, error: "Scores must be an array of games" }
  }
  if (scores.length < 1) {
    return { isValid: false, error: "At least 1 game is required" }
  }
  if (scores.length > 7) {
    return { isValid: false, error: "Maximum 7 games allowed (best of 7)" }
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
        error: `Game ${i + 1}: invalid score (${game[0]}-${game[1]}). First to 11, win by 2`,
      }
    }
  }
  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolvePingPongMatch(scores: unknown): MatchResult {
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

export const pingPongDomain: RankingDomain = {
  id: "ping-pong",
  name: "Ping Pong",
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
  matchConfig: {
    supportedFormats: ["singles", "doubles"],
    defaultFormat: "singles",
    formatRules: {
      singles: { playersPerTeam: 1 },
      doubles: { playersPerTeam: 2 },
    },
    validateScores: validatePingPongScores,
    resolveMatch: resolvePingPongMatch,
    MatchInput: PingPongMatchInput,
    MatchDisplay: PingPongMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

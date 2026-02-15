import type {
  RankingDomain,
  MatchScoreValidation,
  MatchResult,
} from "../types"
import { ChessMatchInput } from "./match-input"
import { ChessMatchDisplay } from "./match-display"

// =============================================================================
// Score Validation
// =============================================================================

type ChessScore = { team1: number; team2: number }

export function validateChessScores(scores: unknown): MatchScoreValidation {
  if (typeof scores !== "object" || scores === null) {
    return { isValid: false, error: "Scores must be an object with team1 and team2" }
  }

  const { team1, team2 } = scores as Record<string, unknown>

  if (typeof team1 !== "number" || typeof team2 !== "number") {
    return { isValid: false, error: "Both scores must be numbers" }
  }

  // Valid outcomes: 1-0 (player 1 wins), 0-1 (player 2 wins), 0.5-0.5 (draw)
  const isPlayer1Win = team1 === 1 && team2 === 0
  const isPlayer2Win = team1 === 0 && team2 === 1
  const isDraw = team1 === 0.5 && team2 === 0.5

  if (!isPlayer1Win && !isPlayer2Win && !isDraw) {
    return {
      isValid: false,
      error: "Invalid result. Must be 1-0 (Player 1 wins), 0-1 (Player 2 wins), or \u00BD-\u00BD (draw)",
    }
  }

  return { isValid: true }
}

// =============================================================================
// Match Resolution
// =============================================================================

export function resolveChessMatch(scores: unknown): MatchResult {
  const { team1, team2 } = scores as ChessScore

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
  }

  return {
    winner,
    team1Stats: {
      ...baseStats,
      wins: winner === "team1" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team2" ? 1 : 0,
    },
    team2Stats: {
      ...baseStats,
      wins: winner === "team2" ? 1 : 0,
      draws: winner === "draw" ? 1 : 0,
      losses: winner === "team1" ? 1 : 0,
    },
  }
}

// =============================================================================
// Domain Definition
// =============================================================================

export const chessDomain: RankingDomain = {
  id: "chess",
  name: "Chess",
  statFields: [
    { id: "matches_played", label: "Games Played" },
    { id: "wins", label: "Wins" },
    { id: "draws", label: "Draws" },
    { id: "losses", label: "Losses" },
  ],
  tieBreak: [
    { field: "wins", direction: "desc" },
    { field: "draws", direction: "desc" },
  ],
  defaultLevels: [
    { name: "Beginner", color: "#6B7280" },
    { name: "Intermediate", color: "#3B82F6" },
    { name: "Advanced", color: "#10B981" },
    { name: "Expert", color: "#F59E0B" },
    { name: "Master", color: "#EF4444" },
  ],
  matchConfig: {
    supportedFormats: ["singles"],
    defaultFormat: "singles",
    formatRules: {
      singles: { playersPerTeam: 1 },
    },
    validateScores: validateChessScores,
    resolveMatch: resolveChessMatch,
    MatchInput: ChessMatchInput,
    MatchDisplay: ChessMatchDisplay,
  },
  sessionConfig: { mode: "match" },
}

import type { ComponentType } from "react"

export type StatField = {
  id: string
  label: string
}

export type TieBreakRule = {
  field: string // stat field id or expression like "(sets_won - sets_lost)"
  direction: "asc" | "desc"
}

// =============================================================================
// Match Types
// =============================================================================

export type MatchFormat = string // Domain-defined: "singles", "doubles", "5v5", etc.

export type MatchScoreValidation = { isValid: boolean; error?: string }

export type DerivedStats = Record<string, number>

export type MatchResult = {
  winner: "team1" | "team2" | "draw"
  team1Stats: DerivedStats
  team2Stats: DerivedStats
}

export type FormatRule = {
  playersPerTeam?: number // Exact: 1 for singles, 2 for doubles
  minPlayersPerTeam?: number // Flexible: min per team (e.g. laser tag)
  maxPlayersPerTeam?: number // Flexible: max per team (e.g. laser tag)
}

export type MatchInputProps = {
  scores: unknown
  onScoresChange: (scores: unknown) => void
  validationError?: string
}

export type MatchDisplayProps = {
  scores: unknown
  winner: "team1" | "team2" | "draw"
  team1Names: string[]
  team2Names: string[]
}

export type MatchConfig = {
  supportedFormats: MatchFormat[]
  defaultFormat: MatchFormat
  formatRules: Record<MatchFormat, FormatRule>
  validateScores: (scores: unknown) => MatchScoreValidation
  resolveMatch: (scores: unknown) => MatchResult
  MatchInput: ComponentType<MatchInputProps>
  MatchDisplay: ComponentType<MatchDisplayProps>
}

// =============================================================================
// Session Config
// =============================================================================

export type SessionConfig = {
  mode: "match" // Session = one match. Capacity locked to format.
  // Future modes could be: "tournament", "league", etc.
}

// =============================================================================
// Domain Type
// =============================================================================

export type DefaultLevel = {
  name: string
  color?: string
}

export type RankingDomain = {
  id: string
  name: string
  statFields: StatField[]
  tieBreak: TieBreakRule[]
  defaultLevels?: DefaultLevel[]
  matchConfig?: MatchConfig
  sessionConfig?: SessionConfig
}

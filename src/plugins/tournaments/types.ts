// =============================================================================
// Tournament Format
// =============================================================================

export const TOURNAMENT_FORMATS = [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "swiss",
  "group_knockout",
  "free_for_all",
] as const
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number]

// =============================================================================
// Tournament Status
// =============================================================================

export const TOURNAMENT_STATUSES = [
  "draft",
  "registration",
  "check_in",
  "in_progress",
  "completed",
  "cancelled",
] as const
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number]

// =============================================================================
// Match Status
// =============================================================================

export const MATCH_STATUSES = [
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "forfeit",
  "bye",
  "cancelled",
] as const
export type MatchStatus = (typeof MATCH_STATUSES)[number]

// =============================================================================
// Entry Status
// =============================================================================

export const ENTRY_STATUSES = [
  "registered",
  "checked_in",
  "active",
  "eliminated",
  "withdrawn",
  "disqualified",
] as const
export type EntryStatus = (typeof ENTRY_STATUSES)[number]

// =============================================================================
// Stage Status
// =============================================================================

export const STAGE_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const
export type StageStatus = (typeof STAGE_STATUSES)[number]

// =============================================================================
// Stage Type
// =============================================================================

export const STAGE_TYPES = [
  "single_elimination",
  "double_elimination",
  "round_robin",
  "swiss",
  "group",
  "free_for_all",
] as const
export type StageType = (typeof STAGE_TYPES)[number]

// =============================================================================
// Participant Type
// =============================================================================

export const PARTICIPANT_TYPES = ["individual", "team"] as const
export type ParticipantType = (typeof PARTICIPANT_TYPES)[number]

// =============================================================================
// Seeding Method
// =============================================================================

export const SEEDING_METHODS = [
  "manual",
  "random",
  "ranking",
] as const
export type SeedingMethod = (typeof SEEDING_METHODS)[number]

// =============================================================================
// Visibility
// =============================================================================

export const VISIBILITIES = [
  "activity_members",
  "org_members",
  "public",
] as const
export type Visibility = (typeof VISIBILITIES)[number]

// =============================================================================
// Match Entry Result
// =============================================================================

export const MATCH_ENTRY_RESULTS = [
  "win",
  "loss",
  "draw",
  "bye",
  "forfeit",
] as const
export type MatchEntryResult = (typeof MATCH_ENTRY_RESULTS)[number]

// =============================================================================
// Team Member Role
// =============================================================================

export const TEAM_MEMBER_ROLES = ["captain", "player"] as const
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number]

// =============================================================================
// Match Edge Outcome Type
// =============================================================================

export const MATCH_EDGE_OUTCOME_TYPES = [
  "winner",
  "loser",
  "placement",
] as const
export type MatchEdgeOutcomeType = (typeof MATCH_EDGE_OUTCOME_TYPES)[number]

// =============================================================================
// Payment Status (for entries)
// =============================================================================

export const ENTRY_PAYMENT_STATUSES = ["unpaid", "paid"] as const
export type EntryPaymentStatus = (typeof ENTRY_PAYMENT_STATUSES)[number]

// =============================================================================
// Tournament Config (JSONB shape)
// =============================================================================

export type TournamentConfig = {
  swissRounds?: number
  groupCount?: number
  advancePerGroup?: number
  bestOf?: number
  points?: {
    win: number
    loss: number
    draw: number
    bye: number
  }
  tiebreakers?: string[]
  thirdPlaceMatch?: boolean
  rulesText?: string
  maxCapacity?: number
  minTeamSize?: number
  maxTeamSize?: number
}

/**
 * State Machines for Tournament Status Transitions
 *
 * Tournament Status Flow:
 *   draft → registration → check_in → in_progress → completed
 *     ↓         ↓            ↓            ↓
 *   cancelled  cancelled   cancelled    cancelled
 *   draft → in_progress (skip registration)
 *
 * Match Status Flow:
 *   pending → scheduled → in_progress → completed
 *                                        ↓
 *   forfeit (terminal), bye (terminal), cancelled (terminal)
 *
 * Entry Status Flow:
 *   registered → checked_in → active → eliminated
 *     ↓            ↓
 *   withdrawn    withdrawn
 *   disqualified (from any non-terminal)
 *
 * Stage Status Flow:
 *   pending → in_progress → completed
 *     ↓          ↓
 *   cancelled  cancelled
 */

import { BadRequestError } from "@/exceptions"
import type {
  TournamentStatus,
  MatchStatus,
  EntryStatus,
  StageStatus,
} from "./types"

// =============================================================================
// Tournament Transitions
// =============================================================================

export const tournamentTransitions: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ["registration", "in_progress", "cancelled"],
  registration: ["check_in", "in_progress", "cancelled"],
  check_in: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

export function canTransitionTournament(from: TournamentStatus, to: TournamentStatus): boolean {
  return tournamentTransitions[from]?.includes(to) ?? false
}

export function assertTournamentTransition(from: TournamentStatus, to: TournamentStatus): void {
  if (!canTransitionTournament(from, to)) {
    throw new BadRequestError(`Cannot transition tournament from '${from}' to '${to}'`)
  }
}

export function isTournamentStatus(value: unknown): value is TournamentStatus {
  return (
    typeof value === "string" &&
    (
      [
        "draft",
        "registration",
        "check_in",
        "in_progress",
        "completed",
        "cancelled",
      ] as readonly string[]
    ).includes(value)
  )
}

// =============================================================================
// Match Transitions
// =============================================================================

export const matchTransitions: Record<MatchStatus, MatchStatus[]> = {
  pending: ["scheduled", "in_progress", "bye", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "forfeit", "cancelled"],
  completed: [],
  forfeit: [],
  bye: [],
  cancelled: [],
}

export function canTransitionMatch(from: MatchStatus, to: MatchStatus): boolean {
  return matchTransitions[from]?.includes(to) ?? false
}

export function assertMatchTransition(from: MatchStatus, to: MatchStatus): void {
  if (!canTransitionMatch(from, to)) {
    throw new BadRequestError(`Cannot transition match from '${from}' to '${to}'`)
  }
}

export function isMatchStatus(value: unknown): value is MatchStatus {
  return (
    typeof value === "string" &&
    (
      [
        "pending",
        "scheduled",
        "in_progress",
        "completed",
        "forfeit",
        "bye",
        "cancelled",
      ] as readonly string[]
    ).includes(value)
  )
}

// =============================================================================
// Entry Transitions
// =============================================================================

export const entryTransitions: Record<EntryStatus, EntryStatus[]> = {
  registered: ["checked_in", "active", "withdrawn", "disqualified"],
  checked_in: ["active", "withdrawn", "disqualified"],
  active: ["eliminated", "disqualified"],
  eliminated: [],
  withdrawn: [],
  disqualified: [],
}

export function canTransitionEntry(from: EntryStatus, to: EntryStatus): boolean {
  return entryTransitions[from]?.includes(to) ?? false
}

export function assertEntryTransition(from: EntryStatus, to: EntryStatus): void {
  if (!canTransitionEntry(from, to)) {
    throw new BadRequestError(`Cannot transition entry from '${from}' to '${to}'`)
  }
}

export function isEntryStatus(value: unknown): value is EntryStatus {
  return (
    typeof value === "string" &&
    (
      [
        "registered",
        "checked_in",
        "active",
        "eliminated",
        "withdrawn",
        "disqualified",
      ] as readonly string[]
    ).includes(value)
  )
}

// =============================================================================
// Stage Transitions
// =============================================================================

export const stageTransitions: Record<StageStatus, StageStatus[]> = {
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

export function canTransitionStage(from: StageStatus, to: StageStatus): boolean {
  return stageTransitions[from]?.includes(to) ?? false
}

export function assertStageTransition(from: StageStatus, to: StageStatus): void {
  if (!canTransitionStage(from, to)) {
    throw new BadRequestError(`Cannot transition stage from '${from}' to '${to}'`)
  }
}

export function isStageStatus(value: unknown): value is StageStatus {
  return (
    typeof value === "string" &&
    (
      ["pending", "in_progress", "completed", "cancelled"] as readonly string[]
    ).includes(value)
  )
}

// =============================================================================
// Terminal state helpers
// =============================================================================

const TERMINAL_TOURNAMENT_STATUSES: ReadonlySet<TournamentStatus> = new Set(["completed", "cancelled"])
const TERMINAL_MATCH_STATUSES: ReadonlySet<MatchStatus> = new Set(["completed", "forfeit", "bye", "cancelled"])
const TERMINAL_ENTRY_STATUSES: ReadonlySet<EntryStatus> = new Set(["eliminated", "withdrawn", "disqualified"])
const TERMINAL_STAGE_STATUSES: ReadonlySet<StageStatus> = new Set(["completed", "cancelled"])

export function isTournamentTerminal(status: TournamentStatus): boolean {
  return TERMINAL_TOURNAMENT_STATUSES.has(status)
}

export function isMatchTerminal(status: MatchStatus): boolean {
  return TERMINAL_MATCH_STATUSES.has(status)
}

export function isEntryTerminal(status: EntryStatus): boolean {
  return TERMINAL_ENTRY_STATUSES.has(status)
}

export function isStageTerminal(status: StageStatus): boolean {
  return TERMINAL_STAGE_STATUSES.has(status)
}

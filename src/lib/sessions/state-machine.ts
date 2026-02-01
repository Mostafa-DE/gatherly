/**
 * State Machine for Session and Participation Status Transitions
 *
 * Session Status Flow:
 *   draft → published → completed
 *     ↓         ↓
 *   cancelled  cancelled
 *
 * Participation Status Flow:
 *   (none) → joined → cancelled
 *              ↑
 *   (none) → waitlisted → joined (auto-promote)
 *                ↓
 *            cancelled
 */

import { BadRequestError } from "@/exceptions";

// =============================================================================
// Types
// =============================================================================

export const SESSION_STATUSES = ["draft", "published", "cancelled", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const PARTICIPATION_STATUSES = ["joined", "waitlisted", "cancelled"] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];

export const ATTENDANCE_STATUSES = ["pending", "show", "no_show"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const JOIN_MODES = ["open", "approval_required", "invite_only"] as const;
export type JoinMode = (typeof JOIN_MODES)[number];

// =============================================================================
// Transition Rules
// =============================================================================

export const sessionTransitions: Record<SessionStatus, SessionStatus[]> = {
  draft: ["published", "cancelled"],
  published: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const participationTransitions: Record<ParticipationStatus, ParticipationStatus[]> = {
  joined: ["cancelled"],
  waitlisted: ["joined", "cancelled"],
  cancelled: [],
};

// =============================================================================
// Validation Functions
// =============================================================================

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return sessionTransitions[from]?.includes(to) ?? false;
}

export function canTransitionParticipation(
  from: ParticipationStatus,
  to: ParticipationStatus
): boolean {
  return participationTransitions[from]?.includes(to) ?? false;
}

// =============================================================================
// Assertion Functions (throw on invalid transition)
// =============================================================================

export function assertSessionTransition(from: SessionStatus, to: SessionStatus): void {
  if (!canTransitionSession(from, to)) {
    throw new BadRequestError(`Cannot transition session from '${from}' to '${to}'`);
  }
}

export function assertParticipationTransition(
  from: ParticipationStatus,
  to: ParticipationStatus
): void {
  if (!canTransitionParticipation(from, to)) {
    throw new BadRequestError(`Cannot transition participation from '${from}' to '${to}'`);
  }
}

// =============================================================================
// Type Guards
// =============================================================================

export function isSessionStatus(value: unknown): value is SessionStatus {
  return typeof value === "string" && SESSION_STATUSES.includes(value as SessionStatus);
}

export function isParticipationStatus(value: unknown): value is ParticipationStatus {
  return typeof value === "string" && PARTICIPATION_STATUSES.includes(value as ParticipationStatus);
}

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === "string" && PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export function isJoinMode(value: unknown): value is JoinMode {
  return typeof value === "string" && JOIN_MODES.includes(value as JoinMode);
}

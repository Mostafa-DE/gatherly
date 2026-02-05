import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { participation } from "@/db/schema";
import {
  PARTICIPATION_STATUSES,
  ATTENDANCE_STATUSES,
  PAYMENT_STATUSES,
  type ParticipationStatus,
  type AttendanceStatus,
  type PaymentStatus,
} from "@/lib/sessions/state-machine";

// =============================================================================
// Zod Enums
// =============================================================================

export const participationStatusSchema = z.enum(PARTICIPATION_STATUSES);
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);

// =============================================================================
// Schema generated from Drizzle table
// =============================================================================

export const participationSelectSchema = createSelectSchema(participation, {
  status: participationStatusSchema,
  attendance: attendanceStatusSchema,
  payment: paymentStatusSchema,
});

export const participationInsertSchema = createInsertSchema(participation, {
  status: participationStatusSchema,
  attendance: attendanceStatusSchema,
  payment: paymentStatusSchema,
});

// =============================================================================
// Input Schemas
// =============================================================================

/** Join a session */
export const joinSessionSchema = z.object({
  sessionId: z.string(),
});

/** Cancel participation */
export const cancelParticipationSchema = z.object({
  participationId: z.string(),
});

/** Get own participation for a session */
export const getMyParticipationSchema = z.object({
  sessionId: z.string(),
});

/** Get participation history in an org */
export const getMyHistorySchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

/** Get session roster (admin) */
export const getRosterSchema = z.object({
  sessionId: z.string(),
  status: participationStatusSchema.optional(),
  limit: z.number().int().positive().max(500).default(100),
  offset: z.number().int().nonnegative().default(0),
});

/** Update participation (admin) */
export const updateParticipationSchema = z.object({
  participationId: z.string(),
  attendance: attendanceStatusSchema.optional(),
  payment: paymentStatusSchema.optional(),
  notes: z.string().max(1000).nullable().optional(),
});

/** Bulk update attendance (admin) */
export const bulkUpdateAttendanceSchema = z.object({
  sessionId: z.string(),
  updates: z.array(
    z.object({
      participationId: z.string(),
      attendance: attendanceStatusSchema,
    })
  ).min(1).max(100),
});

/** Get user's participation history (admin) */
export const getUserHistorySchema = z.object({
  userId: z.string(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

/** Admin add participant by email or phone */
export const adminAddParticipantSchema = z.object({
  sessionId: z.string(),
  identifier: z.string().min(1, "Email or phone required"),
});

/** Move participant between sessions (admin) */
export const moveParticipantSchema = z.object({
  participationId: z.string(),
  targetSessionId: z.string(),
});

// =============================================================================
// Types
// =============================================================================

export type ParticipationSelect = z.infer<typeof participationSelectSchema>;
export type ParticipationInsert = z.infer<typeof participationInsertSchema>;
export type JoinSessionInput = z.infer<typeof joinSessionSchema>;
export type CancelParticipationInput = z.infer<typeof cancelParticipationSchema>;
export type GetMyParticipationInput = z.infer<typeof getMyParticipationSchema>;
export type GetMyHistoryInput = z.infer<typeof getMyHistorySchema>;
export type GetRosterInput = z.infer<typeof getRosterSchema>;
export type UpdateParticipationInput = z.infer<typeof updateParticipationSchema>;
export type BulkUpdateAttendanceInput = z.infer<typeof bulkUpdateAttendanceSchema>;
export type GetUserHistoryInput = z.infer<typeof getUserHistorySchema>;
export type AdminAddParticipantInput = z.infer<typeof adminAddParticipantSchema>;
export type MoveParticipantInput = z.infer<typeof moveParticipantSchema>;

// Re-export status types for convenience
export type { ParticipationStatus, AttendanceStatus, PaymentStatus };

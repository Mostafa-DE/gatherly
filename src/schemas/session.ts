import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eventSession } from "@/db/schema";
import {
  SESSION_STATUSES,
  JOIN_MODES,
  type SessionStatus,
  type JoinMode,
} from "@/lib/sessions/state-machine";

// =============================================================================
// Zod Enums
// =============================================================================

export const sessionStatusSchema = z.enum(SESSION_STATUSES);
export const joinModeSchema = z.enum(JOIN_MODES);

// =============================================================================
// Schema generated from Drizzle table
// =============================================================================

export const eventSessionSelectSchema = createSelectSchema(eventSession, {
  status: sessionStatusSchema,
  joinMode: joinModeSchema,
});

export const eventSessionInsertSchema = createInsertSchema(eventSession, {
  status: sessionStatusSchema,
  joinMode: joinModeSchema,
  maxCapacity: z.number().int().positive(),
  maxWaitlist: z.number().int().nonnegative(),
});

// =============================================================================
// Input Schemas
// =============================================================================

/** Create a new session */
export const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  dateTime: z.coerce.date(),
  location: z.string().max(500).optional(),
  maxCapacity: z.number().int().positive(),
  maxWaitlist: z.number().int().nonnegative().default(0),
  joinMode: joinModeSchema.default("open"),
});

/** Update an existing session */
export const updateSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  dateTime: z.coerce.date().optional(),
  location: z.string().max(500).nullable().optional(),
  maxCapacity: z.number().int().positive().optional(),
  maxWaitlist: z.number().int().nonnegative().optional(),
  joinMode: joinModeSchema.optional(),
});

/** Update session status */
export const updateSessionStatusSchema = z.object({
  sessionId: z.string(),
  status: sessionStatusSchema,
});

/** Get session by ID */
export const getSessionByIdSchema = z.object({
  sessionId: z.string(),
});

/** List sessions for an organization */
export const listSessionsSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
  status: sessionStatusSchema.optional(),
  includeDeleted: z.boolean().default(false),
});

/** List upcoming sessions */
export const listUpcomingSessionsSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

/** List past sessions */
export const listPastSessionsSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

// =============================================================================
// Types
// =============================================================================

export type EventSessionSelect = z.infer<typeof eventSessionSelectSchema>;
export type EventSessionInsert = z.infer<typeof eventSessionInsertSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type UpdateSessionStatusInput = z.infer<typeof updateSessionStatusSchema>;
export type GetSessionByIdInput = z.infer<typeof getSessionByIdSchema>;
export type ListSessionsInput = z.infer<typeof listSessionsSchema>;
export type ListUpcomingSessionsInput = z.infer<typeof listUpcomingSessionsSchema>;
export type ListPastSessionsInput = z.infer<typeof listPastSessionsSchema>;

// Re-export status types for convenience
export type { SessionStatus, JoinMode };

import { z } from "zod"

// =============================================================================
// Telegram Linking (dashboard-only via widget)
// =============================================================================

export const telegramWidgetAuthSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number(),
  hash: z.string(),
})

// =============================================================================
// Bot Identity Check (shared by all bot-facing endpoints)
// =============================================================================

export const botIdentitySchema = z.object({
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
})

// =============================================================================
// Bot Query Schemas (focused endpoints)
// =============================================================================

export const botGetActivitiesSchema = z.object({
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  activityId: z.string().optional(),
  includeInactive: z.boolean().default(false),
})

export const botGetSessionsSchema = z.object({
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  activityId: z.string().optional(),
  sessionId: z.string().optional(),
  includeUpcoming: z.boolean().default(true),
  includePast: z.boolean().default(true),
  pastLimit: z.number().int().min(1).max(100).default(30),
})

export const botSearchSessionsSchema = z.object({
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  query: z.string().min(1).max(200),
  activityId: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
})

export const botGetParticipantsSchema = z.object({
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  sessionId: z.string().min(1),
})

// =============================================================================
// Action Sources and Types
// =============================================================================

export const actionSourceEnum = z.enum(["telegram"])
export const actionTypeEnum = z.enum(["mark_attendance", "record_match_result", "create_session", "mark_payment", "add_note", "add_participant", "remove_participant"])
export const actionStatusEnum = z.enum([
  "pending_approval",
  "approved",
  "executed",
  "rejected",
  "failed",
])

// =============================================================================
// Action Payloads (used by dashboard executors)
// =============================================================================

export const markAttendancePayloadSchema = z.object({
  sessionId: z.string(),
  updates: z.array(
    z.object({
      userId: z.string(),
      attendance: z.enum(["show", "no_show", "pending"]),
    })
  ).min(1).max(200),
})

export const recordMatchResultPayloadSchema = z.object({
  activityId: z.string(),
  sessionId: z.string(),
  matchFormat: z.string().min(1),
  team1: z.array(z.string()).min(1),
  team2: z.array(z.string()).min(1),
  scores: z.unknown(),
  notes: z.string().max(500).optional(),
})

export const markPaymentPayloadSchema = z.object({
  sessionId: z.string(),
  updates: z.array(
    z.object({
      userId: z.string(),
      payment: z.enum(["paid", "unpaid"]),
    })
  ).min(1).max(200),
})

export const addNotePayloadSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  notes: z.string().max(1000),
})

export const addParticipantPayloadSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
})

export const removeParticipantPayloadSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
})

export const actionPayloadSchema = z.union([
  markAttendancePayloadSchema,
  recordMatchResultPayloadSchema,
  markPaymentPayloadSchema,
  addNotePayloadSchema,
  addParticipantPayloadSchema,
  removeParticipantPayloadSchema,
])

// =============================================================================
// Bot Submit Schemas (typed per-action mutations)
// =============================================================================

export const submitMarkAttendanceSchema = z.object({
  sourceEventId: z.string().min(1),
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  transcript: z.string().optional(),
  sessionId: z.string().min(1),
  updates: z.array(
    z.object({
      userId: z.string().min(1),
      attendance: z.enum(["show", "no_show", "pending"]),
    })
  ).min(1).max(200),
})

export const submitRecordMatchSchema = z.object({
  sourceEventId: z.string().min(1),
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  transcript: z.string().optional(),
  activityId: z.string().min(1),
  sessionId: z.string().min(1),
  matchFormat: z.string().min(1),
  team1: z.array(z.string().min(1)).min(1),
  team2: z.array(z.string().min(1)).min(1),
  scores: z.unknown(),
  notes: z.string().max(500).optional(),
})

export const submitMarkPaymentSchema = z.object({
  sourceEventId: z.string().min(1),
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  transcript: z.string().optional(),
  sessionId: z.string().min(1),
  updates: z.array(
    z.object({
      userId: z.string().min(1),
      payment: z.enum(["paid", "unpaid"]),
    })
  ).min(1).max(200),
})

export const submitAddNoteSchema = z.object({
  sourceEventId: z.string().min(1),
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  transcript: z.string().optional(),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  notes: z.string().min(1).max(1000),
})

export const submitAddParticipantSchema = z.object({
  sourceEventId: z.string().min(1),
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  transcript: z.string().optional(),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
})

export const submitRemoveParticipantSchema = z.object({
  sourceEventId: z.string().min(1),
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  transcript: z.string().optional(),
  sessionId: z.string().min(1),
  userId: z.string().min(1),
})

export const botGetMemberSummarySchema = z.object({
  telegramUserId: z.string().min(1),
  organizationId: z.string().optional(),
  query: z.string().min(1).max(200).optional(),
  userId: z.string().optional(),
}).refine(
  (data) => data.query || data.userId,
  { message: "Either query or userId must be provided" }
)

// =============================================================================
// In-App Queue (assistantAction router)
// =============================================================================

export const listActionRequestsSchema = z.object({
  statuses: z.array(actionStatusEnum).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export const actionRequestByIdSchema = z.object({
  actionRequestId: z.string(),
})

export const approveActionRequestSchema = z.object({
  actionRequestId: z.string(),
})

export const rejectActionRequestSchema = z.object({
  actionRequestId: z.string(),
  reason: z.string().max(500).optional(),
})

// =============================================================================
// Type Exports
// =============================================================================

export type TelegramWidgetAuthInput = z.infer<typeof telegramWidgetAuthSchema>
export type MarkAttendancePayload = z.infer<typeof markAttendancePayloadSchema>
export type RecordMatchResultPayload = z.infer<typeof recordMatchResultPayloadSchema>
export type MarkPaymentPayload = z.infer<typeof markPaymentPayloadSchema>
export type AddNotePayload = z.infer<typeof addNotePayloadSchema>
export type AddParticipantPayload = z.infer<typeof addParticipantPayloadSchema>
export type RemoveParticipantPayload = z.infer<typeof removeParticipantPayloadSchema>

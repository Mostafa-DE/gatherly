import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { joinRequest } from "@/db/schema"
import { commonFieldsOmit } from "./shared"

// Schema generated from Drizzle table
export const joinRequestSelectSchema = createSelectSchema(joinRequest)
export const joinRequestInsertSchema = createInsertSchema(joinRequest)

// Status enum
export const joinRequestStatusSchema = z.enum(["pending", "approved", "rejected"])
export type JoinRequestStatus = z.infer<typeof joinRequestStatusSchema>

// Create join request input (user submits a request to join)
export const createJoinRequestSchema = z.object({
  organizationId: z.string(),
  message: z.string().max(500).optional(),
  formAnswers: z.record(z.unknown()).optional(),
})

// Cancel join request input
export const cancelJoinRequestSchema = z.object({
  requestId: z.string(),
})

// Approve/reject join request input (admin actions)
export const reviewJoinRequestSchema = z.object({
  requestId: z.string(),
})

// List pending requests input (admin)
export const listPendingRequestsSchema = z.object({
  organizationId: z.string(),
})

// Types
export type JoinRequestSelect = z.infer<typeof joinRequestSelectSchema>
export type JoinRequestInsert = z.infer<typeof joinRequestInsertSchema>
export type CreateJoinRequestInput = z.infer<typeof createJoinRequestSchema>
export type CancelJoinRequestInput = z.infer<typeof cancelJoinRequestSchema>
export type ReviewJoinRequestInput = z.infer<typeof reviewJoinRequestSchema>
export type ListPendingRequestsInput = z.infer<typeof listPendingRequestsSchema>

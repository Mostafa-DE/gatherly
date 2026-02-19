import { z } from "zod"

// =============================================================================
// Input Schemas
// =============================================================================

export const joinActivitySchema = z.object({
  activityId: z.string(),
})

export const requestActivityJoinSchema = z.object({
  activityId: z.string(),
  message: z.string().max(1000).optional(),
  formAnswers: z.record(z.string(), z.unknown()).optional(),
})

export const reviewActivityJoinRequestSchema = z.object({
  requestId: z.string(),
})

export const adminAddActivityMemberSchema = z.object({
  activityId: z.string(),
  userId: z.string(),
})

export const removeActivityMemberSchema = z.object({
  activityId: z.string(),
  userId: z.string(),
})

export const listActivityMembersSchema = z.object({
  activityId: z.string(),
  status: z.enum(["pending", "active", "rejected"]).optional(),
  limit: z.number().int().positive().max(1000).default(50),
  offset: z.number().int().nonnegative().default(0),
})

export const listActivityJoinRequestsSchema = z.object({
  activityId: z.string(),
})

export const myActivityMembershipsSchema = z.object({})

// =============================================================================
// Types
// =============================================================================

export type JoinActivityInput = z.infer<typeof joinActivitySchema>
export type RequestActivityJoinInput = z.infer<typeof requestActivityJoinSchema>
export type ReviewActivityJoinRequestInput = z.infer<typeof reviewActivityJoinRequestSchema>
export type AdminAddActivityMemberInput = z.infer<typeof adminAddActivityMemberSchema>
export type RemoveActivityMemberInput = z.infer<typeof removeActivityMemberSchema>
export type ListActivityMembersInput = z.infer<typeof listActivityMembersSchema>
export type ListActivityJoinRequestsInput = z.infer<typeof listActivityJoinRequestsSchema>

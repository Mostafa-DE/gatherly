import { z } from "zod"
import { joinFormSchemaSchema } from "@/schemas/organization-settings"

// =============================================================================
// Activity Join Modes
// =============================================================================

export const ACTIVITY_JOIN_MODES = ["open", "require_approval", "invite"] as const
export type ActivityJoinMode = (typeof ACTIVITY_JOIN_MODES)[number]

export const activityJoinModeSchema = z.enum(ACTIVITY_JOIN_MODES)

// =============================================================================
// Input Schemas
// =============================================================================

export const createActivitySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
  joinMode: activityJoinModeSchema.default("open"),
  joinFormSchema: joinFormSchemaSchema.nullable().optional(),
})

export const updateActivitySchema = z.object({
  activityId: z.string(),
  name: z.string().min(1).max(200).optional(),
  joinMode: activityJoinModeSchema.optional(),
  joinFormSchema: joinFormSchemaSchema.nullable().optional(),
})

export const getActivityByIdSchema = z.object({
  activityId: z.string(),
})

export const getActivityBySlugSchema = z.object({
  slug: z.string(),
})

export const listActivitiesSchema = z.object({
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
  includeInactive: z.boolean().default(false),
})

export const deactivateActivitySchema = z.object({
  activityId: z.string(),
})

export const reactivateActivitySchema = z.object({
  activityId: z.string(),
})

export const toggleActivityPluginSchema = z.object({
  activityId: z.string(),
  pluginId: z.string(),
  enabled: z.boolean(),
})

// =============================================================================
// Types
// =============================================================================

export type CreateActivityInput = z.infer<typeof createActivitySchema>
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>
export type GetActivityByIdInput = z.infer<typeof getActivityByIdSchema>
export type GetActivityBySlugInput = z.infer<typeof getActivityBySlugSchema>
export type ListActivitiesInput = z.infer<typeof listActivitiesSchema>
export type DeactivateActivityInput = z.infer<typeof deactivateActivitySchema>
export type ReactivateActivityInput = z.infer<typeof reactivateActivitySchema>
export type ToggleActivityPluginInput = z.infer<typeof toggleActivityPluginSchema>

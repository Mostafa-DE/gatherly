import { z } from "zod/v4"

// =============================================================================
// Criteria (discriminated union by mode)
// =============================================================================

const weightedFieldSchema = z.object({
  sourceId: z.string().min(1),
  weight: z.number().min(0).max(1).default(1),
})

const splitCriteriaSchema = z.object({
  mode: z.literal("split"),
  fields: z.array(z.object({
    sourceId: z.string().min(1),
    strategy: z.literal("split"),
  })).min(1).max(2),
})

const similarityCriteriaSchema = z.object({
  mode: z.literal("similarity"),
  fields: z.array(weightedFieldSchema).min(1).max(10),
  groupCount: z.number().int().min(2).max(100),
})

const diversityCriteriaSchema = z.object({
  mode: z.literal("diversity"),
  fields: z.array(weightedFieldSchema).min(1).max(10),
  groupCount: z.number().int().min(2).max(100),
})

const balancedCriteriaSchema = z.object({
  mode: z.literal("balanced"),
  balanceField: z.string().min(1),
  teamCount: z.number().int().min(2).max(100),
})

export const criteriaSchema = z.discriminatedUnion("mode", [
  splitCriteriaSchema,
  similarityCriteriaSchema,
  diversityCriteriaSchema,
  balancedCriteriaSchema,
])

export type Criteria = z.infer<typeof criteriaSchema>

// =============================================================================
// Config Schemas
// =============================================================================

export const createConfigSchema = z.object({
  activityId: z.string().min(1),
  name: z.string().min(1).max(200),
  defaultCriteria: criteriaSchema.optional(),
})

export type CreateConfigInput = z.infer<typeof createConfigSchema>

export const updateConfigSchema = z.object({
  configId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  defaultCriteria: criteriaSchema.optional(),
})

export type UpdateConfigInput = z.infer<typeof updateConfigSchema>

// =============================================================================
// Generation Schemas
// =============================================================================

export const generateGroupsSchema = z
  .object({
    configId: z.string().min(1),
    scope: z.enum(["session", "activity"]),
    sessionId: z.string().min(1).optional(),
    criteriaOverride: criteriaSchema.optional(),
  })
  .refine(
    (data) => data.scope !== "session" || data.sessionId,
    { message: "sessionId is required for session scope" }
  )
  .refine(
    (data) => data.scope !== "activity" || !data.sessionId,
    { message: "sessionId is not allowed for activity scope" }
  )

export type GenerateGroupsInput = z.infer<typeof generateGroupsSchema>

// =============================================================================
// Proposal Schemas
// =============================================================================

export const updateProposalSchema = z.object({
  proposalId: z.string().min(1),
  modifiedMemberIds: z.array(z.string().min(1)).min(0),
  expectedVersion: z.number().int().positive(),
})

export type UpdateProposalInput = z.infer<typeof updateProposalSchema>

// =============================================================================
// Confirm Schema
// =============================================================================

export const confirmRunSchema = z.object({
  runId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
})

export type ConfirmRunInput = z.infer<typeof confirmRunSchema>

// =============================================================================
// Query Schemas
// =============================================================================

export const getConfigByActivitySchema = z.object({
  activityId: z.string().min(1),
})

export const getRunBySessionSchema = z.object({
  sessionId: z.string().min(1),
})

export const getRunsByActivitySchema = z.object({
  configId: z.string().min(1),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
})

export const getRunDetailsSchema = z.object({
  runId: z.string().min(1),
})

export const getAvailableFieldsSchema = z.object({
  activityId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
})

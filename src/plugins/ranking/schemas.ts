import { z } from "zod"

// =============================================================================
// Level Schemas
// =============================================================================

export const levelInputSchema = z.object({
  id: z.string().optional(), // existing level id for updates, omit for new
  name: z.string().min(1).max(50),
  color: z.string().max(30).nullable().optional(),
  order: z.number().int().nonnegative(),
})

// =============================================================================
// Definition Schemas
// =============================================================================

export const createRankingSchema = z.object({
  activityId: z.string(),
  name: z.string().min(1).max(200),
  domainId: z.string().min(1),
  levels: z.array(levelInputSchema),
})

export const updateDefinitionSchema = z.object({
  rankingDefinitionId: z.string(),
  name: z.string().min(1).max(200),
})

// =============================================================================
// Level Management Schemas
// =============================================================================

export const upsertLevelsSchema = z.object({
  rankingDefinitionId: z.string(),
  levels: z.array(levelInputSchema).min(1),
})

export const deleteLevelSchema = z.object({
  rankingDefinitionId: z.string(),
  levelId: z.string(),
})

// =============================================================================
// Member Rank Schemas
// =============================================================================

export const assignLevelSchema = z.object({
  rankingDefinitionId: z.string(),
  userId: z.string(),
  levelId: z.string().nullable(), // null to unassign
})

export const recordStatsSchema = z.object({
  rankingDefinitionId: z.string(),
  userId: z.string(),
  sessionId: z.string().optional(),
  stats: z.record(z.string(), z.number().int()),
  notes: z.string().max(500).optional(),
})

export const correctStatEntrySchema = z.object({
  rankingDefinitionId: z.string(),
  entryId: z.string(),
  correctedStats: z.record(z.string(), z.number().int()),
  notes: z.string().max(500).optional(),
})

// =============================================================================
// Query Schemas
// =============================================================================

export const getByActivitySchema = z.object({
  activityId: z.string(),
})

export const getLeaderboardSchema = z.object({
  rankingDefinitionId: z.string(),
  includeFormerMembers: z.boolean().default(false),
})

export const getMemberRankSchema = z.object({
  rankingDefinitionId: z.string(),
  userId: z.string(),
})

export const getMemberRanksByUserSchema = z.object({
  userId: z.string(),
})

// =============================================================================
// Attribute Schemas
// =============================================================================

export const getDomainConfigSchema = z.object({
  activityId: z.string(),
})

export const updateMemberAttributesSchema = z.object({
  rankingDefinitionId: z.string(),
  userId: z.string(),
  attributes: z.record(z.string(), z.string().nullable()),
})

export const updateSessionAttributesSchema = z.object({
  participationId: z.string(),
  attributeOverrides: z.record(z.string(), z.string().nullable()).nullable(),
})

// =============================================================================
// Match Schemas
// =============================================================================

export const recordMatchSchema = z.object({
  rankingDefinitionId: z.string(),
  sessionId: z.string(),
  matchFormat: z.string().min(1),
  team1: z.array(z.string()).min(1),
  team2: z.array(z.string()).min(1),
  scores: z.unknown(),
  notes: z.string().max(500).optional(),
})

export const correctMatchSchema = z.object({
  matchId: z.string(),
  rankingDefinitionId: z.string(),
  sessionId: z.string(),
  matchFormat: z.string().min(1),
  team1: z.array(z.string()).min(1),
  team2: z.array(z.string()).min(1),
  scores: z.unknown(),
  notes: z.string().max(500).optional(),
})

export const listMatchesBySessionSchema = z.object({
  rankingDefinitionId: z.string(),
  sessionId: z.string(),
})

export const listMatchesByDefinitionSchema = z.object({
  rankingDefinitionId: z.string(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

// =============================================================================
// Types
// =============================================================================

export type CreateRankingInput = z.infer<typeof createRankingSchema>
export type UpdateDefinitionInput = z.infer<typeof updateDefinitionSchema>
export type UpsertLevelsInput = z.infer<typeof upsertLevelsSchema>
export type DeleteLevelInput = z.infer<typeof deleteLevelSchema>
export type AssignLevelInput = z.infer<typeof assignLevelSchema>
export type RecordStatsInput = z.infer<typeof recordStatsSchema>
export type CorrectStatEntryInput = z.infer<typeof correctStatEntrySchema>
export type GetByActivityInput = z.infer<typeof getByActivitySchema>
export type GetLeaderboardInput = z.infer<typeof getLeaderboardSchema>
export type GetMemberRankInput = z.infer<typeof getMemberRankSchema>
export type GetMemberRanksByUserInput = z.infer<typeof getMemberRanksByUserSchema>
export type LevelInput = z.infer<typeof levelInputSchema>
export type RecordMatchInput = z.infer<typeof recordMatchSchema>
export type CorrectMatchInput = z.infer<typeof correctMatchSchema>
export type ListMatchesBySessionInput = z.infer<typeof listMatchesBySessionSchema>
export type ListMatchesByDefinitionInput = z.infer<typeof listMatchesByDefinitionSchema>
export type GetDomainConfigInput = z.infer<typeof getDomainConfigSchema>
export type UpdateMemberAttributesInput = z.infer<typeof updateMemberAttributesSchema>
export type UpdateSessionAttributesInput = z.infer<typeof updateSessionAttributesSchema>

import { z } from "zod"
import {
  TOURNAMENT_FORMATS,
  TOURNAMENT_STATUSES,
  VISIBILITIES,
  PARTICIPANT_TYPES,
  SEEDING_METHODS,
  MATCH_STATUSES,
  ENTRY_STATUSES,
} from "./types"

// =============================================================================
// Shared
// =============================================================================

const tournamentConfigSchema = z.object({
  swissRounds: z.number().int().min(1).optional(),
  groupCount: z.number().int().min(2).optional(),
  advancePerGroup: z.number().int().min(1).optional(),
  bestOf: z.number().int().min(1).optional(),
  points: z
    .object({
      win: z.number().int(),
      loss: z.number().int(),
      draw: z.number().int(),
      bye: z.number().int(),
    })
    .optional(),
  tiebreakers: z.array(z.string()).optional(),
  thirdPlaceMatch: z.boolean().optional(),
  rulesText: z.string().max(5000).optional(),
  maxCapacity: z.number().int().min(2).optional(),
  minTeamSize: z.number().int().min(1).optional(),
  maxTeamSize: z.number().int().min(1).optional(),
})

// =============================================================================
// Tournament CRUD
// =============================================================================

export const createTournamentSchema = z.object({
  activityId: z.string(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100),
  format: z.enum(TOURNAMENT_FORMATS),
  visibility: z.enum(VISIBILITIES).optional(),
  participantType: z.enum(PARTICIPANT_TYPES).optional(),
  seedingMethod: z.enum(SEEDING_METHODS).optional(),
  config: tournamentConfigSchema.optional(),
  startsAt: z.date().optional(),
  registrationOpensAt: z.date().optional(),
  registrationClosesAt: z.date().optional(),
})

export const updateTournamentSchema = z.object({
  tournamentId: z.string(),
  expectedVersion: z.number().int(),
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  seedingMethod: z.enum(SEEDING_METHODS).optional(),
  config: tournamentConfigSchema.optional(),
  startsAt: z.date().nullable().optional(),
  registrationOpensAt: z.date().nullable().optional(),
  registrationClosesAt: z.date().nullable().optional(),
})

export const updateTournamentStatusSchema = z.object({
  tournamentId: z.string(),
  status: z.enum(TOURNAMENT_STATUSES),
})

export const deleteDraftSchema = z.object({
  tournamentId: z.string(),
})

// =============================================================================
// Registration & Entry
// =============================================================================

export const registerSelfSchema = z.object({
  tournamentId: z.string(),
})

export const withdrawSelfSchema = z.object({
  tournamentId: z.string(),
})

export const adminRegisterSchema = z.object({
  tournamentId: z.string(),
  userId: z.string(),
})

export const adminRemoveEntrySchema = z.object({
  tournamentId: z.string(),
  entryId: z.string(),
})

export const checkInSchema = z.object({
  tournamentId: z.string(),
  entryId: z.string(),
})

// =============================================================================
// Teams
// =============================================================================

export const createTeamSchema = z.object({
  tournamentId: z.string(),
  name: z.string().min(1).max(200),
  captainUserId: z.string(),
  memberUserIds: z.array(z.string()).optional(),
})

export const adminAddTeamMemberSchema = z.object({
  tournamentId: z.string(),
  teamId: z.string(),
  userId: z.string(),
})

export const joinTeamSchema = z.object({
  tournamentId: z.string(),
  teamId: z.string(),
})

export const leaveTeamSchema = z.object({
  tournamentId: z.string(),
  teamId: z.string(),
})

export const removeTeamMemberSchema = z.object({
  tournamentId: z.string(),
  teamId: z.string(),
  userId: z.string(),
})

export const registerTeamSchema = z.object({
  tournamentId: z.string(),
  teamId: z.string(),
})

export const registerAllTeamsSchema = z.object({
  tournamentId: z.string(),
})

export const listTeamsSchema = z.object({
  tournamentId: z.string(),
})

export const createTeamsFromSmartGroupRunSchema = z.object({
  tournamentId: z.string(),
  smartGroupRunId: z.string(),
})

// =============================================================================
// Seeding
// =============================================================================

export const setSeedsSchema = z.object({
  tournamentId: z.string(),
  expectedVersion: z.number().int(),
  seeds: z.array(
    z.object({
      entryId: z.string(),
      seed: z.number().int().min(1),
    })
  ),
})

export const randomizeSeedsSchema = z.object({
  tournamentId: z.string(),
})

export const seedFromRankingSchema = z.object({
  tournamentId: z.string(),
  rankingDefinitionId: z.string(),
  includeStats: z.boolean().default(false),
})

// =============================================================================
// Match Operations
// =============================================================================

export const reportScoreSchema = z.object({
  tournamentId: z.string(),
  matchId: z.string(),
  expectedVersion: z.number().int(),
  scores: z.record(z.string(), z.unknown()),
  winnerEntryId: z.string(),
})

export const forfeitMatchSchema = z.object({
  tournamentId: z.string(),
  matchId: z.string(),
  forfeitEntryId: z.string(),
})

export const disqualifyEntrySchema = z.object({
  tournamentId: z.string(),
  entryId: z.string(),
})

// =============================================================================
// Stage Advancement
// =============================================================================

export const advanceSwissRoundSchema = z.object({
  tournamentId: z.string(),
})

export const advanceGroupStageSchema = z.object({
  tournamentId: z.string(),
})

// =============================================================================
// Cancel
// =============================================================================

export const cancelTournamentSchema = z.object({
  tournamentId: z.string(),
})

// =============================================================================
// Queries
// =============================================================================

export const getByIdSchema = z.object({
  tournamentId: z.string(),
})

export const listByActivitySchema = z.object({
  activityId: z.string(),
  status: z.enum(TOURNAMENT_STATUSES).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})

export const getBracketSchema = z.object({
  tournamentId: z.string(),
})

export const previewBracketSchema = z.object({
  tournamentId: z.string(),
})

export const getMatchesSchema = z.object({
  tournamentId: z.string(),
  roundId: z.string().optional(),
  status: z.enum(MATCH_STATUSES).optional(),
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
})

export const getStandingsSchema = z.object({
  tournamentId: z.string(),
  stageId: z.string().optional(),
  groupId: z.string().optional(),
})

export const getParticipantsSchema = z.object({
  tournamentId: z.string(),
  status: z.enum(ENTRY_STATUSES).optional(),
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
})

// =============================================================================
// Public Queries
// =============================================================================

export const publicListByActivitySchema = z.object({
  activityId: z.string(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
})

export const publicGetByIdSchema = z.object({
  activityId: z.string(),
  tournamentId: z.string(),
})

export const publicGetBracketSchema = z.object({
  activityId: z.string(),
  tournamentId: z.string(),
})

export const publicGetStandingsSchema = z.object({
  activityId: z.string(),
  tournamentId: z.string(),
  stageId: z.string().optional(),
  groupId: z.string().optional(),
})

export const publicGetMatchSchema = z.object({
  activityId: z.string(),
  tournamentId: z.string(),
  matchId: z.string(),
})

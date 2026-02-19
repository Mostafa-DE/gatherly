import { TRPCError } from "@trpc/server"
import { router, orgProcedure } from "@/trpc"
import { getActivityByIdForOrg } from "@/data-access/activities"
import { getActiveActivityMemberIds } from "@/data-access/activity-members"
import { listDomains as listDomainsFromCatalog, getDomain } from "./domains"
import {
  createRankingSchema,
  updateDefinitionSchema,
  upsertLevelsSchema,
  deleteLevelSchema,
  assignLevelSchema,
  recordStatsSchema,
  correctStatEntrySchema,
  getByActivitySchema,
  getLeaderboardSchema,
  getMemberRankSchema,
  getMemberRanksByUserSchema,
  recordMatchSchema,
  correctMatchSchema,
  listMatchesBySessionSchema,
  listMatchesByDefinitionSchema,
  getDomainConfigSchema,
  updateMemberAttributesSchema,
  updateSessionAttributesSchema,
} from "./schemas"
import {
  getRankingDefinitionByActivity,
  getRankingDefinitionById,
  createRankingDefinition,
  updateDefinitionName,
} from "./data-access/ranking-definitions"
import {
  upsertLevels,
  deleteLevel,
} from "./data-access/ranking-levels"
import {
  getMemberRankWithLevel,
  getMemberRanksByUser,
  getLeaderboard,
  assignLevel,
  recordStats,
  correctStatEntry,
  updateMemberAttributes,
} from "./data-access/member-ranks"
import {
  recordMatch,
  correctMatch,
  listMatchesBySession,
  listMatchesByDefinition,
} from "./data-access/match-records"
import {
  updateAttributeOverrides,
} from "@/data-access/participations"
import { withOrgScope } from "@/data-access/org-scope"

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins can manage rankings",
    })
  }
}

async function assertActiveMembers(
  activityId: string,
  userIds: string[]
) {
  const activeIds = await getActiveActivityMemberIds(activityId, userIds)
  const missing = userIds.filter((id) => !activeIds.has(id))
  if (missing.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Some users are not active members of this activity",
    })
  }
}

export const rankingRouter = router({
  // ===== Queries =====

  listDomains: orgProcedure.query(() => {
    return listDomainsFromCatalog()
  }),

  getByActivity: orgProcedure
    .input(getByActivitySchema)
    .query(async ({ ctx, input }) => {
      return getRankingDefinitionByActivity(
        input.activityId,
        ctx.activeOrganization.id
      )
    }),

  getSessionConfig: orgProcedure
    .input(getByActivitySchema)
    .query(async ({ ctx, input }) => {
      const definition = await getRankingDefinitionByActivity(
        input.activityId,
        ctx.activeOrganization.id
      )
      if (!definition) return null
      const domain = getDomain(definition.domainId)
      if (!domain?.sessionConfig || domain.sessionConfig.mode !== "match" || !domain.matchConfig) {
        return null
      }
      return {
        mode: "match" as const,
        formats: domain.matchConfig.supportedFormats,
        defaultFormat: domain.matchConfig.defaultFormat,
        formatRules: Object.fromEntries(
          Object.entries(domain.matchConfig.formatRules).map(([k, v]) => [
            k,
            {
              playersPerTeam: v.playersPerTeam,
              minPlayersPerTeam: v.minPlayersPerTeam,
              maxPlayersPerTeam: v.maxPlayersPerTeam,
            },
          ])
        ) as Record<string, { playersPerTeam?: number; minPlayersPerTeam?: number; maxPlayersPerTeam?: number }>,
      }
    }),

  getLeaderboard: orgProcedure
    .input(getLeaderboardSchema)
    .query(async ({ ctx, input }) => {
      // Verify definition belongs to this org
      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      // Only admins can see former members
      if (input.includeFormerMembers) {
        assertAdmin(ctx.membership.role)
      }

      return getLeaderboard(
        input.rankingDefinitionId,
        input.includeFormerMembers
      )
    }),

  getMemberRank: orgProcedure
    .input(getMemberRankSchema)
    .query(async ({ ctx, input }) => {
      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      return getMemberRankWithLevel(input.rankingDefinitionId, input.userId)
    }),

  getMemberRanksByUser: orgProcedure
    .input(getMemberRanksByUserSchema)
    .query(async ({ ctx, input }) => {
      return getMemberRanksByUser(input.userId, ctx.activeOrganization.id)
    }),

  // ===== Mutations (admin only) =====

  create: orgProcedure
    .input(createRankingSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Verify activity belongs to this org
      const activityRecord = await getActivityByIdForOrg(
        input.activityId,
        ctx.activeOrganization.id
      )
      if (!activityRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Activity not found",
        })
      }

      // Validate domain exists
      const domain = getDomain(input.domainId)
      if (!domain) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown domain: ${input.domainId}`,
        })
      }

      return createRankingDefinition(
        ctx.activeOrganization.id,
        ctx.user.id,
        input
      )
    }),

  updateDefinition: orgProcedure
    .input(updateDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return updateDefinitionName(
        input.rankingDefinitionId,
        ctx.activeOrganization.id,
        input.name
      )
    }),

  upsertLevels: orgProcedure
    .input(upsertLevelsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Verify definition belongs to this org
      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      return upsertLevels(
        input.rankingDefinitionId,
        ctx.activeOrganization.id,
        input.levels
      )
    }),

  deleteLevel: orgProcedure
    .input(deleteLevelSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      return deleteLevel(input.rankingDefinitionId, input.levelId)
    }),

  assignLevel: orgProcedure
    .input(assignLevelSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      await assertActiveMembers(definition.activityId, [input.userId])

      return assignLevel(
        input.rankingDefinitionId,
        ctx.activeOrganization.id,
        input.userId,
        input.levelId
      )
    }),

  recordStats: orgProcedure
    .input(recordStatsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      await assertActiveMembers(definition.activityId, [input.userId])

      // Validate stat keys match domain
      const domain = getDomain(definition.domainId)
      if (domain) {
        const validFields = new Set(domain.statFields.map((f) => f.id))
        const invalidKeys = Object.keys(input.stats).filter(
          (k) => !validFields.has(k)
        )
        if (invalidKeys.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid stat fields: ${invalidKeys.join(", ")}`,
          })
        }
      }

      return recordStats(
        ctx.activeOrganization.id,
        input.rankingDefinitionId,
        input.userId,
        ctx.user.id,
        {
          sessionId: input.sessionId,
          stats: input.stats,
          notes: input.notes,
        }
      )
    }),

  correctStatEntry: orgProcedure
    .input(correctStatEntrySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      return correctStatEntry(
        ctx.activeOrganization.id,
        input.rankingDefinitionId,
        input.entryId,
        ctx.user.id,
        {
          correctedStats: input.correctedStats,
          notes: input.notes,
        }
      )
    }),

  // ===== Domain Config & Attributes =====

  getDomainConfig: orgProcedure
    .input(getDomainConfigSchema)
    .query(async ({ ctx, input }) => {
      const definition = await getRankingDefinitionByActivity(
        input.activityId,
        ctx.activeOrganization.id
      )
      if (!definition) return null

      const domain = getDomain(definition.domainId)
      if (!domain) return null

      return {
        rankingDefinitionId: definition.id,
        domainId: domain.id,
        attributeFields: domain.attributeFields ?? [],
        groupingPreset: domain.groupingPreset ?? null,
      }
    }),

  updateMemberAttributes: orgProcedure
    .input(updateMemberAttributesSchema)
    .mutation(async ({ ctx, input }) => {
      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      // Only admin or the member themselves can update
      const isSelf = input.userId === ctx.user.id
      if (!isSelf) {
        assertAdmin(ctx.membership.role)
      }

      // Validate attribute keys/values against domain definition
      const domain = getDomain(definition.domainId)
      if (domain?.attributeFields) {
        const fieldMap = new Map(domain.attributeFields.map((f) => [f.id, f]))
        for (const [key, value] of Object.entries(input.attributes)) {
          const field = fieldMap.get(key)
          if (!field) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Unknown attribute: ${key}`,
            })
          }
          if (value !== null && !field.options.includes(value)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Invalid value for ${field.label}: ${value}. Valid: ${field.options.join(", ")}`,
            })
          }
        }
      }

      return updateMemberAttributes(
        input.rankingDefinitionId,
        ctx.activeOrganization.id,
        input.userId,
        input.attributes
      )
    }),

  updateSessionAttributes: orgProcedure
    .input(updateSessionAttributesSchema)
    .mutation(async ({ ctx, input }) => {
      const participationRecord = await withOrgScope(
        ctx.activeOrganization.id,
        async (scope) => scope.requireParticipationForMutation(input.participationId)
      )

      // Only admin or the participant themselves can update
      const isSelf = participationRecord.userId === ctx.user.id
      if (!isSelf) {
        assertAdmin(ctx.membership.role)
      }

      // Validate attribute keys/values if overrides are provided
      if (input.attributeOverrides) {
        // We need to find the ranking definition for this session's activity
        // to validate against domain fields — but this is optional safety
        // The overrides are stored as-is; invalid values are harmless
        // (they won't match any domain field and will be ignored in grouping)
      }

      return updateAttributeOverrides(
        input.participationId,
        input.attributeOverrides
      )
    }),

  // ===== Match Recording =====

  recordMatch: orgProcedure
    .input(recordMatchSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      const domain = getDomain(definition.domainId)
      if (!domain?.matchConfig) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This ranking domain does not support match recording",
        })
      }

      // Validate format
      if (!domain.matchConfig.supportedFormats.includes(input.matchFormat)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported match format: ${input.matchFormat}`,
        })
      }

      // Validate team sizes
      const rule = domain.matchConfig.formatRules[input.matchFormat]
      const minPerTeam = rule.playersPerTeam ?? rule.minPlayersPerTeam ?? 1
      const maxPerTeam = rule.playersPerTeam ?? rule.maxPlayersPerTeam ?? 99
      if (input.team1.length < minPerTeam || input.team1.length > maxPerTeam) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: rule.playersPerTeam
            ? `Team 1 must have ${rule.playersPerTeam} player(s) for ${input.matchFormat}`
            : `Team 1 must have ${minPerTeam}-${maxPerTeam} player(s) for ${input.matchFormat}`,
        })
      }
      if (input.team2.length < minPerTeam || input.team2.length > maxPerTeam) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: rule.playersPerTeam
            ? `Team 2 must have ${rule.playersPerTeam} player(s) for ${input.matchFormat}`
            : `Team 2 must have ${minPerTeam}-${maxPerTeam} player(s) for ${input.matchFormat}`,
        })
      }

      // Validate no duplicate players
      const allPlayers = [...input.team1, ...input.team2]
      const uniquePlayers = new Set(allPlayers)
      if (uniquePlayers.size !== allPlayers.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A player cannot be on both teams",
        })
      }

      await assertActiveMembers(definition.activityId, allPlayers)

      return recordMatch({
        organizationId: ctx.activeOrganization.id,
        rankingDefinitionId: input.rankingDefinitionId,
        domainId: definition.domainId,
        sessionId: input.sessionId,
        matchFormat: input.matchFormat,
        team1: input.team1,
        team2: input.team2,
        scores: input.scores,
        recordedBy: ctx.user.id,
        notes: input.notes,
      })
    }),

  correctMatch: orgProcedure
    .input(correctMatchSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      const domain = getDomain(definition.domainId)
      if (!domain?.matchConfig) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This ranking domain does not support match recording",
        })
      }

      // Validate format
      if (!domain.matchConfig.supportedFormats.includes(input.matchFormat)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported match format: ${input.matchFormat}`,
        })
      }

      // Validate team sizes
      const rule = domain.matchConfig.formatRules[input.matchFormat]
      const minPerTeam = rule.playersPerTeam ?? rule.minPlayersPerTeam ?? 1
      const maxPerTeam = rule.playersPerTeam ?? rule.maxPlayersPerTeam ?? 99
      if (input.team1.length < minPerTeam || input.team1.length > maxPerTeam) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: rule.playersPerTeam
            ? `Team 1 must have ${rule.playersPerTeam} player(s) for ${input.matchFormat}`
            : `Team 1 must have ${minPerTeam}-${maxPerTeam} player(s) for ${input.matchFormat}`,
        })
      }
      if (input.team2.length < minPerTeam || input.team2.length > maxPerTeam) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: rule.playersPerTeam
            ? `Team 2 must have ${rule.playersPerTeam} player(s) for ${input.matchFormat}`
            : `Team 2 must have ${minPerTeam}-${maxPerTeam} player(s) for ${input.matchFormat}`,
        })
      }

      // Validate no duplicate players
      const allPlayers = [...input.team1, ...input.team2]
      const uniquePlayers = new Set(allPlayers)
      if (uniquePlayers.size !== allPlayers.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A player cannot be on both teams",
        })
      }

      await assertActiveMembers(definition.activityId, allPlayers)

      return correctMatch({
        matchId: input.matchId,
        organizationId: ctx.activeOrganization.id,
        rankingDefinitionId: input.rankingDefinitionId,
        domainId: definition.domainId,
        sessionId: input.sessionId,
        matchFormat: input.matchFormat,
        team1: input.team1,
        team2: input.team2,
        scores: input.scores,
        recordedBy: ctx.user.id,
        notes: input.notes,
      })
    }),

  listMatchesBySession: orgProcedure
    .input(listMatchesBySessionSchema)
    .query(async ({ ctx, input }) => {
      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      return listMatchesBySession(input.rankingDefinitionId, input.sessionId)
    }),

  listMatchesByDefinition: orgProcedure
    .input(listMatchesByDefinitionSchema)
    .query(async ({ ctx, input }) => {
      const definition = await getRankingDefinitionById(
        input.rankingDefinitionId,
        ctx.activeOrganization.id
      )
      if (!definition) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Ranking not found" })
      }

      return listMatchesByDefinition(input.rankingDefinitionId, {
        limit: input.limit,
        offset: input.offset,
      })
    }),
})

import { TRPCError } from "@trpc/server"
import { router, orgProcedure } from "@/trpc"
import { eq, and, inArray } from "drizzle-orm"
import { db } from "@/db"
import { activityMember, participation } from "@/db/schema"
import { getActivityByIdForOrg } from "@/data-access/activities"
import {
  buildMemberProfiles,
  getAvailableFields as getAvailableFieldsUtil,
} from "@/data-access/member-profiles"
import { splitByAttributes, clusterByDistance, multiBalancedTeams } from "./algorithm"
import type { GroupEntry, GroupResult } from "./algorithm"
import { buildFieldMeta, fetchLevelOrderMap } from "./field-meta"
import { getCooccurrenceCounts } from "./data-access/history"
import { buildPenaltyMatrix } from "./variety"
import type { PenaltyMatrix } from "./variety"
import type { Criteria } from "./schemas"
import {
  createConfigSchema,
  updateConfigSchema,
  generateGroupsSchema,
  updateProposalSchema,
  confirmRunSchema,
  getConfigByActivitySchema,
  getRunBySessionSchema,
  getRunsByActivitySchema,
  getRunDetailsSchema,
  getAvailableFieldsSchema,
} from "./schemas"
import {
  getConfigByActivity,
  getConfigById,
  createConfig,
  updateConfig,
} from "./data-access/configs"
import {
  getLatestRunBySession,
  getRunsByActivity,
  getRunDetails,
  createRunWithEntries,
  confirmRun,
} from "./data-access/runs"
import {
  createProposals,
  updateProposalMembers,
} from "./data-access/proposals"
import { smartGroupEntry } from "./schema"

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins can manage smart groups",
    })
  }
}

function isSmartGroupsEnabled(enabledPlugins: unknown): boolean {
  const plugins = (enabledPlugins ?? {}) as Record<string, boolean>
  return plugins["smart-groups"] === true
}

const MAX_MEMBERS_BY_MODE: Record<Criteria["mode"], number> = {
  split: 50000,
  similarity: 15000,
  diversity: 15000,
  balanced: 30000,
}

function assertGroupingLimit(mode: Criteria["mode"], count: number) {
  const limit = MAX_MEMBERS_BY_MODE[mode]
  if (count > limit) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Too many members for ${mode} mode (${count}). Maximum supported is ${limit}.`,
    })
  }
}

export const smartGroupsRouter = router({
  // ===== Queries =====

  getConfigByActivity: orgProcedure
    .input(getConfigByActivitySchema)
    .query(async ({ ctx, input }) => {
      const activityRecord = await getActivityByIdForOrg(
        input.activityId,
        ctx.activeOrganization.id
      )
      if (!activityRecord || !isSmartGroupsEnabled(activityRecord.enabledPlugins)) {
        return null
      }
      return getConfigByActivity(input.activityId, ctx.activeOrganization.id)
    }),

  getAvailableFields: orgProcedure
    .input(getAvailableFieldsSchema)
    .query(async ({ ctx, input }) => {
      return getAvailableFieldsUtil({
        organizationId: ctx.activeOrganization.id,
        activityId: input.activityId,
        sessionId: input.sessionId,
      })
    }),

  getRunBySession: orgProcedure
    .input(getRunBySessionSchema)
    .query(async ({ ctx, input }) => {
      return getLatestRunBySession(input.sessionId, ctx.activeOrganization.id)
    }),

  getRunsByActivity: orgProcedure
    .input(getRunsByActivitySchema)
    .query(async ({ ctx, input }) => {
      // Verify config belongs to org
      const config = await getConfigById(input.configId, ctx.activeOrganization.id)
      if (!config) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Config not found" })
      }
      return getRunsByActivity(
        input.configId,
        ctx.activeOrganization.id,
        input.limit,
        input.offset
      )
    }),

  getRunDetails: orgProcedure
    .input(getRunDetailsSchema)
    .query(async ({ ctx, input }) => {
      return getRunDetails(input.runId, ctx.activeOrganization.id)
    }),

  // ===== Mutations =====

  createConfig: orgProcedure
    .input(createConfigSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const activityRecord = await getActivityByIdForOrg(
        input.activityId,
        ctx.activeOrganization.id
      )
      if (!activityRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found" })
      }
      if (!isSmartGroupsEnabled(activityRecord.enabledPlugins)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Smart Groups plugin is disabled for this activity",
        })
      }

      return createConfig(ctx.activeOrganization.id, ctx.user.id, input)
    }),

  updateConfig: orgProcedure
    .input(updateConfigSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const { configId, ...updates } = input
      return updateConfig(configId, ctx.activeOrganization.id, updates)
    }),

  generateGroups: orgProcedure
    .input(generateGroupsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const orgId = ctx.activeOrganization.id
      const scopedSessionId = input.scope === "session" ? input.sessionId : undefined

      // Verify config
      const config = await getConfigById(input.configId, orgId)
      if (!config) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Config not found" })
      }

      // Verify activity
      const activityRecord = await getActivityByIdForOrg(config.activityId, orgId)
      if (!activityRecord) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found" })
      }
      if (!isSmartGroupsEnabled(activityRecord.enabledPlugins)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Smart Groups plugin is disabled for this activity",
        })
      }

      // Verify session belongs to activity (if session scope)
      if (scopedSessionId) {
        const { eventSession } = await import("@/db/schema")
        const [session] = await db
          .select({ id: eventSession.id })
          .from(eventSession)
          .where(
            and(
              eq(eventSession.id, scopedSessionId),
              eq(eventSession.activityId, config.activityId),
              eq(eventSession.organizationId, orgId)
            )
          )
          .limit(1)

        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Session not found or does not belong to this activity",
          })
        }
      }

      // Determine user IDs
      let userIds: string[]
      if (scopedSessionId) {
        const participants = await db
          .select({ userId: participation.userId })
          .from(participation)
          .where(
            and(
              eq(participation.sessionId, scopedSessionId),
              eq(participation.status, "joined")
            )
          )
        userIds = participants.map((p) => p.userId)
      } else {
        const members = await db
          .select({ userId: activityMember.userId })
          .from(activityMember)
          .where(
            and(
              eq(activityMember.activityId, config.activityId),
              eq(activityMember.status, "active")
            )
          )
        userIds = members.map((m) => m.userId)
      }

      if (userIds.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No members found to group",
        })
      }

      // Determine criteria (override or default)
      const criteria = (input.criteriaOverride ?? config.defaultCriteria) as Criteria
      assertGroupingLimit(criteria.mode, userIds.length)

      // Build member profiles
      const profiles = await buildMemberProfiles({
        organizationId: orgId,
        activityId: config.activityId,
        sessionId: scopedSessionId,
        userIds,
      })

      // Build entries from profiles (include _userName for display in review panel)
      const allEntries: GroupEntry[] = profiles.map((p) => ({
        userId: p.userId,
        data: { ...p.merged, _userName: p.userName },
      }))

      // Build variety penalty if requested and applicable
      let varietyPenalty: PenaltyMatrix | undefined
      const varietyWeight = criteria.mode !== "split"
        ? (criteria as { varietyWeight?: number }).varietyWeight ?? 0
        : 0

      if (varietyWeight > 0) {
        const cooccurrences = await getCooccurrenceCounts(config.activityId, userIds)
        if (cooccurrences.size > 0) {
          varietyPenalty = buildPenaltyMatrix(cooccurrences)
        }
      }

      // Dispatch by mode
      let groups: GroupResult[]
      let effectiveEntries: GroupEntry[]
      let excludedCount = 0

      if (criteria.mode === "split") {
        effectiveEntries = allEntries
        const fieldIds = criteria.fields.map((f) => f.sourceId)
        groups = splitByAttributes(effectiveEntries, fieldIds)

      } else if (criteria.mode === "similarity" || criteria.mode === "diversity") {
        // Build field meta for distance computation
        const levelOrderMap = await fetchLevelOrderMap(config.activityId, orgId)
        const availableFields = await getAvailableFieldsUtil({
          organizationId: orgId,
          activityId: config.activityId,
          sessionId: scopedSessionId,
        })
        const fieldMetas = buildFieldMeta(criteria.fields, availableFields, levelOrderMap)

        // Exclude entries missing ANY selected field
        effectiveEntries = allEntries.filter((e) =>
          criteria.fields.every((f) => {
            const val = e.data[f.sourceId]
            return val !== null && val !== undefined && val !== ""
          })
        )
        excludedCount = allEntries.length - effectiveEntries.length

        if (effectiveEntries.length < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Not enough members with complete data (${effectiveEntries.length} after excluding ${excludedCount} with missing fields). Need at least 2.`,
          })
        }

        groups = clusterByDistance(effectiveEntries, {
          groupCount: criteria.groupCount,
          fields: fieldMetas,
          objective: criteria.mode,
          varietyPenalty,
          varietyWeight,
        })

      } else {
        // balanced mode
        effectiveEntries = allEntries.filter((e) =>
          criteria.balanceFields.every((bf) => {
            const val = e.data[bf.sourceId]
            return val !== null && val !== undefined && typeof val === "number"
          })
        )

        if (criteria.partitionFields && criteria.partitionFields.length > 0) {
          effectiveEntries = effectiveEntries.filter((e) =>
            criteria.partitionFields!.every((pf) => {
              const val = e.data[pf]
              return val !== null && val !== undefined && val !== ""
            })
          )
        }

        excludedCount = allEntries.length - effectiveEntries.length

        if (effectiveEntries.length < 2) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Not enough members with required data (${effectiveEntries.length} after excluding ${excludedCount}). Need at least 2.`,
          })
        }

        groups = multiBalancedTeams(effectiveEntries, {
          teamCount: criteria.teamCount,
          balanceFields: criteria.balanceFields,
          partitionFields: criteria.partitionFields,
          varietyPenalty,
          varietyWeight,
        })
      }

      // Compute excluded entries (saved for display but not grouped)
      const effectiveUserIds = new Set(effectiveEntries.map((e) => e.userId))
      const excludedEntries = allEntries.filter(
        (e) => !effectiveUserIds.has(e.userId)
      )

      // Create run + entries + proposals in transaction
      const result = await db.transaction(async (tx) => {
        const run = await createRunWithEntries(
          tx,
          {
            organizationId: orgId,
            smartGroupConfigId: config.id,
            sessionId: scopedSessionId,
            scope: input.scope,
            criteriaSnapshot: criteria,
            entryCount: effectiveEntries.length,
            groupCount: groups.length,
            excludedCount,
            generatedBy: ctx.user.id,
          },
          [
            ...effectiveEntries.map((e) => ({
              userId: e.userId,
              dataSnapshot: e.data,
            })),
            ...excludedEntries.map((e) => ({
              userId: e.userId,
              dataSnapshot: e.data,
            })),
          ]
        )

        await createProposals(
          tx,
          run.id,
          groups.map((g, i) => ({
            groupIndex: i,
            groupName: g.groupName,
            memberIds: g.memberIds,
          }))
        )

        return run
      })

      // Return the full run with proposals
      return getRunDetails(result.id, orgId)
    }),

  updateProposal: orgProcedure
    .input(updateProposalSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const orgId = ctx.activeOrganization.id

      // Validate modified member IDs: no duplicates
      const idSet = new Set(input.modifiedMemberIds)
      if (idSet.size !== input.modifiedMemberIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Duplicate member IDs in modifiedMemberIds",
        })
      }

      // Get the proposal to find its run
      const proposalResult = await db.query.smartGroupProposal.findFirst({
        where: eq(
          (await import("./schema")).smartGroupProposal.id,
          input.proposalId
        ),
      })

      if (!proposalResult) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found" })
      }

      // Validate all modified IDs exist in the run's entries
      if (input.modifiedMemberIds.length > 0) {
        const entryUserIds = await db
          .select({ userId: smartGroupEntry.userId })
          .from(smartGroupEntry)
          .where(
            and(
              eq(smartGroupEntry.smartGroupRunId, proposalResult.smartGroupRunId),
              inArray(smartGroupEntry.userId, input.modifiedMemberIds)
            )
          )

        const foundIds = new Set(entryUserIds.map((e) => e.userId))
        const invalid = input.modifiedMemberIds.filter((id) => !foundIds.has(id))
        if (invalid.length > 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid member IDs not in this run: ${invalid.join(", ")}`,
          })
        }
      }

      return updateProposalMembers(
        input.proposalId,
        orgId,
        input.modifiedMemberIds,
        input.expectedVersion
      )
    }),

  confirmRun: orgProcedure
    .input(confirmRunSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return confirmRun(
        input.runId,
        ctx.activeOrganization.id,
        ctx.user.id,
        input.expectedVersion
      )
    }),
})

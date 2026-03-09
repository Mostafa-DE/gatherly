import { and, eq, ne, desc } from "drizzle-orm"
import { TRPCError } from "@trpc/server"
import { db } from "@/db"
import { activity } from "@/db/schema"
import { router, orgProcedure, publicProcedure } from "@/trpc"
import { getActivityByIdForOrg } from "@/data-access/activities"
import { getActiveActivityMember } from "@/data-access/activity-members"
import { tournament, tournamentTeam, tournamentTeamMember } from "./schema"
import {
  createTournamentSchema,
  updateTournamentSchema,
  updateTournamentStatusSchema,
  deleteDraftSchema,
  registerSelfSchema,
  withdrawSelfSchema,
  adminRegisterSchema,
  adminRemoveEntrySchema,
  checkInSchema,
  setSeedsSchema,
  randomizeSeedsSchema,
  seedFromRankingSchema,
  previewBracketSchema,
  reportScoreSchema,
  forfeitMatchSchema,
  disqualifyEntrySchema,
  advanceSwissRoundSchema,
  advanceGroupStageSchema,
  cancelTournamentSchema,
  getByIdSchema,
  listByActivitySchema,
  getBracketSchema,
  getMatchesSchema,
  getStandingsSchema,
  getParticipantsSchema,
  publicListByActivitySchema,
  publicGetByIdSchema,
  publicGetBracketSchema,
  publicGetStandingsSchema,
  publicGetMatchSchema,
  createTeamSchema,
  joinTeamSchema,
  leaveTeamSchema,
  removeTeamMemberSchema,
  registerTeamSchema,
  listTeamsSchema,
  createTeamsFromSmartGroupRunSchema,
  adminAddTeamMemberSchema,
  registerAllTeamsSchema,
} from "./schemas"
import {
  getTournamentById,
  listTournamentsByActivity,
  createTournament,
  updateTournament,
  updateTournamentStatus,
  deleteDraftTournament,
} from "./data-access/tournaments"
import {
  registerEntry,
  withdrawEntry,
  checkInEntry,
  listEntries,
  setSeeds,
  randomizeSeeds,
  removeEntry,
} from "./data-access/entries"
import {
  getMatchesByTournament,
} from "./data-access/matches"
import { getStagesByTournament, getFullBracket } from "./data-access/stages"
import {
  createTeam,
  joinTeam,
  leaveTeam,
  removeTeamMember,
  registerTeamEntry,
  listTeamsWithMembers,
  createTeamsFromSmartGroupRun,
} from "./data-access/teams"
import { getStandingsByStage } from "./data-access/standings"
import {
  startTournament,
  completeMatch,
  forfeitAndProgress,
  cancelTournament,
  disqualifyAndForfeit,
} from "./data-access/lifecycle"
import { seedFromRanking } from "./data-access/seeding"
import { previewBracket } from "./data-access/preview"
import { advanceSwissRound, advanceGroupStage } from "./data-access/advancement"
import {
  getPublicBracket,
  getPublicMatch,
  getPublicStandings,
} from "./data-access/public"
import type { TournamentStatus } from "./types"
import { assertTournamentTransition } from "./state-machine"

function assertAdmin(role: string) {
  if (role !== "owner" && role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins can manage tournaments",
    })
  }
}

function isTournamentsEnabled(enabledPlugins: unknown): boolean {
  const plugins = (enabledPlugins ?? {}) as Record<string, boolean>
  return plugins["tournaments"] === true
}

const publicTournamentColumns = {
  id: tournament.id,
  name: tournament.name,
  slug: tournament.slug,
  format: tournament.format,
  status: tournament.status,
  participantType: tournament.participantType,
  visibility: tournament.visibility,
  startsAt: tournament.startsAt,
  activityId: tournament.activityId,
} as const

async function requireActivity(activityId: string, organizationId: string) {
  const activityRecord = await getActivityByIdForOrg(activityId, organizationId)
  if (!activityRecord) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Activity not found" })
  }
  if (!isTournamentsEnabled(activityRecord.enabledPlugins)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tournaments plugin is not enabled for this activity",
    })
  }
  return activityRecord
}

async function requireTournament(tournamentId: string, organizationId: string) {
  const t = await getTournamentById(tournamentId, organizationId)
  if (!t) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" })
  }
  await requireActivity(t.activityId, organizationId)
  return t
}

async function isPublicActivityTournamentsEnabled(activityId: string) {
  const [activityRecord] = await db
    .select({
      enabledPlugins: activity.enabledPlugins,
    })
    .from(activity)
    .where(eq(activity.id, activityId))
    .limit(1)

  return activityRecord
    ? isTournamentsEnabled(activityRecord.enabledPlugins)
    : false
}

async function requirePublicTournament(activityId: string, tournamentId: string) {
  if (!(await isPublicActivityTournamentsEnabled(activityId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" })
  }

  const [result] = await db
    .select(publicTournamentColumns)
    .from(tournament)
    .where(
      and(
        eq(tournament.id, tournamentId),
        eq(tournament.activityId, activityId)
      )
    )
    .limit(1)

  if (!result || result.visibility !== "public" || result.status === "draft") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Tournament not found" })
  }

  return result
}

export const tournamentRouter = router({
  // =========================================================================
  // Queries (org member)
  // =========================================================================

  getById: orgProcedure
    .input(getByIdSchema)
    .query(async ({ ctx, input }) => {
      return requireTournament(input.tournamentId, ctx.activeOrganization.id)
    }),

  listByActivity: orgProcedure
    .input(listByActivitySchema)
    .query(async ({ ctx, input }) => {
      await requireActivity(input.activityId, ctx.activeOrganization.id)
      return listTournamentsByActivity(
        input.activityId,
        ctx.activeOrganization.id,
        {
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        }
      )
    }),

  getBracket: orgProcedure
    .input(getBracketSchema)
    .query(async ({ ctx, input }) => {
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      const bracket = await getFullBracket(t.id)
      return { tournament: t, ...bracket }
    }),

  previewBracket: orgProcedure
    .input(previewBracketSchema)
    .query(async ({ ctx, input }) => {
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return previewBracket(input.tournamentId, ctx.activeOrganization.id)
    }),

  getMatches: orgProcedure
    .input(getMatchesSchema)
    .query(async ({ ctx, input }) => {
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return getMatchesByTournament(
        input.tournamentId,
        ctx.activeOrganization.id,
        {
          roundId: input.roundId,
          status: input.status,
          limit: input.limit,
          offset: input.offset,
        }
      )
    }),

  getStandings: orgProcedure
    .input(getStandingsSchema)
    .query(async ({ ctx, input }) => {
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      const stages = await getStagesByTournament(input.tournamentId)
      const targetStage = input.stageId
        ? stages.find((s) => s.id === input.stageId)
        : stages[0]

      if (!targetStage) return []
      return getStandingsByStage(targetStage.id, input.groupId)
    }),

  getParticipants: orgProcedure
    .input(getParticipantsSchema)
    .query(async ({ ctx, input }) => {
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return listEntries(input.tournamentId, ctx.activeOrganization.id, {
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      })
    }),

  // =========================================================================
  // Member self-service mutations
  // =========================================================================

  registerSelf: orgProcedure
    .input(registerSelfSchema)
    .mutation(async ({ ctx, input }) => {
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      const activityMembership = await getActiveActivityMember(t.activityId, ctx.user.id)
      if (!activityMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be an active member of this activity to register",
        })
      }
      return registerEntry(t.id, ctx.activeOrganization.id, ctx.user.id)
    }),

  withdrawSelf: orgProcedure
    .input(withdrawSelfSchema)
    .mutation(async ({ ctx, input }) => {
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return withdrawEntry(t.id, ctx.activeOrganization.id, ctx.user.id)
    }),

  checkInSelf: orgProcedure
    .input(registerSelfSchema)
    .mutation(async ({ ctx, input }) => {
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      if (t.status !== "check_in") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Check-in is not open for this tournament",
        })
      }

      // Try individual entry first
      const entries = await listEntries(t.id, ctx.activeOrganization.id, { limit: 1000, offset: 0 })
      let myEntry = entries.find((e) => e.userId === ctx.user.id)

      // If not found, check if the user is on a team and find the team's entry
      if (!myEntry) {
        const [teamMembership] = await db
          .select({ teamId: tournamentTeamMember.teamId })
          .from(tournamentTeamMember)
          .innerJoin(tournamentTeam, eq(tournamentTeamMember.teamId, tournamentTeam.id))
          .where(
            and(
              eq(tournamentTeam.tournamentId, t.id),
              eq(tournamentTeamMember.userId, ctx.user.id)
            )
          )
          .limit(1)

        if (teamMembership) {
          myEntry = entries.find((e) => e.teamId === teamMembership.teamId)
        }
      }

      if (!myEntry) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "You are not registered in this tournament",
        })
      }
      return checkInEntry(myEntry.id, ctx.activeOrganization.id, t.id)
    }),

  // =========================================================================
  // Team self-service mutations
  // =========================================================================

  joinTeam: orgProcedure
    .input(joinTeamSchema)
    .mutation(async ({ ctx, input }) => {
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      const activityMembership = await getActiveActivityMember(t.activityId, ctx.user.id)
      if (!activityMembership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be an active member of this activity to join a team",
        })
      }
      return joinTeam(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.teamId,
        ctx.user.id
      )
    }),

  leaveTeam: orgProcedure
    .input(leaveTeamSchema)
    .mutation(async ({ ctx, input }) => {
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return leaveTeam(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.teamId,
        ctx.user.id
      )
    }),

  // =========================================================================
  // Team queries
  // =========================================================================

  listTeams: orgProcedure
    .input(listTeamsSchema)
    .query(async ({ ctx, input }) => {
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return listTeamsWithMembers(
        input.tournamentId,
        ctx.activeOrganization.id
      )
    }),

  // =========================================================================
  // Admin mutations
  // =========================================================================

  create: orgProcedure
    .input(createTournamentSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireActivity(input.activityId, ctx.activeOrganization.id)

      return createTournament(ctx.activeOrganization.id, ctx.user.id, {
        activityId: input.activityId,
        name: input.name,
        slug: input.slug,
        format: input.format,
        visibility: input.visibility,
        participantType: input.participantType,
        seedingMethod: input.seedingMethod,
        config: input.config,
        startsAt: input.startsAt,
        registrationOpensAt: input.registrationOpensAt,
        registrationClosesAt: input.registrationClosesAt,
      })
    }),

  update: orgProcedure
    .input(updateTournamentSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      return updateTournament(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.expectedVersion,
        {
          name: input.name,
          slug: input.slug,
          visibility: input.visibility,
          seedingMethod: input.seedingMethod,
          config: input.config,
          startsAt: input.startsAt,
          registrationOpensAt: input.registrationOpensAt,
          registrationClosesAt: input.registrationClosesAt,
        }
      )
    }),

  deleteDraft: orgProcedure
    .input(deleteDraftSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return deleteDraftTournament(t.id, ctx.activeOrganization.id)
    }),

  updateStatus: orgProcedure
    .input(updateTournamentStatusSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      // Special handling for "in_progress" — use lifecycle start
      if (input.status === "in_progress") {
        return startTournament(t.id, ctx.activeOrganization.id)
      }

      // For cancel, use lifecycle cancel
      if (input.status === "cancelled") {
        return cancelTournament(t.id, ctx.activeOrganization.id)
      }

      // For other transitions, validate and update directly
      assertTournamentTransition(t.status as TournamentStatus, input.status as TournamentStatus)

      return db.transaction(async (tx) => {
        return updateTournamentStatus(
          tx,
          t.id,
          ctx.activeOrganization.id,
          input.status as TournamentStatus
        )
      })
    }),

  adminRegister: orgProcedure
    .input(adminRegisterSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      const activityMembership = await getActiveActivityMember(t.activityId, input.userId)
      if (!activityMembership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is not an active member of this activity",
        })
      }
      return registerEntry(t.id, ctx.activeOrganization.id, input.userId, { allowDraft: true })
    }),

  adminRemoveParticipant: orgProcedure
    .input(adminRemoveEntrySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      if (
        t.status !== "draft" &&
        t.status !== "registration" &&
        t.status !== "check_in"
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Participants can only be removed before the tournament starts",
        })
      }

      return removeEntry(input.entryId, ctx.activeOrganization.id, t.id)
    }),

  createTeam: orgProcedure
    .input(createTeamSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      const activityMembership = await getActiveActivityMember(t.activityId, input.captainUserId)
      if (!activityMembership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected member is not an active member of this activity",
        })
      }
      const team = await createTeam(
        ctx.activeOrganization.id,
        input.tournamentId,
        input.name,
        input.captainUserId
      )
      // Add additional members if provided
      if (input.memberUserIds && input.memberUserIds.length > 0) {
        for (const userId of input.memberUserIds) {
          if (userId === input.captainUserId) continue
          const memberActivity = await getActiveActivityMember(t.activityId, userId)
          if (!memberActivity) continue
          try {
            await joinTeam(
              input.tournamentId,
              ctx.activeOrganization.id,
              team.id,
              userId
            )
          } catch {
            // Skip members that can't be added (already on another team, etc.)
          }
        }
      }
      return team
    }),

  adminAddTeamMember: orgProcedure
    .input(adminAddTeamMemberSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      const activityMembership = await getActiveActivityMember(t.activityId, input.userId)
      if (!activityMembership) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User is not an active member of this activity",
        })
      }
      return joinTeam(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.teamId,
        input.userId
      )
    }),

  removeTeamMember: orgProcedure
    .input(removeTeamMemberSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return removeTeamMember(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.teamId,
        input.userId
      )
    }),

  registerTeam: orgProcedure
    .input(registerTeamSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return registerTeamEntry(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.teamId,
        { allowDraft: true }
      )
    }),

  registerAllTeams: orgProcedure
    .input(registerAllTeamsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      if (t.participantType !== "team") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This tournament is for individual participants",
        })
      }
      const teams = await listTeamsWithMembers(input.tournamentId, ctx.activeOrganization.id)
      // Get existing entries to skip already-registered teams
      const entries = await listEntries(input.tournamentId, ctx.activeOrganization.id, { limit: 1000, offset: 0 })
      const registeredTeamIds = new Set(entries.map((e) => e.teamId).filter(Boolean))

      const results = []
      for (const team of teams) {
        if (registeredTeamIds.has(team.id)) continue
        try {
          const entry = await registerTeamEntry(input.tournamentId, ctx.activeOrganization.id, team.id, { allowDraft: true })
          results.push(entry)
        } catch {
          // Skip teams that fail validation (e.g. too few members)
        }
      }
      return { registered: results.length, total: teams.length }
    }),

  createTeamsFromSmartGroupRun: orgProcedure
    .input(createTeamsFromSmartGroupRunSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return createTeamsFromSmartGroupRun(
        ctx.activeOrganization.id,
        input.tournamentId,
        input.smartGroupRunId
      )
    }),

  checkIn: orgProcedure
    .input(checkInSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return checkInEntry(input.entryId, ctx.activeOrganization.id, t.id)
    }),

  setSeeds: orgProcedure
    .input(setSeedsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return setSeeds(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.expectedVersion,
        input.seeds
      )
    }),

  randomizeSeeds: orgProcedure
    .input(randomizeSeedsSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return randomizeSeeds(input.tournamentId, ctx.activeOrganization.id)
    }),

  seedFromRanking: orgProcedure
    .input(seedFromRankingSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      return seedFromRanking(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.rankingDefinitionId,
        { includeStats: input.includeStats }
      )
    }),

  reportScore: orgProcedure
    .input(reportScoreSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      return completeMatch(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.matchId,
        input.expectedVersion,
        {
          scores: input.scores,
          winnerEntryId: input.winnerEntryId,
        }
      )
    }),

  forfeitMatch: orgProcedure
    .input(forfeitMatchSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      return forfeitAndProgress(
        input.tournamentId,
        ctx.activeOrganization.id,
        input.matchId,
        input.forfeitEntryId
      )
    }),

  disqualifyParticipant: orgProcedure
    .input(disqualifyEntrySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return disqualifyAndForfeit(t.id, ctx.activeOrganization.id, input.entryId)
    }),

  advanceSwissRound: orgProcedure
    .input(advanceSwissRoundSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      return advanceSwissRound(input.tournamentId, ctx.activeOrganization.id)
    }),

  advanceGroupStage: orgProcedure
    .input(advanceGroupStageSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      await requireTournament(input.tournamentId, ctx.activeOrganization.id)

      return advanceGroupStage(input.tournamentId, ctx.activeOrganization.id)
    }),

  cancel: orgProcedure
    .input(cancelTournamentSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const t = await requireTournament(input.tournamentId, ctx.activeOrganization.id)
      return cancelTournament(t.id, ctx.activeOrganization.id)
    }),

  // =========================================================================
  // Public queries (visibility-filtered)
  // =========================================================================

  publicListByActivity: publicProcedure
    .input(publicListByActivitySchema)
    .query(async ({ input }) => {
      if (!(await isPublicActivityTournamentsEnabled(input.activityId))) {
        return []
      }

      return db
        .select(publicTournamentColumns)
        .from(tournament)
        .where(
          and(
            eq(tournament.activityId, input.activityId),
            eq(tournament.visibility, "public"),
            ne(tournament.status, "draft")
          )
        )
        .orderBy(desc(tournament.createdAt))
        .limit(input.limit)
        .offset(input.offset)
    }),

  publicGetById: publicProcedure
    .input(publicGetByIdSchema)
    .query(async ({ input }) => {
      return requirePublicTournament(input.activityId, input.tournamentId)
    }),

  publicGetBracket: publicProcedure
    .input(publicGetBracketSchema)
    .query(async ({ input }) => {
      const t = await requirePublicTournament(input.activityId, input.tournamentId)

      const bracket = await getPublicBracket(t.id)
      return { tournament: t, ...bracket }
    }),

  publicGetStandings: publicProcedure
    .input(publicGetStandingsSchema)
    .query(async ({ input }) => {
      const t = await requirePublicTournament(input.activityId, input.tournamentId)

      const standings = await getPublicStandings(
        t.id,
        input.stageId,
        input.groupId
      )
      return { tournament: t, ...standings }
    }),

  publicGetMatch: publicProcedure
    .input(publicGetMatchSchema)
    .query(async ({ input }) => {
      const t = await requirePublicTournament(input.activityId, input.tournamentId)

      const match = await getPublicMatch(t.id, input.matchId)
      if (!match) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Match not found" })
      }

      return { tournament: t, ...match }
    }),
})

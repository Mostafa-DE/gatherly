import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Session, User } from "@/db/types"
import { db } from "@/db"
import {
  cleanupTestData,
  createTestActivity,
  createTestActivityMember,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"
import { createConfig } from "@/plugins/smart-groups/data-access/configs"
import { createRunWithEntries, confirmRun } from "@/plugins/smart-groups/data-access/runs"
import { createProposals } from "@/plugins/smart-groups/data-access/proposals"
import { createRankingDefinition } from "@/plugins/ranking/data-access/ranking-definitions"
import { assignLevel } from "@/plugins/ranking/data-access/member-ranks"
import {
  tournamentEntry,
  tournamentGroup,
  tournamentRound,
  tournamentStage,
  tournamentStanding,
  tournamentTeam,
} from "@/plugins/tournaments/schema"

function buildCaller(user: User, activeOrganizationId: string) {
  const authSession: Session = {
    id: `sess_${randomUUID().replaceAll("-", "")}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    token: `token_${randomUUID().replaceAll("-", "")}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
    userId: user.id,
    activeOrganizationId,
  }
  return appRouter.createCaller(createTRPCContext({ user, session: authSession }))
}

function getPgError(error: unknown) {
  if (!error || typeof error !== "object") {
    return null
  }

  const candidate = error as {
    code?: string
    constraint?: string
    cause?: unknown
  }

  if (candidate.code) {
    return candidate as { code: string; constraint?: string }
  }

  if (candidate.cause && typeof candidate.cause === "object") {
    const cause = candidate.cause as {
      code?: string
      constraint?: string
    }
    if (cause.code) {
      return cause as { code: string; constraint?: string }
    }
  }

  return null
}

async function expectPgConstraintViolation(
  promise: Promise<unknown>,
  expected: { code: string; constraint: string }
) {
  try {
    await promise
    throw new Error("Expected database constraint violation")
  } catch (error) {
    const pgError = getPgError(error)
    expect(pgError?.code).toBe(expected.code)
    expect(pgError?.constraint).toBe(expected.constraint)
  }
}

describe("tournaments router", () => {
  let organizationId = ""
  let activityId = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("tourney-owner")
    const ownerUser = await createTestUser("Tournament Owner")
    const adminUser = await createTestUser("Tournament Admin")
    const member = await createTestUser("Tournament Member")

    organizationId = organization.id
    owner = ownerUser
    admin = adminUser
    memberUser = member

    organizationIds.push(organizationId)
    userIds.push(owner.id, admin.id, memberUser.id)

    await createTestMembership({ organizationId, userId: owner.id, role: "owner" })
    await createTestMembership({ organizationId, userId: admin.id, role: "admin" })
    await createTestMembership({ organizationId, userId: memberUser.id, role: "member" })

    const activity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Tournament Activity",
      slug: `tourney-activity-${randomUUID().slice(0, 8)}`,
    })
    activityId = activity.id

    // Add activity memberships for all users
    await createTestActivityMember({ activityId, userId: owner.id })
    await createTestActivityMember({ activityId, userId: admin.id })
    await createTestActivityMember({ activityId, userId: memberUser.id })

    // Enable tournaments plugin on the activity
    const ownerCaller = buildCaller(owner, organizationId)
    await ownerCaller.activity.togglePlugin({
      activityId,
      pluginId: "tournaments",
      enabled: true,
    })
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({ organizationIds, userIds })
    }
    organizationId = ""
    activityId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  async function createStartedTournamentForFormat(params: {
    adminCaller: ReturnType<typeof buildCaller>
    format: "single_elimination" | "double_elimination" | "round_robin" | "swiss" | "group_knockout" | "free_for_all"
    participantCount: number
    slug: string
    name: string
    config?: Record<string, unknown>
  }) {
    const { adminCaller, format, participantCount, slug, name, config } = params
    const players: User[] = []

    for (let i = 0; i < participantCount; i++) {
      const player = await createTestUser(`${name} Player ${i}`)
      userIds.push(player.id)
      await createTestMembership({ organizationId, userId: player.id, role: "member" })
      await createTestActivityMember({ activityId, userId: player.id })
      players.push(player)
    }

    const tournament = await adminCaller.plugin.tournaments.create({
      activityId,
      name,
      slug,
      format,
      visibility: "public",
      participantType: "individual",
      config,
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: tournament.id,
      status: "registration",
    })

    for (const player of players) {
      await adminCaller.plugin.tournaments.adminRegister({
        tournamentId: tournament.id,
        userId: player.id,
      })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: tournament.id,
      limit: participantCount + 2,
      offset: 0,
    })

    const currentTournament = await adminCaller.plugin.tournaments.getById({
      tournamentId: tournament.id,
    })

    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: tournament.id,
      expectedVersion: currentTournament.version,
      seeds: entries.map((entry, index) => ({ entryId: entry.id, seed: index + 1 })),
    })

    const started = await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: tournament.id,
      status: "in_progress",
    })

    const bracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: tournament.id,
    })

    return { tournament, started, bracket }
  }

  async function reportMatchWinners(
    adminCaller: ReturnType<typeof buildCaller>,
    tournamentId: string,
    matchIds: string[]
  ) {
    const bracket = await adminCaller.plugin.tournaments.getBracket({ tournamentId })

    for (const matchId of matchIds) {
      const match = bracket.matches.find((candidate) => candidate.id === matchId)
      const matchEntries = bracket.matchEntries
        .filter((entry) => entry.matchId === matchId)
        .sort((left, right) => left.slot - right.slot)

      if (!match || match.status === "bye" || matchEntries.length < 2) {
        continue
      }

      await adminCaller.plugin.tournaments.reportScore({
        tournamentId,
        matchId,
        expectedVersion: match.version,
        winnerEntryId: matchEntries[0].entryId,
        scores: {
          winner: 1,
          loser: 0,
        },
      })
    }
  }

  // =========================================================================
  // Admin guard
  // =========================================================================

  it("enforces admin guard on create", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.plugin.tournaments.create({
        activityId,
        name: "Member Tournament",
        slug: "member-tournament",
        format: "single_elimination",
        visibility: "public",
        participantType: "individual",
        seedingMethod: "manual",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only admins can manage tournaments",
    })
  })

  // =========================================================================
  // Create + Get
  // =========================================================================

  it("admin can create and retrieve a tournament", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Test Cup",
      slug: "test-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    expect(created.name).toBe("Test Cup")
    expect(created.slug).toBe("test-cup")
    expect(created.format).toBe("single_elimination")
    expect(created.status).toBe("draft")
    expect(created.version).toBe(1)

    const fetched = await adminCaller.plugin.tournaments.getById({
      tournamentId: created.id,
    })
    expect(fetched.id).toBe(created.id)
    expect(fetched.name).toBe("Test Cup")
  })

  it("defaults individual tournaments to ranking seeding when omitted", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Ranked Default Cup",
      slug: "ranked-default-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
    })

    expect(created.seedingMethod).toBe("ranking")
  })

  it("defaults team tournaments to manual seeding when omitted", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Team Default Cup",
      slug: "team-default-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
    })

    expect(created.seedingMethod).toBe("manual")
  })

  it("rejects duplicate tournament slug within the same activity on create", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await adminCaller.plugin.tournaments.create({
      activityId,
      name: "First Cup",
      slug: "same-slug",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await expect(
      adminCaller.plugin.tournaments.create({
        activityId,
        name: "Second Cup",
        slug: "same-slug",
        format: "round_robin",
        visibility: "public",
        participantType: "individual",
        seedingMethod: "manual",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A tournament with this slug already exists in this activity",
    })
  })

  // =========================================================================
  // Plugin not enabled
  // =========================================================================

  it("rejects create when tournaments plugin is not enabled", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const ownerCaller = buildCaller(owner, organizationId)

    // Disable the plugin
    await ownerCaller.activity.togglePlugin({
      activityId,
      pluginId: "tournaments",
      enabled: false,
    })

    await expect(
      adminCaller.plugin.tournaments.create({
        activityId,
        name: "Disabled Plugin Tournament",
        slug: "disabled",
        format: "single_elimination",
        visibility: "public",
        participantType: "individual",
        seedingMethod: "manual",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Tournaments plugin is not enabled for this activity",
    })
  })

  it("rejects tournament reads when tournaments plugin is disabled after creation", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const ownerCaller = buildCaller(owner, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Disable After Create",
      slug: "disable-after-create",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await ownerCaller.activity.togglePlugin({
      activityId,
      pluginId: "tournaments",
      enabled: false,
    })

    await expect(
      adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Tournaments plugin is not enabled for this activity",
    })
  })

  it("enforces split null-group uniqueness for rounds", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Round Null Group Constraint",
      slug: "round-null-group-constraint",
      format: "group_knockout",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    const [stage] = await db.insert(tournamentStage).values({
      organizationId,
      tournamentId: t.id,
      stageType: "group",
      stageOrder: 1,
    }).returning()

    const [groupA] = await db.insert(tournamentGroup).values({
      stageId: stage.id,
      name: "Group A",
      groupOrder: 1,
    }).returning()

    const [groupB] = await db.insert(tournamentGroup).values({
      stageId: stage.id,
      name: "Group B",
      groupOrder: 2,
    }).returning()

    await db.insert(tournamentRound).values({
      organizationId,
      stageId: stage.id,
      roundNumber: 1,
    })

    await db.insert(tournamentRound).values({
      organizationId,
      stageId: stage.id,
      groupId: groupA.id,
      roundNumber: 1,
    })

    await db.insert(tournamentRound).values({
      organizationId,
      stageId: stage.id,
      groupId: groupB.id,
      roundNumber: 1,
    })

    await expectPgConstraintViolation(
      db.insert(tournamentRound).values({
        organizationId,
        stageId: stage.id,
        roundNumber: 1,
      }),
      {
        code: "23505",
        constraint: "tournament_round_stage_no_group_idx",
      }
    )

    await expectPgConstraintViolation(
      db.insert(tournamentRound).values({
        organizationId,
        stageId: stage.id,
        groupId: groupA.id,
        roundNumber: 1,
      }),
      {
        code: "23505",
        constraint: "tournament_round_stage_group_idx",
      }
    )
  })

  it("enforces split null-group uniqueness for standings", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const player = await createTestUser("Standing Constraint Player")
    userIds.push(player.id)
    await createTestMembership({ organizationId, userId: player.id, role: "member" })
    await createTestActivityMember({ activityId, userId: player.id })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Standing Null Group Constraint",
      slug: "standing-null-group-constraint",
      format: "group_knockout",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    const [stage] = await db.insert(tournamentStage).values({
      organizationId,
      tournamentId: t.id,
      stageType: "group",
      stageOrder: 1,
    }).returning()

    const [groupA] = await db.insert(tournamentGroup).values({
      stageId: stage.id,
      name: "Group A",
      groupOrder: 1,
    }).returning()

    const [entry] = await db.insert(tournamentEntry).values({
      organizationId,
      tournamentId: t.id,
      userId: player.id,
    }).returning()

    await db.insert(tournamentStanding).values({
      organizationId,
      stageId: stage.id,
      entryId: entry.id,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      tiebreakers: {},
    })

    await db.insert(tournamentStanding).values({
      organizationId,
      stageId: stage.id,
      groupId: groupA.id,
      entryId: entry.id,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      tiebreakers: {},
    })

    await expectPgConstraintViolation(
      db.insert(tournamentStanding).values({
        organizationId,
        stageId: stage.id,
        entryId: entry.id,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        tiebreakers: {},
      }),
      {
        code: "23505",
        constraint: "tournament_standing_stage_no_group_idx",
      }
    )

    await expectPgConstraintViolation(
      db.insert(tournamentStanding).values({
        organizationId,
        stageId: stage.id,
        groupId: groupA.id,
        entryId: entry.id,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        tiebreakers: {},
      }),
      {
        code: "23505",
        constraint: "tournament_standing_stage_group_idx",
      }
    )
  })

  it("enforces tournament entry XOR for user or team ownership", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const player = await createTestUser("Entry XOR Player")
    userIds.push(player.id)
    await createTestMembership({ organizationId, userId: player.id, role: "member" })
    await createTestActivityMember({ activityId, userId: player.id })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Entry XOR Constraint",
      slug: "entry-xor-constraint",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      seedingMethod: "manual",
    })

    const [team] = await db.insert(tournamentTeam).values({
      organizationId,
      tournamentId: t.id,
      name: "Constraint Team",
      captainUserId: player.id,
    }).returning()

    await expectPgConstraintViolation(
      db.insert(tournamentEntry).values({
        organizationId,
        tournamentId: t.id,
        userId: player.id,
        teamId: team.id,
      }),
      {
        code: "23514",
        constraint: "tournament_entry_xor_user_team",
      }
    )

    await expectPgConstraintViolation(
      db.insert(tournamentEntry).values({
        organizationId,
        tournamentId: t.id,
      }),
      {
        code: "23514",
        constraint: "tournament_entry_xor_user_team",
      }
    )
  })

  // =========================================================================
  // List by activity
  // =========================================================================

  it("lists tournaments by activity", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Cup A",
      slug: "cup-a",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })
    await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Cup B",
      slug: "cup-b",
      format: "round_robin",
      visibility: "org_members",
      participantType: "individual",
      seedingMethod: "manual",
    })

    const list = await adminCaller.plugin.tournaments.listByActivity({
      activityId,
      limit: 10,
      offset: 0,
    })

    expect(list).toHaveLength(2)
  })

  // =========================================================================
  // Update (optimistic locking)
  // =========================================================================

  it("updates a tournament with optimistic locking", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Update Me",
      slug: "update-me",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    const updated = await adminCaller.plugin.tournaments.update({
      tournamentId: created.id,
      expectedVersion: created.version,
      name: "Updated Name",
    })

    expect(updated.name).toBe("Updated Name")
    expect(updated.version).toBe(2)
  })

  it("rejects duplicate tournament slug within the same activity on update", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Slug Owner",
      slug: "taken-slug",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    const created = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Slug Renamed",
      slug: "rename-me",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await expect(
      adminCaller.plugin.tournaments.update({
        tournamentId: created.id,
        expectedVersion: created.version,
        slug: "taken-slug",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A tournament with this slug already exists in this activity",
    })
  })

  it("rejects stale version on update", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Stale Update",
      slug: "stale-update",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    // First update succeeds
    await adminCaller.plugin.tournaments.update({
      tournamentId: created.id,
      expectedVersion: created.version,
      name: "First Update",
    })

    // Second update with stale version fails
    await expect(
      adminCaller.plugin.tournaments.update({
        tournamentId: created.id,
        expectedVersion: created.version, // stale
        name: "Stale",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    })
  })

  // =========================================================================
  // Delete draft
  // =========================================================================

  it("deletes a draft tournament", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Delete Me",
      slug: "delete-me",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.deleteDraft({
      tournamentId: created.id,
    })

    await expect(
      adminCaller.plugin.tournaments.getById({
        tournamentId: created.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // =========================================================================
  // Registration
  // =========================================================================

  it("member can register and withdraw from tournament", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const memberCaller = buildCaller(memberUser, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Registration Test",
      slug: "reg-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    // Move to registration
    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    // Register
    const entry = await memberCaller.plugin.tournaments.registerSelf({
      tournamentId: t.id,
    })
    expect(entry.userId).toBe(memberUser.id)
    expect(entry.status).toBe("registered")

    // Withdraw
    const withdrawn = await memberCaller.plugin.tournaments.withdrawSelf({
      tournamentId: t.id,
    })
    expect(withdrawn.status).toBe("withdrawn")
  })

  it("rejects self registration for non-active activity members", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const outsider = await createTestUser("Tournament Outsider")
    userIds.push(outsider.id)
    await createTestMembership({ organizationId, userId: outsider.id, role: "member" })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Membership Gate",
      slug: "membership-gate",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    const outsiderCaller = buildCaller(outsider, organizationId)
    await expect(
      outsiderCaller.plugin.tournaments.registerSelf({
        tournamentId: t.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You must be an active member of this activity to register",
    })
  })

  it("rejects admin registration for non-active activity members", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const outsider = await createTestUser("Tournament Admin Outsider")
    userIds.push(outsider.id)
    await createTestMembership({ organizationId, userId: outsider.id, role: "member" })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Admin Membership Gate",
      slug: "admin-membership-gate",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    await expect(
      adminCaller.plugin.tournaments.adminRegister({
        tournamentId: t.id,
        userId: outsider.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "User is not an active member of this activity",
    })
  })

  // =========================================================================
  // Cross-org isolation
  // =========================================================================

  it("rejects access to tournament from another organization", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Isolated",
      slug: "isolated",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    // Create another org
    const otherOrg = await createTestOrganization("tourney-other")
    organizationIds.push(otherOrg.id)
    await createTestMembership({ organizationId: otherOrg.id, userId: admin.id, role: "admin" })

    const otherCaller = buildCaller(admin, otherOrg.id)

    await expect(
      otherCaller.plugin.tournaments.getById({ tournamentId: t.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // =========================================================================
  // Cancel
  // =========================================================================

  it("admin can cancel a tournament", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Cancel Me",
      slug: "cancel-me",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    const cancelled = await adminCaller.plugin.tournaments.cancel({
      tournamentId: t.id,
    })
    expect(cancelled.status).toBe("cancelled")
  })

  // =========================================================================
  // Registration idempotency
  // =========================================================================

  it("registration is idempotent", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const memberCaller = buildCaller(memberUser, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Idempotent Reg",
      slug: "idempotent-reg",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    const first = await memberCaller.plugin.tournaments.registerSelf({
      tournamentId: t.id,
    })

    const second = await memberCaller.plugin.tournaments.registerSelf({
      tournamentId: t.id,
    })

    expect(first.id).toBe(second.id)
  })

  // =========================================================================
  // Registration capacity
  // =========================================================================

  it("rejects registration when tournament is full", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Full Tournament",
      slug: "full-tournament",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
      config: { maxCapacity: 2 },
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    // Register 2 participants (admin + member fill slots)
    await adminCaller.plugin.tournaments.adminRegister({
      tournamentId: t.id,
      userId: admin.id,
    })
    await adminCaller.plugin.tournaments.adminRegister({
      tournamentId: t.id,
      userId: owner.id,
    })

    // Third registration should fail
    const memberCaller = buildCaller(memberUser, organizationId)
    await expect(
      memberCaller.plugin.tournaments.registerSelf({
        tournamentId: t.id,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    })
  })

  // =========================================================================
  // Public visibility filtering
  // =========================================================================

  it("public list only shows public non-draft tournaments", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    // Create a public tournament in registration
    const pub = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Public Cup",
      slug: "public-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })
    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: pub.id,
      status: "registration",
    })

    // Create a draft (should not show)
    await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Draft Cup",
      slug: "draft-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    // Create an org_members tournament (should not show in public)
    const org = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Org Cup",
      slug: "org-cup",
      format: "single_elimination",
      visibility: "org_members",
      participantType: "individual",
      seedingMethod: "manual",
    })
    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: org.id,
      status: "registration",
    })

    // Public list should only show public + non-draft
    const publicList = await adminCaller.plugin.tournaments.publicListByActivity({
      activityId,
      limit: 20,
      offset: 0,
    })

    expect(publicList).toHaveLength(1)
    expect(publicList[0].name).toBe("Public Cup")
  })

  // =========================================================================
  // Public getById visibility check
  // =========================================================================

  it("public getById rejects draft tournaments", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Draft Only",
      slug: "draft-only",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await expect(
      adminCaller.plugin.tournaments.publicGetById({
        activityId,
        tournamentId: t.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("public bracket rejects non-public tournaments", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Private Bracket",
      slug: "private-bracket",
      format: "single_elimination",
      visibility: "org_members",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    await expect(
      adminCaller.plugin.tournaments.publicGetBracket({
        activityId,
        tournamentId: t.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("public standings reject non-public tournaments", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Private Standings",
      slug: "private-standings",
      format: "round_robin",
      visibility: "org_members",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    await expect(
      adminCaller.plugin.tournaments.publicGetStandings({
        activityId,
        tournamentId: t.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("public list hides tournaments when tournaments plugin is disabled", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const ownerCaller = buildCaller(owner, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Hidden Public Cup",
      slug: "hidden-public-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    await ownerCaller.activity.togglePlugin({
      activityId,
      pluginId: "tournaments",
      enabled: false,
    })

    const publicList = await adminCaller.plugin.tournaments.publicListByActivity({
      activityId,
      limit: 20,
      offset: 0,
    })

    expect(publicList).toEqual([])
  })

  it("public getById rejects tournaments from another activity", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const secondActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Second Tournament Activity",
      slug: `second-tourney-activity-${randomUUID().slice(0, 8)}`,
    })

    const ownerCaller = buildCaller(owner, organizationId)
    await ownerCaller.activity.togglePlugin({
      activityId: secondActivity.id,
      pluginId: "tournaments",
      enabled: true,
    })

    const t = await adminCaller.plugin.tournaments.create({
      activityId: secondActivity.id,
      name: "Other Activity Cup",
      slug: "other-activity-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    await expect(
      adminCaller.plugin.tournaments.publicGetById({
        activityId,
        tournamentId: t.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  // =========================================================================
  // Status transition validation
  // =========================================================================

  it("rejects invalid status transitions", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Bad Transition",
      slug: "bad-transition",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    // Cannot go from draft directly to check_in
    await expect(
      adminCaller.plugin.tournaments.updateStatus({
        tournamentId: t.id,
        status: "check_in",
      })
    ).rejects.toThrow()
  })

  // =========================================================================
  // Start tournament lifecycle
  // =========================================================================

  it("starts a seeded single elimination tournament", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    // Create 4 users and register them
    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`Player ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Lifecycle Test",
      slug: "lifecycle-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    // Move to registration
    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    // Register all players
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({
        tournamentId: t.id,
        userId: p.id,
      })
    }

    // Get participants
    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })
    expect(entries).toHaveLength(4)

    // Seed players — need current version after status change
    const currentT = await adminCaller.plugin.tournaments.getById({
      tournamentId: t.id,
    })
    const seeds = entries.map((e, i) => ({
      entryId: e.id,
      seed: i + 1,
    }))
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds,
    })

    // Start tournament
    const started = await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "in_progress",
    })

    expect(started.status).toBe("in_progress")

    // Verify bracket was generated
    const bracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: t.id,
    })
    expect(bracket.stages.length).toBeGreaterThan(0)

    // Verify matches exist
    const matches = await adminCaller.plugin.tournaments.getMatches({
      tournamentId: t.id,
      limit: 50,
      offset: 0,
    })
    // 4 players single elimination = 3 matches
    expect(matches).toHaveLength(3)
  })

  it("starts a double elimination tournament with loser bracket edges", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const { bracket } = await createStartedTournamentForFormat({
      adminCaller,
      format: "double_elimination",
      participantCount: 4,
      slug: "double-elimination-start",
      name: "Double Elimination Start",
    })

    expect(bracket.stages).toHaveLength(1)
    expect(bracket.stages[0].stageType).toBe("double_elimination")
    expect(bracket.matches.length).toBeGreaterThanOrEqual(4)
    expect(bracket.edges.some((edge) => edge.outcomeType === "loser")).toBe(true)
  })

  it("starts a round robin tournament and initializes standings", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const { tournament, bracket } = await createStartedTournamentForFormat({
      adminCaller,
      format: "round_robin",
      participantCount: 4,
      slug: "round-robin-start",
      name: "Round Robin Start",
    })

    expect(bracket.stages).toHaveLength(1)
    expect(bracket.stages[0].stageType).toBe("round_robin")

    const standings = await adminCaller.plugin.tournaments.getStandings({
      tournamentId: tournament.id,
    })

    expect(standings).toHaveLength(4)
    expect(standings.every((standing) => standing.points === 0)).toBe(true)
    expect(standings.every((standing) => standing.rank === null)).toBe(true)
  })

  it("starts a swiss tournament and initializes standings", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const { tournament, bracket } = await createStartedTournamentForFormat({
      adminCaller,
      format: "swiss",
      participantCount: 4,
      slug: "swiss-start",
      name: "Swiss Start",
    })

    expect(bracket.stages).toHaveLength(1)
    expect(bracket.stages[0].stageType).toBe("swiss")
    expect(bracket.rounds).toHaveLength(1)

    const standings = await adminCaller.plugin.tournaments.getStandings({
      tournamentId: tournament.id,
    })

    expect(standings).toHaveLength(4)
    expect(standings.every((standing) => standing.points === 0)).toBe(true)
  })

  it("advances swiss to the next round after the current round completes", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const { tournament, bracket } = await createStartedTournamentForFormat({
      adminCaller,
      format: "swiss",
      participantCount: 4,
      slug: "swiss-advance",
      name: "Swiss Advance",
    })

    const firstRound = bracket.rounds.find((round) => round.roundNumber === 1)
    expect(firstRound).toBeDefined()

    const firstRoundMatches = bracket.matches.filter((match) => match.roundId === firstRound!.id)
    await reportMatchWinners(
      adminCaller,
      tournament.id,
      firstRoundMatches.map((match) => match.id)
    )

    const result = await adminCaller.plugin.tournaments.advanceSwissRound({
      tournamentId: tournament.id,
    })

    expect(result).toEqual({ roundNumber: 2, matchCount: 2 })

    const advancedBracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: tournament.id,
    })
    const secondRound = advancedBracket.rounds.find((round) => round.roundNumber === 2)
    expect(secondRound).toBeDefined()
    expect(
      advancedBracket.matches.filter((match) => match.roundId === secondRound!.id)
    ).toHaveLength(2)
  })

  it("starts a group knockout tournament with per-group standings", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const { tournament, bracket } = await createStartedTournamentForFormat({
      adminCaller,
      format: "group_knockout",
      participantCount: 8,
      slug: "group-knockout-start",
      name: "Group Knockout Start",
      config: {
        groupCount: 2,
        advancePerGroup: 1,
      },
    })

    expect(bracket.stages).toHaveLength(2)
    expect(bracket.stages.map((stage) => stage.stageType)).toEqual([
      "group",
      "single_elimination",
    ])
    expect(bracket.groups).toHaveLength(2)

    const groupStage = bracket.stages.find((stage) => stage.stageType === "group")
    expect(groupStage).toBeDefined()

    for (const group of bracket.groups) {
      const standings = await adminCaller.plugin.tournaments.getStandings({
        tournamentId: tournament.id,
        stageId: groupStage!.id,
        groupId: group.id,
      })

      expect(standings).toHaveLength(4)
    }
  })

  it("advances a completed group stage into a knockout bracket", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const { tournament, bracket } = await createStartedTournamentForFormat({
      adminCaller,
      format: "group_knockout",
      participantCount: 8,
      slug: "group-knockout-advance",
      name: "Group Knockout Advance",
      config: {
        groupCount: 2,
        advancePerGroup: 1,
      },
    })

    const groupStage = bracket.stages.find((stage) => stage.stageType === "group")
    expect(groupStage).toBeDefined()

    const groupRoundIds = bracket.rounds
      .filter((round) => round.stageId === groupStage!.id)
      .map((round) => round.id)
    const groupMatchIds = bracket.matches
      .filter((match) => groupRoundIds.includes(match.roundId))
      .map((match) => match.id)

    await reportMatchWinners(adminCaller, tournament.id, groupMatchIds)

    const result = await adminCaller.plugin.tournaments.advanceGroupStage({
      tournamentId: tournament.id,
    })

    expect(result.advancingCount).toBe(2)
    expect(result.stageId).toBeTruthy()

    const advancedBracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: tournament.id,
    })
    const knockoutStage = advancedBracket.stages.find(
      (stage) => stage.id === result.stageId
    )

    expect(knockoutStage?.stageType).toBe("single_elimination")
    expect(knockoutStage?.status).toBe("in_progress")
    expect(
      advancedBracket.matches.filter((match) =>
        advancedBracket.rounds
          .filter((round) => round.stageId === result.stageId)
          .some((round) => round.id === match.roundId)
      )
    ).toHaveLength(1)
  })

  it("starts a free-for-all tournament as a single match stage", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const { bracket } = await createStartedTournamentForFormat({
      adminCaller,
      format: "free_for_all",
      participantCount: 4,
      slug: "ffa-start",
      name: "Free For All Start",
    })

    expect(bracket.stages).toHaveLength(1)
    expect(bracket.stages[0].stageType).toBe("free_for_all")
    expect(bracket.rounds).toHaveLength(1)
    expect(bracket.matches).toHaveLength(1)
    expect(bracket.matchEntries).toHaveLength(4)
  })

  // =========================================================================
  // Randomize seeds
  // =========================================================================

  it("randomizes seeds for registered entries", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Random Seeds",
      slug: "random-seeds",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    // Register 4 players
    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`RandPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
      await adminCaller.plugin.tournaments.adminRegister({
        tournamentId: t.id,
        userId: p.id,
      })
    }

    const result = await adminCaller.plugin.tournaments.randomizeSeeds({
      tournamentId: t.id,
    })

    expect(result).toHaveLength(4)
    // All seeds should be assigned 1-4
    const seedValues = result.map((r) => r.seed).sort((a, b) => a - b)
    expect(seedValues).toEqual([1, 2, 3, 4])
  })

  it("re-randomizes already seeded entries without hitting unique seed conflicts", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Re-randomize Seeds",
      slug: "re-randomize-seeds",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "registration",
    })

    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`ReRandPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      await adminCaller.plugin.tournaments.adminRegister({
        tournamentId: t.id,
        userId: p.id,
      })
    }

    await adminCaller.plugin.tournaments.randomizeSeeds({
      tournamentId: t.id,
    })

    const result = await adminCaller.plugin.tournaments.randomizeSeeds({
      tournamentId: t.id,
    })

    expect(result).toHaveLength(4)
    const seedValues = result.map((r) => r.seed).sort((a, b) => a - b)
    expect(seedValues).toEqual([1, 2, 3, 4])
  })

  it("seeds entries from ranking order and leaves unranked entries last", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const rankedPlayers: User[] = []
    for (let i = 0; i < 4; i++) {
      const player = await createTestUser(`Ranked Player ${i}`)
      userIds.push(player.id)
      await createTestMembership({ organizationId, userId: player.id, role: "member" })
      await createTestActivityMember({ activityId, userId: player.id })
      rankedPlayers.push(player)
    }

    const ranking = await createRankingDefinition(organizationId, owner.id, {
      activityId,
      name: "Match Ranking",
      domainId: "badminton",
      levels: [
        { name: "Gold", order: 0, color: "#FFD700" },
        { name: "Silver", order: 1, color: "#C0C0C0" },
        { name: "Bronze", order: 2, color: "#CD7F32" },
      ],
    })

    await assignLevel(ranking.id, organizationId, rankedPlayers[1].id, ranking.levels[0].id)
    await assignLevel(ranking.id, organizationId, rankedPlayers[2].id, ranking.levels[1].id)
    await assignLevel(ranking.id, organizationId, rankedPlayers[0].id, ranking.levels[2].id)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Seed From Ranking",
      slug: "seed-from-ranking",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const player of rankedPlayers) {
      await adminCaller.plugin.tournaments.adminRegister({
        tournamentId: t.id,
        userId: player.id,
      })
    }

    await adminCaller.plugin.tournaments.seedFromRanking({
      tournamentId: t.id,
      rankingDefinitionId: ranking.id,
    })

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })

    expect(entries.map((entry) => entry.userId)).toEqual([
      rankedPlayers[1].id,
      rankedPlayers[2].id,
      rankedPlayers[0].id,
      rankedPlayers[3].id,
    ])
    expect(entries.map((entry) => entry.seed)).toEqual([1, 2, 3, 4])
  })

  // =========================================================================
  // Fix #1: Match lifecycle — score reporting works from pending
  // =========================================================================

  it("reports score on a pending match (auto-transitions through in_progress)", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    // Create 4 players, register, seed, start
    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`ScorePlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Score Test",
      slug: "score-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id, limit: 10, offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    // Get a match — it should be pending
    const matches = await adminCaller.plugin.tournaments.getMatches({
      tournamentId: t.id, limit: 50, offset: 0,
    })
    const pendingMatch = matches.find((m) => m.status === "pending")
    expect(pendingMatch).toBeDefined()

    // Report score — should work despite match being pending
    const result = await adminCaller.plugin.tournaments.reportScore({
      tournamentId: t.id,
      matchId: pendingMatch!.id,
      expectedVersion: pendingMatch!.version,
      scores: { home: 2, away: 1 },
      winnerEntryId: entries[0].id,
    })

    expect(result.status).toBe("completed")
  })

  it("rejects score reporting when winner is not in the match", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`InvalidWinnerPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Invalid Winner Test",
      slug: "invalid-winner-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    const bracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: t.id,
    })
    const pendingMatch = bracket.matches.find((m) => m.status === "pending")
    expect(pendingMatch).toBeDefined()

    const entryIdsInMatch = bracket.matchEntries
      .filter((me) => me.matchId === pendingMatch!.id)
      .map((me) => me.entryId)
    const invalidWinner = entries.find((entry) => !entryIdsInMatch.includes(entry.id))
    expect(invalidWinner).toBeDefined()

    await expect(
      adminCaller.plugin.tournaments.reportScore({
        tournamentId: t.id,
        matchId: pendingMatch!.id,
        expectedVersion: pendingMatch!.version,
        scores: { home: 2, away: 1 },
        winnerEntryId: invalidWinner!.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Winner entry is not a participant in this match",
    })
  })

  it("rejects stale match versions when reporting score", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`StaleScorePlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Stale Match Version Test",
      slug: "stale-match-version-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    const bracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: t.id,
    })
    const pendingMatch = bracket.matches.find((m) => m.status === "pending")
    expect(pendingMatch).toBeDefined()

    const matchEntryIds = bracket.matchEntries
      .filter((me) => me.matchId === pendingMatch!.id)
      .map((me) => me.entryId)
    const winnerEntryId = matchEntryIds[0]

    await adminCaller.plugin.tournaments.reportScore({
      tournamentId: t.id,
      matchId: pendingMatch!.id,
      expectedVersion: pendingMatch!.version,
      scores: { home: 2, away: 0 },
      winnerEntryId,
    })

    await expect(
      adminCaller.plugin.tournaments.reportScore({
        tournamentId: t.id,
        matchId: pendingMatch!.id,
        expectedVersion: pendingMatch!.version,
        scores: { home: 3, away: 0 },
        winnerEntryId,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
    })
  })

  // =========================================================================
  // Fix #1: Forfeit from pending
  // =========================================================================

  it("forfeits a pending match (auto-transitions through in_progress)", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`ForfeitPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Forfeit Test",
      slug: "forfeit-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id, limit: 10, offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    // Get bracket to find match entries
    const bracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: t.id,
    })
    const pendingMatch = bracket.matches.find((m) => m.status === "pending")
    expect(pendingMatch).toBeDefined()

    // Find an actual entry in this match
    const matchEntry = bracket.matchEntries.find(
      (me) => me.matchId === pendingMatch!.id
    )
    expect(matchEntry).toBeDefined()

    const result = await adminCaller.plugin.tournaments.forfeitMatch({
      tournamentId: t.id,
      matchId: pendingMatch!.id,
      forfeitEntryId: matchEntry!.entryId,
    })

    expect(result.status).toBe("forfeit")
  })

  it("removes a participant before the tournament starts", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 2; i++) {
      const p = await createTestUser(`RemovePlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Remove Participant Test",
      slug: "remove-participant-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entriesBefore = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })
    expect(entriesBefore).toHaveLength(2)

    await adminCaller.plugin.tournaments.adminRemoveParticipant({
      tournamentId: t.id,
      entryId: entriesBefore[0].id,
    })

    const entriesAfter = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })

    expect(entriesAfter).toHaveLength(1)
    expect(entriesAfter[0].id).toBe(entriesBefore[1].id)
  })

  // =========================================================================
  // Fix #4: Disqualify forfeits remaining matches
  // =========================================================================

  it("disqualifying a participant forfeits their remaining matches", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`DQPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "DQ Test",
      slug: "dq-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id, limit: 10, offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    // DQ the first entry
    const dqResult = await adminCaller.plugin.tournaments.disqualifyParticipant({
      tournamentId: t.id,
      entryId: entries[0].id,
    })
    expect(dqResult.status).toBe("disqualified")

    // Their match should now be forfeited
    const matches = await adminCaller.plugin.tournaments.getMatches({
      tournamentId: t.id, limit: 50, offset: 0,
    })
    const forfeitedMatch = matches.find(
      (m) => m.status === "forfeit" && m.winnerEntryId !== null
    )
    expect(forfeitedMatch).toBeDefined()
    // Winner should NOT be the DQ'd player
    expect(forfeitedMatch!.winnerEntryId).not.toBe(entries[0].id)
  })

  // =========================================================================
  // Fix #5: Team tournament — full lifecycle
  // =========================================================================

  it("team tournament: create teams, join, register, seed, start", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    // Create extra users for teams
    const teamPlayers: User[] = []
    for (let i = 0; i < 8; i++) {
      const p = await createTestUser(`TeamPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      teamPlayers.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Team Cup",
      slug: "team-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      seedingMethod: "manual",
      config: { minTeamSize: 2, maxTeamSize: 3 },
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    // Create 4 teams, 2 members each
    const teamIds: string[] = []
    for (let i = 0; i < 4; i++) {
      const team = await adminCaller.plugin.tournaments.createTeam({
        tournamentId: t.id,
        name: `Team ${i}`,
        captainUserId: teamPlayers[i * 2].id,
      })
      teamIds.push(team.id)

      // Second member joins via self-service
      const memberCaller = buildCaller(teamPlayers[i * 2 + 1], organizationId)
      await memberCaller.plugin.tournaments.joinTeam({
        tournamentId: t.id,
        teamId: team.id,
      })
    }

    // List teams
    const teams = await adminCaller.plugin.tournaments.listTeams({
      tournamentId: t.id,
    })
    expect(teams).toHaveLength(4)
    expect(teams[0].members).toHaveLength(2)

    // Register all teams
    for (const teamId of teamIds) {
      await adminCaller.plugin.tournaments.registerTeam({
        tournamentId: t.id,
        teamId,
      })
    }

    // Verify entries
    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id, limit: 10, offset: 0,
    })
    expect(entries).toHaveLength(4)
    expect(entries.every((e) => e.teamId !== null)).toBe(true)

    // Seed and start
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    const started = await adminCaller.plugin.tournaments.updateStatus({
      tournamentId: t.id,
      status: "in_progress",
    })
    expect(started.status).toBe("in_progress")

    // Verify matches were generated
    const matches = await adminCaller.plugin.tournaments.getMatches({
      tournamentId: t.id, limit: 50, offset: 0,
    })
    expect(matches).toHaveLength(3) // 4 teams single elim = 3 matches
  })

  it("creates tournament teams from a confirmed smart group run", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const ownerCaller = buildCaller(owner, organizationId)

    await ownerCaller.activity.togglePlugin({
      activityId,
      pluginId: "smart-groups",
      enabled: true,
    })

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const player = await createTestUser(`Smart Group Player ${i}`)
      userIds.push(player.id)
      await createTestMembership({ organizationId, userId: player.id, role: "member" })
      await createTestActivityMember({ activityId, userId: player.id })
      players.push(player)
    }

    const config = await createConfig(organizationId, owner.id, {
      activityId,
      name: "Balanced Team Builder",
    })

    const run = await db.transaction(async (tx) => {
      const createdRun = await createRunWithEntries(
        tx,
        {
          organizationId,
          smartGroupConfigId: config.id,
          scope: "activity",
          criteriaSnapshot: {
            mode: "balanced",
            balanceFields: [{ sourceId: "rating", weight: 1 }],
            teamCount: 2,
          },
          entryCount: 4,
          groupCount: 2,
          generatedBy: owner.id,
        },
        players.map((player) => ({
          userId: player.id,
          dataSnapshot: { _userName: player.name, rating: 10 },
        }))
      )

      await createProposals(tx, createdRun.id, [
        {
          groupIndex: 0,
          groupName: "Team A",
          memberIds: [players[0].id, players[1].id],
        },
        {
          groupIndex: 1,
          groupName: "Team B",
          memberIds: [players[2].id, players[3].id],
        },
      ])

      return createdRun
    })

    await confirmRun(run.id, organizationId, owner.id, run.version)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Smart Group Teams Cup",
      slug: "smart-group-teams-cup",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      config: { minTeamSize: 2, maxTeamSize: 2 },
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    const result = await adminCaller.plugin.tournaments.createTeamsFromSmartGroupRun({
      tournamentId: t.id,
      smartGroupRunId: run.id,
    })

    expect(result.created).toBe(2)
    expect(result.teams.map((team) => team.name)).toEqual(["Team A", "Team B"])

    const teams = await adminCaller.plugin.tournaments.listTeams({
      tournamentId: t.id,
    })
    expect(teams).toHaveLength(2)
    expect(teams[0].members).toHaveLength(2)
    expect(teams[1].members).toHaveLength(2)
    expect(teams[0].captainUserId).toBe(players[0].id)
    expect(teams[1].captainUserId).toBe(players[2].id)
  })

  it("rejects creating tournament teams from an unconfirmed smart group run", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const ownerCaller = buildCaller(owner, organizationId)

    await ownerCaller.activity.togglePlugin({
      activityId,
      pluginId: "smart-groups",
      enabled: true,
    })

    const players: User[] = []
    for (let i = 0; i < 2; i++) {
      const player = await createTestUser(`Draft Smart Group Player ${i}`)
      userIds.push(player.id)
      await createTestMembership({ organizationId, userId: player.id, role: "member" })
      await createTestActivityMember({ activityId, userId: player.id })
      players.push(player)
    }

    const config = await createConfig(organizationId, owner.id, {
      activityId,
      name: "Draft Team Builder",
    })

    const run = await db.transaction(async (tx) => {
      const createdRun = await createRunWithEntries(
        tx,
        {
          organizationId,
          smartGroupConfigId: config.id,
          scope: "activity",
          criteriaSnapshot: {
            mode: "balanced",
            balanceFields: [{ sourceId: "rating", weight: 1 }],
            teamCount: 1,
          },
          entryCount: 2,
          groupCount: 1,
          generatedBy: owner.id,
        },
        players.map((player) => ({
          userId: player.id,
          dataSnapshot: { _userName: player.name, rating: 10 },
        }))
      )

      await createProposals(tx, createdRun.id, [
        {
          groupIndex: 0,
          groupName: "Draft Team",
          memberIds: [players[0].id, players[1].id],
        },
      ])

      return createdRun
    })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Draft Smart Group Import",
      slug: "draft-smart-group-import",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      config: { minTeamSize: 2, maxTeamSize: 2 },
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    await expect(
      adminCaller.plugin.tournaments.createTeamsFromSmartGroupRun({
        tournamentId: t.id,
        smartGroupRunId: run.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Smart group run must be confirmed before creating teams",
    })
  })

  it("rejects team creation for non-active activity members", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const captain = await createTestUser("Inactive Captain")
    userIds.push(captain.id)
    await createTestMembership({ organizationId, userId: captain.id, role: "member" })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Inactive Captain Team Test",
      slug: "inactive-captain-team-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    await expect(
      adminCaller.plugin.tournaments.createTeam({
        tournamentId: t.id,
        name: "Inactive Captain Team",
        captainUserId: captain.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Selected member is not an active member of this activity",
    })
  })

  it("rejects joining a team for non-active activity members", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const captain = await createTestUser("Active Captain")
    const joiner = await createTestUser("Inactive Joiner")
    userIds.push(captain.id, joiner.id)
    await createTestMembership({ organizationId, userId: captain.id, role: "member" })
    await createTestMembership({ organizationId, userId: joiner.id, role: "member" })
    await createTestActivityMember({ activityId, userId: captain.id })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Inactive Joiner Team Test",
      slug: "inactive-joiner-team-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    const team = await adminCaller.plugin.tournaments.createTeam({
      tournamentId: t.id,
      name: "Existing Team",
      captainUserId: captain.id,
    })

    const joinerCaller = buildCaller(joiner, organizationId)
    await expect(
      joinerCaller.plugin.tournaments.joinTeam({
        tournamentId: t.id,
        teamId: team.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "You must be an active member of this activity to join a team",
    })
  })

  // =========================================================================
  // Fix #5: Team — individual registration blocked for team tournaments
  // =========================================================================

  it("rejects individual registration on a team tournament", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Team Only",
      slug: "team-only",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    const memberCaller = buildCaller(memberUser, organizationId)
    await expect(
      memberCaller.plugin.tournaments.registerSelf({ tournamentId: t.id })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This tournament requires team registration",
    })
  })

  // =========================================================================
  // Fix #5: Team — min team size validation
  // =========================================================================

  it("rejects team registration when team is below min size", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const captain = await createTestUser("MinSizeCaptain")
    userIds.push(captain.id)
    await createTestMembership({ organizationId, userId: captain.id, role: "member" })
    await createTestActivityMember({ activityId, userId: captain.id })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Min Size Test",
      slug: "min-size-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      seedingMethod: "manual",
      config: { minTeamSize: 3 },
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    // Create team with only captain (1 member)
    const team = await adminCaller.plugin.tournaments.createTeam({
      tournamentId: t.id,
      name: "Small Team",
      captainUserId: captain.id,
    })

    // Register should fail — only 1 member, need 3
    await expect(
      adminCaller.plugin.tournaments.registerTeam({
        tournamentId: t.id,
        teamId: team.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  // =========================================================================
  // Fix #5: Team — user can't be on multiple teams
  // =========================================================================

  it("rejects user joining multiple teams in same tournament", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const captainA = await createTestUser("CaptainA")
    const captainB = await createTestUser("CaptainB")
    const joiner = await createTestUser("Joiner")
    userIds.push(captainA.id, captainB.id, joiner.id)
    await createTestMembership({ organizationId, userId: captainA.id, role: "member" })
    await createTestMembership({ organizationId, userId: captainB.id, role: "member" })
    await createTestMembership({ organizationId, userId: joiner.id, role: "member" })
    await createTestActivityMember({ activityId, userId: captainA.id })
    await createTestActivityMember({ activityId, userId: captainB.id })
    await createTestActivityMember({ activityId, userId: joiner.id })

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Multi Team Test",
      slug: "multi-team-test",
      format: "single_elimination",
      visibility: "public",
      participantType: "team",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    const teamA = await adminCaller.plugin.tournaments.createTeam({
      tournamentId: t.id, name: "Team A", captainUserId: captainA.id,
    })
    const teamB = await adminCaller.plugin.tournaments.createTeam({
      tournamentId: t.id, name: "Team B", captainUserId: captainB.id,
    })

    // Joiner joins Team A
    const joinerCaller = buildCaller(joiner, organizationId)
    await joinerCaller.plugin.tournaments.joinTeam({
      tournamentId: t.id, teamId: teamA.id,
    })

    // Joiner tries to join Team B — should fail
    await expect(
      joinerCaller.plugin.tournaments.joinTeam({
        tournamentId: t.id, teamId: teamB.id,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "User is already on a team in this tournament",
    })
  })

  // =========================================================================
  // Fix #8: Public endpoints return limited fields
  // =========================================================================

  it("public endpoints exclude admin-only fields", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Public Fields Test",
      slug: "public-fields",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
      config: { maxCapacity: 16 },
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })

    const publicResult = await adminCaller.plugin.tournaments.publicGetById({
      activityId,
      tournamentId: t.id,
    })

    // Should have public fields
    expect(publicResult.id).toBe(t.id)
    expect(publicResult.name).toBe("Public Fields Test")
    expect(publicResult.format).toBe("single_elimination")
    expect(publicResult.status).toBe("registration")

    // Should NOT have admin-only fields
    expect((publicResult as Record<string, unknown>).config).toBeUndefined()
    expect((publicResult as Record<string, unknown>).version).toBeUndefined()
    expect((publicResult as Record<string, unknown>).seedingMethod).toBeUndefined()
    expect((publicResult as Record<string, unknown>).createdBy).toBeUndefined()
    expect((publicResult as Record<string, unknown>).organizationId).toBeUndefined()
  })

  it("public bracket returns redacted graph data with participant identities", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`PublicBracketPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Public Bracket Contract",
      slug: "public-bracket-contract",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    const bracket = await adminCaller.plugin.tournaments.publicGetBracket({
      activityId,
      tournamentId: t.id,
    })

    expect(bracket.entries).toHaveLength(4)
    expect(bracket.entries[0].participantName).toBeTypeOf("string")
    expect((bracket.stages[0] as Record<string, unknown>).organizationId).toBeUndefined()
    expect((bracket.stages[0] as Record<string, unknown>).config).toBeUndefined()
    expect((bracket.matches[0] as Record<string, unknown>).organizationId).toBeUndefined()
  })

  it("public standings return redacted standings with participant identities", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`PublicStandingsPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Public Standings Contract",
      slug: "public-standings-contract",
      format: "round_robin",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    const standings = await adminCaller.plugin.tournaments.publicGetStandings({
      activityId,
      tournamentId: t.id,
    })

    expect(standings.stage).not.toBeNull()
    expect(standings.entries).toHaveLength(4)
    expect(standings.standings).toHaveLength(4)
    expect((standings.stage as Record<string, unknown>).organizationId).toBeUndefined()
    expect((standings.standings[0] as Record<string, unknown>).organizationId).toBeUndefined()
  })

  it("public match returns participant identities without internal columns", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`PublicMatchPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Public Match Contract",
      slug: "public-match-contract",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id,
      limit: 10,
      offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    const matches = await adminCaller.plugin.tournaments.getMatches({
      tournamentId: t.id,
      limit: 50,
      offset: 0,
    })

    const publicMatch = await adminCaller.plugin.tournaments.publicGetMatch({
      activityId,
      tournamentId: t.id,
      matchId: matches[0].id,
    })

    expect(publicMatch.match.id).toBe(matches[0].id)
    expect(publicMatch.entries.length).toBeGreaterThan(0)
    expect((publicMatch.match as Record<string, unknown>).organizationId).toBeUndefined()
    expect((publicMatch.stage as Record<string, unknown>).config).toBeUndefined()
  })

  // =========================================================================
  // Fix #10: getBracket returns full graph
  // =========================================================================

  it("getBracket returns stages, rounds, matches, entries, and edges", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const players: User[] = []
    for (let i = 0; i < 4; i++) {
      const p = await createTestUser(`BracketPlayer ${i}`)
      userIds.push(p.id)
      await createTestMembership({ organizationId, userId: p.id, role: "member" })
      await createTestActivityMember({ activityId, userId: p.id })
      players.push(p)
    }

    const t = await adminCaller.plugin.tournaments.create({
      activityId,
      name: "Bracket Graph Test",
      slug: "bracket-graph",
      format: "single_elimination",
      visibility: "public",
      participantType: "individual",
      seedingMethod: "manual",
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "registration" })
    for (const p of players) {
      await adminCaller.plugin.tournaments.adminRegister({ tournamentId: t.id, userId: p.id })
    }

    const entries = await adminCaller.plugin.tournaments.getParticipants({
      tournamentId: t.id, limit: 10, offset: 0,
    })
    const currentT = await adminCaller.plugin.tournaments.getById({ tournamentId: t.id })
    await adminCaller.plugin.tournaments.setSeeds({
      tournamentId: t.id,
      expectedVersion: currentT.version,
      seeds: entries.map((e, i) => ({ entryId: e.id, seed: i + 1 })),
    })

    await adminCaller.plugin.tournaments.updateStatus({ tournamentId: t.id, status: "in_progress" })

    const bracket = await adminCaller.plugin.tournaments.getBracket({
      tournamentId: t.id,
    })

    // Full bracket graph should be returned
    expect(bracket.stages.length).toBeGreaterThan(0)
    expect(bracket.rounds.length).toBeGreaterThan(0)
    expect(bracket.matches.length).toBe(3) // 4 players = 3 matches
    expect(bracket.matchEntries.length).toBeGreaterThan(0) // entries placed in matches
    expect(bracket.edges.length).toBeGreaterThan(0) // winner edges connecting matches
  })
})

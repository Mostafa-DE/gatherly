import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import { eventSession, participation as participationTable } from "@/db/schema"
import type { Session, User } from "@/db/types"
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

describe("ranking router", () => {
  let organizationId = ""
  let activityId = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  async function createOrgMemberUser(name: string): Promise<User> {
    const user = await createTestUser(name)
    userIds.push(user.id)

    await createTestMembership({
      organizationId,
      userId: user.id,
      role: "member",
    })

    return user
  }

  async function createSessionForActivity(maxCapacity: number) {
    const adminCaller = buildCaller(admin, organizationId)

    return adminCaller.session.create({
      activityId,
      title: `Ranking Session ${randomUUID().slice(0, 8)}`,
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxCapacity,
      maxWaitlist: 0,
      joinMode: "open",
    })
  }

  beforeEach(async () => {
    const organization = await createTestOrganization("ranking-owner")
    const ownerUser = await createTestUser("Ranking Owner")
    const adminUser = await createTestUser("Ranking Admin")
    const member = await createTestUser("Ranking Member")

    organizationId = organization.id
    owner = ownerUser
    admin = adminUser
    memberUser = member

    organizationIds.push(organizationId)
    userIds.push(owner.id, admin.id, memberUser.id)

    await createTestMembership({
      organizationId,
      userId: owner.id,
      role: "owner",
    })
    await createTestMembership({
      organizationId,
      userId: admin.id,
      role: "admin",
    })
    await createTestMembership({
      organizationId,
      userId: memberUser.id,
      role: "member",
    })

    const activity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Ranking Activity",
      slug: `ranking-activity-${randomUUID().slice(0, 8)}`,
    })

    activityId = activity.id
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

  it("enforces admin/member guards for ranking mutations", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      memberCaller.plugin.ranking.create({
        activityId,
        name: "Padel Ladder",
        domainId: "padel",
        levels: [{ name: "Starter", color: null, order: 0 }],
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only admins can manage rankings",
    })

    const created = await adminCaller.plugin.ranking.create({
      activityId,
      name: "Padel Ladder",
      domainId: "padel",
      levels: [{ name: "Starter", color: null, order: 0 }],
    })

    expect(created.activityId).toBe(activityId)
    expect(created.domainId).toBe("padel")
  })

  it("rejects match recording when any player is not an active activity member", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const definition = await adminCaller.plugin.ranking.create({
      activityId,
      name: "Padel Ladder",
      domainId: "padel",
      levels: [{ name: "Starter", color: null, order: 0 }],
    })

    const session = await createSessionForActivity(4)
    const playerA = await createOrgMemberUser("Padel Player A")
    const playerB = await createOrgMemberUser("Padel Player B")
    const playerC = await createOrgMemberUser("Padel Player C")
    const playerD = await createOrgMemberUser("Padel Player D")

    await createTestActivityMember({ activityId, userId: playerA.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerB.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerC.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerD.id, status: "rejected" })

    await expect(
      adminCaller.plugin.ranking.recordMatch({
        rankingDefinitionId: definition.id,
        sessionId: session.id,
        matchFormat: "doubles",
        team1: [playerA.id, playerB.id],
        team2: [playerC.id, playerD.id],
        scores: [
          [6, 4],
          [6, 3],
        ],
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Some users are not active members of this activity",
    })
  })

  it("rejects unsupported match formats", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const definition = await adminCaller.plugin.ranking.create({
      activityId,
      name: "Padel Ladder",
      domainId: "padel",
      levels: [{ name: "Starter", color: null, order: 0 }],
    })

    const session = await createSessionForActivity(4)
    const playerA = await createOrgMemberUser("Format Player A")
    const playerB = await createOrgMemberUser("Format Player B")
    const playerC = await createOrgMemberUser("Format Player C")
    const playerD = await createOrgMemberUser("Format Player D")

    await createTestActivityMember({ activityId, userId: playerA.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerB.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerC.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerD.id, status: "active" })

    await expect(
      adminCaller.plugin.ranking.recordMatch({
        rankingDefinitionId: definition.id,
        sessionId: session.id,
        matchFormat: "triples",
        team1: [playerA.id, playerB.id],
        team2: [playerC.id, playerD.id],
        scores: [
          [6, 4],
          [6, 3],
        ],
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unsupported match format: triples",
    })
  })

  it("validates exact team sizes for fixed formats", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const definition = await adminCaller.plugin.ranking.create({
      activityId,
      name: "Padel Ladder",
      domainId: "padel",
      levels: [{ name: "Starter", color: null, order: 0 }],
    })

    const session = await createSessionForActivity(4)
    const playerA = await createOrgMemberUser("Size Player A")
    const playerB = await createOrgMemberUser("Size Player B")
    const playerC = await createOrgMemberUser("Size Player C")

    await createTestActivityMember({ activityId, userId: playerA.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerB.id, status: "active" })
    await createTestActivityMember({ activityId, userId: playerC.id, status: "active" })

    await expect(
      adminCaller.plugin.ranking.recordMatch({
        rankingDefinitionId: definition.id,
        sessionId: session.id,
        matchFormat: "doubles",
        team1: [playerA.id],
        team2: [playerB.id, playerC.id],
        scores: [
          [6, 4],
          [6, 3],
        ],
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Team 1 must have 2 player(s) for doubles",
    })
  })

  it("validates min/max team sizes for ranged formats", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const definition = await adminCaller.plugin.ranking.create({
      activityId,
      name: "Laser Tag Ladder",
      domainId: "laser-tag",
      levels: [{ name: "Starter", color: null, order: 0 }],
    })

    const session = await createSessionForActivity(2)

    const players: User[] = []
    for (let i = 1; i <= 15; i++) {
      const player = await createOrgMemberUser(`Laser Player ${i}`)
      players.push(player)
      await createTestActivityMember({ activityId, userId: player.id, status: "active" })
    }

    const minBoundaryResult = await adminCaller.plugin.ranking.recordMatch({
      rankingDefinitionId: definition.id,
      sessionId: session.id,
      matchFormat: "team",
      team1: [players[0].id],
      team2: [players[1].id],
      scores: { team1: 12, team2: 8 },
    })

    expect(minBoundaryResult.match.matchFormat).toBe("team")

    await expect(
      adminCaller.plugin.ranking.recordMatch({
        rankingDefinitionId: definition.id,
        sessionId: session.id,
        matchFormat: "team",
        team1: players.slice(0, 14).map((player) => player.id),
        team2: [players[14].id],
        scores: { team1: 20, team2: 18 },
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Team 1 must have 1-13 player(s) for team",
    })
  })

  it("scopes updateSessionAttributes to the active organization", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    const [localSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Local Ranking Session",
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxCapacity: 20,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: owner.id,
      })
      .returning()

    const [localParticipation] = await db
      .insert(participationTable)
      .values({
        sessionId: localSession.id,
        userId: memberUser.id,
        status: "joined",
      })
      .returning()

    const updated = await memberCaller.plugin.ranking.updateSessionAttributes({
      participationId: localParticipation.id,
      attributeOverrides: { dominant_side: "Left" },
    })

    expect(updated.id).toBe(localParticipation.id)
    expect(updated.attributeOverrides).toEqual({ dominant_side: "Left" })

    const otherOrg = await createTestOrganization("ranking-foreign-org")
    organizationIds.push(otherOrg.id)

    const otherActivity = await createTestActivity({
      organizationId: otherOrg.id,
      createdBy: owner.id,
      name: "Foreign Ranking Activity",
      slug: `foreign-ranking-${randomUUID().slice(0, 8)}`,
    })

    const [foreignSession] = await db
      .insert(eventSession)
      .values({
        organizationId: otherOrg.id,
        activityId: otherActivity.id,
        title: "Foreign Ranking Session",
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxCapacity: 20,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: owner.id,
      })
      .returning()

    const [foreignParticipation] = await db
      .insert(participationTable)
      .values({
        sessionId: foreignSession.id,
        userId: memberUser.id,
        status: "joined",
      })
      .returning()

    await expect(
      memberCaller.plugin.ranking.updateSessionAttributes({
        participationId: foreignParticipation.id,
        attributeOverrides: { dominant_side: "Right" },
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Participation not found",
    })
  })
})

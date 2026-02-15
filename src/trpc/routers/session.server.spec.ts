import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Session, User } from "@/db/types"
import { db } from "@/db"
import { participation } from "@/db/schema"
import {
  cleanupTestData,
  createTestActivity,
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

describe("session router", () => {
  let organizationId = ""
  let activityId = ""
  let owner!: User
  let admin!: User
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

  async function createRankingDefinition(domainId: string) {
    const adminCaller = buildCaller(admin, organizationId)

    return adminCaller.plugin.ranking.create({
      activityId,
      name: `${domainId} Ladder`,
      domainId,
      levels: [{ name: "Starter", color: null, order: 0 }],
    })
  }

  async function createSession(input: { title: string; dateTime: Date; maxCapacity?: number }) {
    const adminCaller = buildCaller(admin, organizationId)

    return adminCaller.session.create({
      activityId,
      title: input.title,
      dateTime: input.dateTime,
      maxCapacity: input.maxCapacity ?? 10,
      maxWaitlist: 0,
      joinMode: "open",
    })
  }

  beforeEach(async () => {
    const organization = await createTestOrganization("session-owner")
    const ownerUser = await createTestUser("Session Owner")
    const adminUser = await createTestUser("Session Admin")

    organizationId = organization.id
    owner = ownerUser
    admin = adminUser

    organizationIds.push(organizationId)
    userIds.push(owner.id, admin.id)

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

    const activity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Session Activity",
      slug: `session-activity-${randomUUID().slice(0, 8)}`,
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

  it("rejects invalid match-mode capacities on create", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await createRankingDefinition("padel")

    await expect(
      adminCaller.session.create({
        activityId,
        title: "Invalid Capacity Session",
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxCapacity: 3,
        maxWaitlist: 0,
        joinMode: "open",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid capacity for Padel match session. Valid capacities: singles (2), doubles (4)",
    })
  })

  it("rejects invalid match-mode capacities on update", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await createRankingDefinition("padel")

    const session = await createSession({
      title: "Padel Session",
      dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      maxCapacity: 4,
    })

    await expect(
      adminCaller.session.update({
        sessionId: session.id,
        maxCapacity: 3,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invalid capacity for Padel match session. Valid capacities: singles (2), doubles (4)",
    })
  })

  it("rejects date/time updates that create participant conflicts", async () => {
    const adminCaller = buildCaller(admin, organizationId)
    const conflictedMember = await createOrgMemberUser("Conflicted Member")

    const dateTimeA = new Date(Date.now() + 24 * 60 * 60 * 1000)
    dateTimeA.setMilliseconds(0)

    const dateTimeB = new Date(Date.now() + 48 * 60 * 60 * 1000)
    dateTimeB.setMilliseconds(0)

    const sessionA = await createSession({
      title: "Session A",
      dateTime: dateTimeA,
    })

    const sessionB = await createSession({
      title: "Session B",
      dateTime: dateTimeB,
    })

    await db.insert(participation).values([
      {
        sessionId: sessionA.id,
        userId: conflictedMember.id,
        status: "joined",
      },
      {
        sessionId: sessionB.id,
        userId: conflictedMember.id,
        status: "joined",
      },
    ])

    await expect(
      adminCaller.session.update({
        sessionId: sessionA.id,
        dateTime: dateTimeB,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining(
        "Cannot change session time: 1 participant(s) have conflicting sessions at that time"
      ),
    })

    await expect(
      adminCaller.session.update({
        sessionId: sessionA.id,
        dateTime: dateTimeB,
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining("Conflicted Member"),
    })
  })
})

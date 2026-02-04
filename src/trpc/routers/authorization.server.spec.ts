import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import { eventSession } from "@/db/schema"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"

function buildCaller(user: User, organizationId: string) {
  const authSession: Session = {
    id: `sess_${randomUUID().replaceAll("-", "")}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    token: `token_${randomUUID().replaceAll("-", "")}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
    userId: user.id,
    activeOrganizationId: organizationId,
  }

  return appRouter.createCaller(createTRPCContext({ user, session: authSession }))
}

describe("owner-only router authorization", () => {
  let organizationId = ""
  let owner!: User
  let admin!: User
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization()
    const createdOwner = await createTestUser("Owner")
    const createdAdmin = await createTestUser("Admin")

    organizationId = organization.id
    owner = createdOwner
    admin = createdAdmin
    userIds.push(createdOwner.id, createdAdmin.id)

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
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData({
        organizationIds: [organizationId],
        userIds,
      })
    }

    organizationId = ""
    userIds.length = 0
  })

  it("blocks admin from creating sessions", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.session.create({
        title: "Restricted Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 10,
        maxWaitlist: 2,
        joinMode: "open",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("allows owner to create sessions", async () => {
    const ownerCaller = buildCaller(owner, organizationId)

    const createdSession = await ownerCaller.session.create({
      title: "Owner Session",
      dateTime: new Date(Date.now() + 60 * 60 * 1000),
      maxCapacity: 10,
      maxWaitlist: 2,
      joinMode: "open",
    })

    expect(createdSession.status).toBe("draft")
    expect(createdSession.organizationId).toBe(organizationId)
  })

  it("allows admin to view session roster", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        title: "Roster Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 5,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: owner.id,
      })
      .returning()

    const adminCaller = buildCaller(admin, organizationId)

    const roster = await adminCaller.participation.roster({
      sessionId: session.id,
      limit: 20,
      offset: 0,
    })

    expect(Array.isArray(roster)).toBe(true)
  })
})

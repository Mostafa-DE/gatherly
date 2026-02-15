import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { organizationSettings } from "@/db/schema"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
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

describe("organization settings router", () => {
  let organizationId = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const createdOrganization = await createTestOrganization("org-settings-owner")
    const createdOwner = await createTestUser("Org Settings Owner")
    const createdAdmin = await createTestUser("Org Settings Admin")
    const createdMember = await createTestUser("Org Settings Member")

    organizationId = createdOrganization.id
    owner = createdOwner
    admin = createdAdmin
    memberUser = createdMember

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
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({
        organizationIds,
        userIds,
      })
    }

    organizationId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("get auto-creates default organization settings", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const before = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1)
    expect(before[0]).toBeUndefined()

    const result = await adminCaller.organizationSettings.get({})

    expect(result.organizationId).toBe(organizationId)
    expect(result.joinFormSchema).toBeNull()
    expect(result.joinFormVersion).toBe(1)
    expect(result.currency).toBeNull()
    expect(result.enabledPlugins).toEqual({})

    const after = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1)

    expect(after[0]?.organizationId).toBe(organizationId)
    expect(after[0]?.joinFormSchema).toBeNull()
    expect(after[0]?.joinFormVersion).toBe(1)
  })

  it("updateJoinForm blocks non-admin members", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.organizationSettings.updateJoinForm({
        joinFormSchema: {
          fields: [
            {
              id: "experience",
              type: "text",
              label: "Experience",
              required: true,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization admins can perform this action",
    })
  })

  it("updateJoinForm increments version for each update by admin", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const defaults = await adminCaller.organizationSettings.get({})
    expect(defaults.joinFormVersion).toBe(1)

    const firstSchema = {
      fields: [
        {
          id: "skill-level",
          type: "select" as const,
          label: "Skill level",
          required: true,
          options: ["Beginner", "Intermediate", "Advanced"],
        },
      ],
    }

    const firstUpdate = await adminCaller.organizationSettings.updateJoinForm({
      joinFormSchema: firstSchema,
    })

    expect(firstUpdate.joinFormVersion).toBe(2)
    expect(firstUpdate.joinFormSchema).toEqual(firstSchema)

    const secondUpdate = await adminCaller.organizationSettings.updateJoinForm({
      joinFormSchema: null,
    })

    expect(secondUpdate.joinFormVersion).toBe(3)
    expect(secondUpdate.joinFormSchema).toBeNull()
  })

  it("updateCurrency blocks non-admin members", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.organizationSettings.updateCurrency({
        currency: "EUR",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization admins can perform this action",
    })
  })

  it("updateCurrency allows admin to set and clear currency with null", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const updated = await adminCaller.organizationSettings.updateCurrency({
      currency: "EUR",
    })
    expect(updated.currency).toBe("EUR")

    const cleared = await adminCaller.organizationSettings.updateCurrency({
      currency: null,
    })
    expect(cleared.currency).toBeNull()

    const stored = await db
      .select({ currency: organizationSettings.currency })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, organizationId))
      .limit(1)

    expect(stored[0]?.currency).toBeNull()
  })

  it("togglePlugin rejects unknown plugins", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.organizationSettings.togglePlugin({
        pluginId: "does-not-exist",
        enabled: true,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unknown plugin: does-not-exist",
    })
  })

  it("togglePlugin rejects always-enabled plugins", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.organizationSettings.togglePlugin({
        pluginId: "analytics",
        enabled: false,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Analytics is a core capability and is always enabled for every group.",
    })
  })

  it("togglePlugin persists successful enable/disable updates", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const enabled = await adminCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: true,
    })
    expect((enabled.enabledPlugins as Record<string, boolean>).ai).toBe(true)

    const disabled = await adminCaller.organizationSettings.togglePlugin({
      pluginId: "ai",
      enabled: false,
    })
    expect((disabled.enabledPlugins as Record<string, boolean>).ai).toBe(false)
  })
})

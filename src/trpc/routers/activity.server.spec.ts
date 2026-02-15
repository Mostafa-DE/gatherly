import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestActivity,
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

describe("activity router", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let testActivityId = ""
  let testActivitySlug = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const org = await createTestOrganization("activity-owner")
    const otherOrg = await createTestOrganization("activity-other-owner")
    const ownerUser = await createTestUser("Activity Owner")
    const adminUser = await createTestUser("Activity Admin")
    const member = await createTestUser("Activity Member")

    organizationId = org.id
    otherOrganizationId = otherOrg.id
    owner = ownerUser
    admin = adminUser
    memberUser = member

    organizationIds.push(organizationId, otherOrganizationId)
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
    await createTestMembership({
      organizationId: otherOrganizationId,
      userId: owner.id,
      role: "owner",
    })

    const testActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Default Activity",
      slug: "default-activity",
    })
    testActivityId = testActivity.id
    testActivitySlug = testActivity.slug
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({
        organizationIds,
        userIds,
      })
    }

    organizationId = ""
    otherOrganizationId = ""
    testActivityId = ""
    testActivitySlug = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  describe("CRUD operations", () => {
    it("admin can create an activity", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      const created = await adminCaller.activity.create({
        name: "Yoga Class",
        slug: "yoga-class",
        joinMode: "open",
      })

      expect(created.name).toBe("Yoga Class")
      expect(created.slug).toBe("yoga-class")
      expect(created.joinMode).toBe("open")
      expect(created.organizationId).toBe(organizationId)
    })

    it("admin can update activity name", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      const updated = await adminCaller.activity.update({
        activityId: testActivityId,
        name: "Updated Activity",
      })

      expect(updated).not.toBeNull()
      expect(updated!.name).toBe("Updated Activity")
      // slug and joinMode remain unchanged
      expect(updated!.slug).toBe("default-activity")
      expect(updated!.joinMode).toBe("open")
    })

    it("admin can update activity joinMode", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      const updated = await adminCaller.activity.update({
        activityId: testActivityId,
        joinMode: "require_approval",
      })

      expect(updated).not.toBeNull()
      expect(updated!.joinMode).toBe("require_approval")
      // name and slug remain unchanged
      expect(updated!.name).toBe("Default Activity")
      expect(updated!.slug).toBe("default-activity")
    })

    it("admin can list activities", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      const activities = await adminCaller.activity.list({
        limit: 50,
        offset: 0,
      })

      expect(Array.isArray(activities)).toBe(true)
      expect(activities.length).toBeGreaterThanOrEqual(1)
      expect(activities.some((a) => a.id === testActivityId)).toBe(true)
    })

    it("admin can get activity by slug", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      const found = await adminCaller.activity.getBySlug({
        slug: testActivitySlug,
      })

      expect(found).not.toBeNull()
      expect(found!.id).toBe(testActivityId)
      expect(found!.slug).toBe(testActivitySlug)
    })
  })

  // ---------------------------------------------------------------------------
  // Deactivate / Reactivate
  // ---------------------------------------------------------------------------

  describe("deactivate / reactivate", () => {
    it("admin can deactivate an activity", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      // Create a second activity so we can deactivate the first one
      await adminCaller.activity.create({
        name: "Second Activity",
        slug: "second-activity",
        joinMode: "open",
      })

      const result = await adminCaller.activity.deactivate({
        activityId: testActivityId,
      })

      expect(result).not.toBeNull()
      expect(result!.isActive).toBe(false)

      // Activity still exists (not deleted)
      const found = await adminCaller.activity.getBySlug({
        slug: testActivitySlug,
      })
      expect(found).not.toBeNull()
      expect(found!.isActive).toBe(false)
    })

    it("admin can reactivate a deactivated activity", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      // Create second, deactivate first
      await adminCaller.activity.create({
        name: "Second Activity",
        slug: "second-activity",
        joinMode: "open",
      })
      await adminCaller.activity.deactivate({ activityId: testActivityId })

      const result = await adminCaller.activity.reactivate({
        activityId: testActivityId,
      })

      expect(result).not.toBeNull()
      expect(result!.isActive).toBe(true)
    })

    it("cannot deactivate the last active activity", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      await expect(
        adminCaller.activity.deactivate({
          activityId: testActivityId,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Cannot deactivate the last active activity in an organization",
      })
    })

    it("deactivated activities are hidden from list by default", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      const second = await adminCaller.activity.create({
        name: "Second Activity",
        slug: "second-activity",
        joinMode: "open",
      })

      await adminCaller.activity.deactivate({ activityId: testActivityId })

      // Default list hides inactive
      const defaultList = await adminCaller.activity.list({ limit: 50, offset: 0 })
      expect(defaultList.some((a) => a.id === testActivityId)).toBe(false)
      expect(defaultList.some((a) => a.id === second.id)).toBe(true)

      // With includeInactive, shows all
      const fullList = await adminCaller.activity.list({ limit: 50, offset: 0, includeInactive: true })
      expect(fullList.some((a) => a.id === testActivityId)).toBe(true)
    })

    it("member cannot deactivate activity", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)

      await expect(
        memberCaller.activity.deactivate({
          activityId: testActivityId,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  // ---------------------------------------------------------------------------
  // Activity plugins
  // ---------------------------------------------------------------------------

  describe("togglePlugin", () => {
    it("admin can enable an activity-scoped plugin", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      const enabled = await adminCaller.activity.togglePlugin({
        activityId: testActivityId,
        pluginId: "ranking",
        enabled: true,
      })
      expect((enabled!.enabledPlugins as Record<string, boolean>).ranking).toBe(true)
    })

    it("admin cannot disable ranking once enabled", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      // Ensure ranking is enabled first
      await adminCaller.activity.togglePlugin({
        activityId: testActivityId,
        pluginId: "ranking",
        enabled: true,
      })

      await expect(
        adminCaller.activity.togglePlugin({
          activityId: testActivityId,
          pluginId: "ranking",
          enabled: false,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("member cannot toggle activity plugin", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)

      await expect(
        memberCaller.activity.togglePlugin({
          activityId: testActivityId,
          pluginId: "ranking",
          enabled: true,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("rejects toggling unknown activity plugin ids", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      await expect(
        adminCaller.activity.togglePlugin({
          activityId: testActivityId,
          pluginId: "does-not-exist",
          enabled: true,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Unknown plugin: does-not-exist",
      })
    })

    it("rejects toggling org-scoped plugins from the activity router", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      await expect(
        adminCaller.activity.togglePlugin({
          activityId: testActivityId,
          pluginId: "ai",
          enabled: true,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: 'Plugin "AI Assistant" is not an activity-scoped plugin',
      })
    })

    it("rejects disabling always-enabled activity plugins", async () => {
      const ownerCaller = buildCaller(owner, organizationId)

      await expect(
        ownerCaller.activity.togglePlugin({
          activityId: testActivityId,
          pluginId: "analytics",
          enabled: false,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Analytics is a core capability and is always enabled for every group.",
      })
    })
  })

  // ---------------------------------------------------------------------------
  // Admin enforcement
  // ---------------------------------------------------------------------------

  describe("admin enforcement", () => {
    it("regular member cannot create activity", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)

      await expect(
        memberCaller.activity.create({
          name: "Unauthorized Activity",
          slug: "unauthorized-activity",
          joinMode: "open",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("regular member cannot update activity", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)

      await expect(
        memberCaller.activity.update({
          activityId: testActivityId,
          name: "Should Fail",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  // ---------------------------------------------------------------------------
  // Org isolation
  // ---------------------------------------------------------------------------

  describe("org isolation", () => {
    it("cannot access activity from a different org", async () => {
      const otherOrgCaller = buildCaller(owner, otherOrganizationId)

      const result = await otherOrgCaller.activity.getBySlug({
        slug: testActivitySlug,
      })

      // Activity belongs to organizationId, caller is scoped to otherOrganizationId
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Slug uniqueness
  // ---------------------------------------------------------------------------

  describe("slug uniqueness", () => {
    it("creating two activities with same slug in same org fails with CONFLICT", async () => {
      const adminCaller = buildCaller(admin, organizationId)

      await expect(
        adminCaller.activity.create({
          name: "Duplicate Slug Activity",
          slug: testActivitySlug,
          joinMode: "open",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })
  })
})

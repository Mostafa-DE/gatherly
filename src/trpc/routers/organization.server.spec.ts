import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { and, eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { member, organization } from "@/db/auth-schema"
import { eventSession, organizationSettings } from "@/db/schema"
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

describe("organization router", () => {
  let orgId = ""
  let otherOrgId = ""
  const ownerUsername = "public-owner"
  let groupSlug = ""
  let ownerUser!: User
  let adminUser!: User
  let memberUser!: User
  let externalUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

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

  beforeEach(async () => {
    const org = await createTestOrganization(ownerUsername)
    const otherOrg = await createTestOrganization("other-owner")
    const owner = await createTestUser("Owner")
    const admin = await createTestUser("Admin")
    const member = await createTestUser("Member")
    const external = await createTestUser("External")

    orgId = org.id
    otherOrgId = otherOrg.id
    groupSlug = org.userSlug
    ownerUser = owner
    adminUser = admin
    memberUser = member
    externalUser = external

    organizationIds.push(orgId, otherOrgId)
    userIds.push(owner.id, admin.id, member.id, external.id)

    await createTestMembership({
      organizationId: orgId,
      userId: owner.id,
      role: "owner",
    })
    await createTestMembership({
      organizationId: orgId,
      userId: admin.id,
      role: "admin",
    })
    await createTestMembership({
      organizationId: orgId,
      userId: member.id,
      role: "member",
    })
    await createTestMembership({
      organizationId: otherOrgId,
      userId: external.id,
      role: "member",
    })
  })

  afterEach(async () => {
    vi.restoreAllMocks()

    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({
        organizationIds,
        userIds,
      })
    }

    orgId = ""
    otherOrgId = ""
    groupSlug = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("returns public org info with scoped member count", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    const result = await publicCaller.organization.getPublicInfo({
      username: ownerUsername,
      groupSlug,
    })

    expect(result.id).toBe(orgId)
    expect(result.memberCount).toBe(3)
  })

  it("returns not found for getPublicInfo when organization is missing", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    await expect(
      publicCaller.organization.getPublicInfo({
        username: "missing-user",
        groupSlug: "missing-group",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Organization not found",
    })
  })

  it("blocks non-admin users from listMembers", async () => {
    const memberCaller = buildCaller(memberUser, orgId)
    const adminCaller = buildCaller(adminUser, orgId)

    await expect(memberCaller.organization.listMembers()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization admins can perform this action",
    })

    const members = await adminCaller.organization.listMembers()
    expect(members).toHaveLength(3)
  })

  it("returns null join form schema by default", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    const result = await publicCaller.organization.getJoinFormSchema({
      organizationId: orgId,
    })

    expect(result).toEqual({
      joinFormSchema: null,
    })
  })

  it("returns non-null join form schema when organization settings define one", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))
    const joinFormSchema = {
      fields: [
        {
          id: "experience",
          type: "text",
          label: "Experience",
          required: true,
        },
      ],
    }

    await db.insert(organizationSettings).values({
      organizationId: orgId,
      joinFormSchema,
      joinFormVersion: 1,
    })

    const result = await publicCaller.organization.getJoinFormSchema({
      organizationId: orgId,
    })

    expect(result).toEqual({
      joinFormSchema,
    })
  })

  it("allows joinOrg for open organizations", async () => {
    const caller = buildCaller(externalUser, otherOrgId)
    const addMemberImpl = async (ctx: unknown) => {
      const { body } = ctx as { body: { organizationId: string; userId: string; role: string } }
      await db.insert(member).values({
        id: `mem_${randomUUID().replaceAll("-", "")}`,
        organizationId: body.organizationId,
        userId: body.userId,
        role: body.role,
        createdAt: new Date(),
      })

      return undefined as never
    }
    const addMemberSpy = vi
      .spyOn(auth.api, "addMember")
      .mockImplementation(addMemberImpl as unknown as typeof auth.api.addMember)

    await expect(
      caller.organization.joinOrg({
        organizationId: orgId,
      })
    ).resolves.toEqual({ success: true })
    expect(addMemberSpy).toHaveBeenCalledTimes(1)

    const [createdMembership] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, orgId),
          eq(member.userId, externalUser.id)
        )
      )
      .limit(1)

    expect(createdMembership?.role).toBe("member")
  })

  it("rejects joinOrg when organization is invite-only", async () => {
    const caller = buildCaller(externalUser, otherOrgId)
    const addMemberSpy = vi.spyOn(auth.api, "addMember")

    await db
      .update(organization)
      .set({ defaultJoinMode: "invite" })
      .where(eq(organization.id, orgId))

    await expect(
      caller.organization.joinOrg({
        organizationId: orgId,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This organization is invite-only. You need an invitation to join.",
    })
    expect(addMemberSpy).not.toHaveBeenCalled()
  })

  it("rejects joinOrg when organization requires approval", async () => {
    const caller = buildCaller(externalUser, otherOrgId)
    const addMemberSpy = vi.spyOn(auth.api, "addMember")

    await db
      .update(organization)
      .set({ defaultJoinMode: "approval" })
      .where(eq(organization.id, orgId))

    await expect(
      caller.organization.joinOrg({
        organizationId: orgId,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This organization requires approval to join. Please submit a join request.",
    })
    expect(addMemberSpy).not.toHaveBeenCalled()
  })

  it("rejects joinOrg when user is already a member", async () => {
    const caller = buildCaller(memberUser, orgId)
    const addMemberSpy = vi.spyOn(auth.api, "addMember")

    await expect(
      caller.organization.joinOrg({
        organizationId: orgId,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You are already a member of this organization",
    })
    expect(addMemberSpy).not.toHaveBeenCalled()
  })

  it("returns a published public session for the matching organization", async () => {
    const activity = await createTestActivity({
      organizationId: orgId,
      createdBy: ownerUser.id,
      slug: `public-session-${randomUUID().slice(0, 8)}`,
    })

    const [createdSession] = await db
      .insert(eventSession)
      .values({
        organizationId: orgId,
        activityId: activity.id,
        title: "Published Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 20,
        maxWaitlist: 5,
        joinMode: "open",
        status: "published",
        createdBy: ownerUser.id,
      })
      .returning()

    const publicCaller = appRouter.createCaller(createTRPCContext({}))
    const result = await publicCaller.organization.getPublicSession({
      username: ownerUsername,
      groupSlug,
      sessionId: createdSession.id,
    })

    expect(result.organization.id).toBe(orgId)
    expect(result.session.id).toBe(createdSession.id)
    expect(result.session.status).toBe("published")
    expect(result.session.joinedCount).toBe(0)
    expect(result.session.waitlistCount).toBe(0)
  })

  it("returns not found for getPublicSession when organization is missing", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    await expect(
      publicCaller.organization.getPublicSession({
        username: "missing-user",
        groupSlug: "missing-group",
        sessionId: `sess_${randomUUID().replaceAll("-", "")}`,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Organization not found",
    })
  })

  it("returns not found for getPublicSession when session does not exist", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    await expect(
      publicCaller.organization.getPublicSession({
        username: ownerUsername,
        groupSlug,
        sessionId: `sess_${randomUUID().replaceAll("-", "")}`,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Session not found",
    })
  })

  it("returns not found for getPublicSession when session belongs to another organization", async () => {
    const otherActivity = await createTestActivity({
      organizationId: otherOrgId,
      createdBy: externalUser.id,
      slug: `other-public-session-${randomUUID().slice(0, 8)}`,
    })

    const [otherOrgSession] = await db
      .insert(eventSession)
      .values({
        organizationId: otherOrgId,
        activityId: otherActivity.id,
        title: "Other Org Published Session",
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxCapacity: 10,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: externalUser.id,
      })
      .returning()

    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    await expect(
      publicCaller.organization.getPublicSession({
        username: ownerUsername,
        groupSlug,
        sessionId: otherOrgSession.id,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Session not found",
    })
  })

  it("returns not found for getPublicSession when session is not published", async () => {
    const activity = await createTestActivity({
      organizationId: orgId,
      createdBy: ownerUser.id,
      slug: `draft-public-session-${randomUUID().slice(0, 8)}`,
    })

    const [draftSession] = await db
      .insert(eventSession)
      .values({
        organizationId: orgId,
        activityId: activity.id,
        title: "Draft Session",
        dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
        maxCapacity: 15,
        maxWaitlist: 3,
        joinMode: "open",
        status: "draft",
        createdBy: ownerUser.id,
      })
      .returning()

    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    await expect(
      publicCaller.organization.getPublicSession({
        username: ownerUsername,
        groupSlug,
        sessionId: draftSession.id,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Session not found",
    })
  })

  it("allows admin to update non-name settings", async () => {
    const adminCaller = buildCaller(adminUser, orgId)

    await expect(
      adminCaller.organization.updateSettings({
        timezone: "America/New_York",
        defaultJoinMode: "approval",
      })
    ).resolves.toEqual({ success: true })

    const [updated] = await db
      .select({
        timezone: organization.timezone,
        defaultJoinMode: organization.defaultJoinMode,
      })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1)

    expect(updated?.timezone).toBe("America/New_York")
    expect(updated?.defaultJoinMode).toBe("approval")
  })

  it("blocks non-admin users from updateSettings", async () => {
    const memberCaller = buildCaller(memberUser, orgId)

    await expect(
      memberCaller.organization.updateSettings({
        timezone: "UTC",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization admins can perform this action",
    })
  })

  it("blocks admin from changing organization name", async () => {
    const adminCaller = buildCaller(adminUser, orgId)

    await expect(
      adminCaller.organization.updateSettings({
        name: "Admin Rename",
        confirmText: "confirm",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only the group owner can change the group name",
    })
  })

  it("requires confirm text for owner name change", async () => {
    const ownerCaller = buildCaller(ownerUser, orgId)

    await expect(
      ownerCaller.organization.updateSettings({
        name: "Owner Rename",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "You must type 'confirm' to change the group name",
    })
  })

  it("allows a single owner name change and blocks subsequent changes", async () => {
    const ownerCaller = buildCaller(ownerUser, orgId)

    await expect(
      ownerCaller.organization.updateSettings({
        name: "First Rename",
        confirmText: "confirm",
      })
    ).resolves.toEqual({ success: true })

    await expect(
      ownerCaller.organization.updateSettings({
        name: "Second Rename",
        confirmText: "confirm",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "The group name has already been changed and cannot be modified again",
    })
  })
})

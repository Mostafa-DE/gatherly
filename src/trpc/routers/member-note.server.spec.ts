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

describe("member-note router", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let activityId = ""
  let otherOrgActivityId = ""

  let owner!: User
  let admin!: User
  let otherAdmin!: User
  let memberUser!: User
  let targetUser!: User

  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("member-note-owner")
    const otherOrganization = await createTestOrganization("member-note-other-owner")

    owner = await createTestUser("Member Note Owner")
    admin = await createTestUser("Member Note Admin")
    otherAdmin = await createTestUser("Member Note Other Admin")
    memberUser = await createTestUser("Member Note Member")
    targetUser = await createTestUser("Member Note Target")

    organizationId = organization.id
    otherOrganizationId = otherOrganization.id

    organizationIds.push(organizationId, otherOrganizationId)
    userIds.push(owner.id, admin.id, otherAdmin.id, memberUser.id, targetUser.id)

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
      userId: otherAdmin.id,
      role: "admin",
    })

    await createTestMembership({
      organizationId,
      userId: memberUser.id,
      role: "member",
    })

    await createTestMembership({
      organizationId,
      userId: targetUser.id,
      role: "member",
    })

    const activity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Member Note Activity",
    })
    activityId = activity.id

    const otherOrgActivity = await createTestActivity({
      organizationId: otherOrganizationId,
      createdBy: owner.id,
      name: "Other Org Activity",
    })
    otherOrgActivityId = otherOrgActivity.id
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
    activityId = ""
    otherOrgActivityId = ""

    organizationIds.length = 0
    userIds.length = 0
  })

  it("admin can create and list member notes", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.memberNote.create({
      targetUserId: targetUser.id,
      content: "Needs closer follow-up",
      activityId,
    })

    expect(created.organizationId).toBe(organizationId)
    expect(created.targetUserId).toBe(targetUser.id)
    expect(created.authorUserId).toBe(admin.id)
    expect(created.activityId).toBe(activityId)
    expect(created.content).toBe("Needs closer follow-up")

    const listed = await adminCaller.memberNote.list({
      targetUserId: targetUser.id,
    })

    expect(listed.some((entry) => entry.note.id === created.id)).toBe(true)

    const listedForActivity = await adminCaller.memberNote.list({
      targetUserId: targetUser.id,
      activityId,
    })

    expect(listedForActivity.length).toBe(1)
    expect(listedForActivity[0]?.note.id).toBe(created.id)
    expect(listedForActivity[0]?.author.id).toBe(admin.id)
  })

  it("admin can update own note", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.memberNote.create({
      targetUserId: targetUser.id,
      content: "Initial note",
    })

    const updated = await adminCaller.memberNote.update({
      noteId: created.id,
      content: "Updated note content",
    })

    expect(updated.id).toBe(created.id)
    expect(updated.content).toBe("Updated note content")
    expect(updated.authorUserId).toBe(admin.id)
  })

  it("admin can delete own note", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.memberNote.create({
      targetUserId: targetUser.id,
      content: "To be deleted",
    })

    await expect(
      adminCaller.memberNote.delete({
        noteId: created.id,
      })
    ).resolves.toEqual({ success: true })

    const listed = await adminCaller.memberNote.list({
      targetUserId: targetUser.id,
    })

    expect(listed.some((entry) => entry.note.id === created.id)).toBe(false)
  })

  it("forbids member role for create/list/update/delete", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)
    const adminCaller = buildCaller(admin, organizationId)

    const created = await adminCaller.memberNote.create({
      targetUserId: targetUser.id,
      content: "Admin authored note",
    })

    await expect(
      memberCaller.memberNote.create({
        targetUserId: targetUser.id,
        content: "Should not be allowed",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization owners and admins can perform this action",
    })

    await expect(
      memberCaller.memberNote.list({
        targetUserId: targetUser.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization owners and admins can perform this action",
    })

    await expect(
      memberCaller.memberNote.update({
        noteId: created.id,
        content: "Should not be allowed",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization owners and admins can perform this action",
    })

    await expect(
      memberCaller.memberNote.delete({
        noteId: created.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization owners and admins can perform this action",
    })
  })

  it("requires activity to belong to active organization when activityId is provided", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.memberNote.create({
        targetUserId: targetUser.id,
        content: "Cross-org activity should fail",
        activityId: otherOrgActivityId,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Activity not found",
    })
  })

  it("returns not found on update when note does not exist", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.memberNote.update({
        noteId: "missing-note-id",
        content: "No-op",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found or you are not the author",
    })
  })

  it("returns not found on update for existing note authored by another admin", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const otherAdminCaller = buildCaller(otherAdmin, organizationId)

    const created = await ownerCaller.memberNote.create({
      targetUserId: targetUser.id,
      content: "Owner-only note",
    })

    await expect(
      otherAdminCaller.memberNote.update({
        noteId: created.id,
        content: "Should fail for non-author",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found or you are not the author",
    })
  })

  it("returns not found on delete when note does not exist", async () => {
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.memberNote.delete({
        noteId: "missing-note-id",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found or you are not the author",
    })
  })

  it("returns not found on delete for existing note authored by another admin", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const otherAdminCaller = buildCaller(otherAdmin, organizationId)

    const created = await ownerCaller.memberNote.create({
      targetUserId: targetUser.id,
      content: "Owner-only note",
    })

    await expect(
      otherAdminCaller.memberNote.delete({
        noteId: created.id,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Note not found or you are not the author",
    })
  })
})

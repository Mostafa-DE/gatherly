import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/db"
import { activity as activityTable, activityJoinRequest } from "@/db/schema"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestActivity,
  createTestActivityMember,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import * as activityMembersDataAccess from "@/data-access/activity-members"
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

describe("activityMembership router", () => {
  let organizationId = ""
  let openActivityId = ""
  let approvalActivityId = ""
  let inviteActivityId = ""
  let owner!: User
  let memberUser!: User
  const userIds: string[] = []

  beforeEach(async () => {
    const org = await createTestOrganization()
    const createdOwner = await createTestUser("Owner")
    const createdMember = await createTestUser("Member")

    organizationId = org.id
    owner = createdOwner
    memberUser = createdMember
    userIds.push(createdOwner.id, createdMember.id)

    await createTestMembership({
      organizationId,
      userId: owner.id,
      role: "owner",
    })

    await createTestMembership({
      organizationId,
      userId: memberUser.id,
      role: "member",
    })

    const openActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Open Activity",
      joinMode: "open",
    })
    openActivityId = openActivity.id

    const approvalActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Approval Activity",
      joinMode: "require_approval",
    })
    approvalActivityId = approvalActivity.id

    const inviteActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Invite Activity",
      joinMode: "invite",
    })
    inviteActivityId = inviteActivity.id
  })

  afterEach(async () => {
    vi.restoreAllMocks()

    if (organizationId) {
      await cleanupTestData({
        organizationIds: [organizationId],
        userIds,
      })
    }

    organizationId = ""
    openActivityId = ""
    approvalActivityId = ""
    inviteActivityId = ""
    userIds.length = 0
  })

  // ===========================================================================
  // Open join mode
  // ===========================================================================

  describe("open join", () => {
    it("member can join an open activity and gets active membership", async () => {
      const caller = buildCaller(memberUser, organizationId)

      const result = await caller.activityMembership.join({
        activityId: openActivityId,
      })

      expect(result.activityId).toBe(openActivityId)
      expect(result.userId).toBe(memberUser.id)
      expect(result.status).toBe("active")
    })

    it("join is idempotent — calling join again returns existing membership", async () => {
      const caller = buildCaller(memberUser, organizationId)

      const first = await caller.activityMembership.join({
        activityId: openActivityId,
      })

      const second = await caller.activityMembership.join({
        activityId: openActivityId,
      })

      expect(second.id).toBe(first.id)
      expect(second.status).toBe("active")
    })
  })

  // ===========================================================================
  // Require approval join mode
  // ===========================================================================

  describe("require_approval join", () => {
    it("member can request to join a require_approval activity and gets pending request", async () => {
      const caller = buildCaller(memberUser, organizationId)

      const result = await caller.activityMembership.requestJoin({
        activityId: approvalActivityId,
        message: "Please let me in",
      })

      expect(result.activityId).toBe(approvalActivityId)
      expect(result.userId).toBe(memberUser.id)
      expect(result.status).toBe("pending")
    })

    it("admin can approve a pending request and member becomes active", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)
      const adminCaller = buildCaller(owner, organizationId)

      const request = await memberCaller.activityMembership.requestJoin({
        activityId: approvalActivityId,
      })

      const approved = await adminCaller.activityMembership.approveRequest({
        requestId: request.id,
      })

      expect(approved.status).toBe("approved")
    })

    it("keeps request pending when membership creation fails during approval", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)
      const adminCaller = buildCaller(owner, organizationId)

      const request = await memberCaller.activityMembership.requestJoin({
        activityId: approvalActivityId,
      })

      vi
        .spyOn(activityMembersDataAccess, "createActivityMember")
        .mockRejectedValueOnce(new Error("membership insert failed"))

      await expect(
        adminCaller.activityMembership.approveRequest({
          requestId: request.id,
        })
      ).rejects.toThrow("membership insert failed")

      const [stored] = await db
        .select({ status: activityJoinRequest.status })
        .from(activityJoinRequest)
        .where(eq(activityJoinRequest.id, request.id))
        .limit(1)

      expect(stored?.status).toBe("pending")
    })

    it("admin can reject a pending request", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)
      const adminCaller = buildCaller(owner, organizationId)

      const request = await memberCaller.activityMembership.requestJoin({
        activityId: approvalActivityId,
        message: "Please review",
      })

      const rejected = await adminCaller.activityMembership.rejectRequest({
        requestId: request.id,
      })

      expect(rejected.status).toBe("rejected")
    })

    it("validates form answers when activity has joinFormSchema", async () => {
      const joinFormSchema = {
        fields: [
          {
            id: "reason",
            type: "text",
            label: "Reason for joining",
            required: true,
          },
          {
            id: "experience",
            type: "select",
            label: "Experience level",
            required: true,
            options: ["beginner", "intermediate", "advanced"],
          },
        ],
      }

      await db
        .update(activityTable)
        .set({ joinFormSchema })
        .where(eq(activityTable.id, approvalActivityId))

      const caller = buildCaller(memberUser, organizationId)

      // Should fail without form answers
      await expect(
        caller.activityMembership.requestJoin({
          activityId: approvalActivityId,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("accepts valid form answers when activity has joinFormSchema", async () => {
      const joinFormSchema = {
        fields: [
          {
            id: "reason",
            type: "text",
            label: "Reason for joining",
            required: true,
          },
        ],
      }

      await db
        .update(activityTable)
        .set({ joinFormSchema })
        .where(eq(activityTable.id, approvalActivityId))

      const caller = buildCaller(memberUser, organizationId)

      const result = await caller.activityMembership.requestJoin({
        activityId: approvalActivityId,
        formAnswers: {
          reason: "I want to participate in this activity",
        },
      })

      expect(result.status).toBe("pending")
      expect(result.activityId).toBe(approvalActivityId)
    })
  })

  // ===========================================================================
  // Invite join mode
  // ===========================================================================

  describe("invite join mode", () => {
    it("regular member cannot join an invite-only activity directly", async () => {
      const caller = buildCaller(memberUser, organizationId)

      await expect(
        caller.activityMembership.join({
          activityId: inviteActivityId,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })

  // ===========================================================================
  // Admin operations
  // ===========================================================================

  describe("admin operations", () => {
    it("admin can add a member to any activity", async () => {
      const adminCaller = buildCaller(owner, organizationId)

      const result = await adminCaller.activityMembership.adminAdd({
        activityId: inviteActivityId,
        userId: memberUser.id,
      })

      expect(result.activityId).toBe(inviteActivityId)
      expect(result.userId).toBe(memberUser.id)
      expect(result.status).toBe("active")
    })

    it("admin cannot add a user who is not an org member", async () => {
      const outsider = await createTestUser("Outsider")
      userIds.push(outsider.id)

      const adminCaller = buildCaller(owner, organizationId)

      await expect(
        adminCaller.activityMembership.adminAdd({
          activityId: inviteActivityId,
          userId: outsider.id,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("admin can remove a member from an activity", async () => {
      const adminCaller = buildCaller(owner, organizationId)

      // First add the member
      await createTestActivityMember({
        activityId: openActivityId,
        userId: memberUser.id,
        status: "active",
      })

      const result = await adminCaller.activityMembership.remove({
        activityId: openActivityId,
        userId: memberUser.id,
      })

      expect(result.success).toBe(true)
    })

    it("non-admin cannot add a member to an activity", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)

      await expect(
        memberCaller.activityMembership.adminAdd({
          activityId: openActivityId,
          userId: owner.id,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })

    it("non-admin cannot remove a member from an activity", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)

      await expect(
        memberCaller.activityMembership.remove({
          activityId: openActivityId,
          userId: owner.id,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })

  // ===========================================================================
  // List members
  // ===========================================================================

  describe("list members", () => {
    it("can list activity members", async () => {
      await createTestActivityMember({
        activityId: openActivityId,
        userId: owner.id,
        status: "active",
      })

      await createTestActivityMember({
        activityId: openActivityId,
        userId: memberUser.id,
        status: "active",
      })

      const caller = buildCaller(memberUser, organizationId)

      const result = await caller.activityMembership.members({
        activityId: openActivityId,
        limit: 50,
        offset: 0,
      })

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
    })

    it("can filter activity members by status", async () => {
      await createTestActivityMember({
        activityId: openActivityId,
        userId: owner.id,
        status: "active",
      })

      await createTestActivityMember({
        activityId: openActivityId,
        userId: memberUser.id,
        status: "pending",
      })

      const caller = buildCaller(owner, organizationId)

      const activeMembers = await caller.activityMembership.members({
        activityId: openActivityId,
        status: "active",
        limit: 50,
        offset: 0,
      })

      expect(activeMembers.length).toBe(1)
      expect(activeMembers[0].member.userId).toBe(owner.id)
    })
  })

  // ===========================================================================
  // Deactivated activity guards
  // ===========================================================================

  describe("deactivated activity guards", () => {
    it("cannot join a deactivated activity", async () => {
      // Deactivate the open activity
      await db
        .update(activityTable)
        .set({ isActive: false })
        .where(eq(activityTable.id, openActivityId))

      const caller = buildCaller(memberUser, organizationId)

      await expect(
        caller.activityMembership.join({ activityId: openActivityId })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("cannot request join for a deactivated activity", async () => {
      // Deactivate the approval activity
      await db
        .update(activityTable)
        .set({ isActive: false })
        .where(eq(activityTable.id, approvalActivityId))

      const caller = buildCaller(memberUser, organizationId)

      await expect(
        caller.activityMembership.requestJoin({ activityId: approvalActivityId })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  })

  // ===========================================================================
  // List pending requests (admin)
  // ===========================================================================

  describe("list pending requests", () => {
    it("admin can list pending join requests for an activity", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)
      const adminCaller = buildCaller(owner, organizationId)

      await memberCaller.activityMembership.requestJoin({
        activityId: approvalActivityId,
        message: "Pending request",
      })

      const pending = await adminCaller.activityMembership.listPendingRequests({
        activityId: approvalActivityId,
      })

      expect(Array.isArray(pending)).toBe(true)
      expect(pending.length).toBe(1)
      expect(pending[0].request.userId).toBe(memberUser.id)
      expect(pending[0].request.status).toBe("pending")
    })

    it("non-admin cannot list pending join requests", async () => {
      const memberCaller = buildCaller(memberUser, organizationId)

      await expect(
        memberCaller.activityMembership.listPendingRequests({
          activityId: approvalActivityId,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
    })
  })
})

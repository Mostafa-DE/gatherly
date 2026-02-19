import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import {
  activityMember,
  eventSession,
  participation as participationTable,
} from "@/db/schema"
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

describe("participation router", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let openActivityId = ""
  let approvalActivityId = ""
  let inviteActivityId = ""
  let otherOrgActivityId = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  let secondMemberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  async function createPublishedSession(input: {
    organizationId?: string
    activityId?: string
    createdBy?: string
    dateTime?: Date
    title?: string
    maxCapacity?: number
    maxWaitlist?: number
    joinMode?: "open" | "approval_required" | "invite_only"
    joinFormSchema?: unknown
  }) {
    const [createdSession] = await db
      .insert(eventSession)
      .values({
        organizationId: input.organizationId ?? organizationId,
        activityId: input.activityId ?? openActivityId,
        title: input.title ?? `Session ${randomUUID().slice(0, 8)}`,
        dateTime: input.dateTime ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxCapacity: input.maxCapacity ?? 10,
        maxWaitlist: input.maxWaitlist ?? 5,
        joinMode: input.joinMode ?? "open",
        status: "published",
        joinFormSchema: input.joinFormSchema,
        createdBy: input.createdBy ?? owner.id,
      })
      .returning()

    return createdSession
  }

  beforeEach(async () => {
    const primaryOrg = await createTestOrganization("participation-owner")
    const secondaryOrg = await createTestOrganization("participation-other-owner")
    const ownerRecord = await createTestUser("Participation Owner")
    const adminRecord = await createTestUser("Participation Admin")
    const memberRecord = await createTestUser("Participation Member")
    const secondMemberRecord = await createTestUser("Participation Member Two")

    organizationId = primaryOrg.id
    otherOrganizationId = secondaryOrg.id
    owner = ownerRecord
    admin = adminRecord
    memberUser = memberRecord
    secondMemberUser = secondMemberRecord

    organizationIds.push(organizationId, otherOrganizationId)
    userIds.push(owner.id, admin.id, memberUser.id, secondMemberUser.id)

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
      organizationId,
      userId: secondMemberUser.id,
      role: "member",
    })
    await createTestMembership({
      organizationId: otherOrganizationId,
      userId: admin.id,
      role: "admin",
    })

    const openActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Open Activity",
      joinMode: "open",
    })
    const approvalActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Approval Activity",
      joinMode: "require_approval",
    })
    const inviteActivity = await createTestActivity({
      organizationId,
      createdBy: owner.id,
      name: "Invite Activity",
      joinMode: "invite",
    })
    const otherActivity = await createTestActivity({
      organizationId: otherOrganizationId,
      createdBy: owner.id,
      name: "Other Org Activity",
      joinMode: "open",
    })

    openActivityId = openActivity.id
    approvalActivityId = approvalActivity.id
    inviteActivityId = inviteActivity.id
    otherOrgActivityId = otherActivity.id
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
    openActivityId = ""
    approvalActivityId = ""
    inviteActivityId = ""
    otherOrgActivityId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("joins an open-activity session by auto-creating activity membership", async () => {
    const session = await createPublishedSession({ activityId: openActivityId })
    const memberCaller = buildCaller(memberUser, organizationId)

    const joined = await memberCaller.participation.join({
      sessionId: session.id,
    })

    expect(joined.sessionId).toBe(session.id)
    expect(joined.userId).toBe(memberUser.id)
    expect(joined.status).toBe("joined")

    const [createdMembership] = await db
      .select({ status: activityMember.status })
      .from(activityMember)
      .where(
        and(
          eq(activityMember.activityId, openActivityId),
          eq(activityMember.userId, memberUser.id)
        )
      )
      .limit(1)

    expect(createdMembership?.status).toBe("active")
  })

  it("reactivates existing non-active activity membership when joining an open session", async () => {
    await createTestActivityMember({
      activityId: openActivityId,
      userId: memberUser.id,
      status: "rejected",
    })

    const session = await createPublishedSession({ activityId: openActivityId })
    const memberCaller = buildCaller(memberUser, organizationId)

    const joined = await memberCaller.participation.join({
      sessionId: session.id,
    })

    expect(joined.sessionId).toBe(session.id)
    expect(joined.userId).toBe(memberUser.id)
    expect(joined.status).toBe("joined")

    const [membership] = await db
      .select({ status: activityMember.status })
      .from(activityMember)
      .where(
        and(
          eq(activityMember.activityId, openActivityId),
          eq(activityMember.userId, memberUser.id)
        )
      )
      .limit(1)

    expect(membership?.status).toBe("active")
  })

  it("rejects join when activity requires approval and user is not an active activity member", async () => {
    const session = await createPublishedSession({ activityId: approvalActivityId })
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.participation.join({
        sessionId: session.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Join the activity first before joining this session",
    })
  })

  it("rejects join when activity is invite-only and user is not an active activity member", async () => {
    const session = await createPublishedSession({ activityId: inviteActivityId })
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.participation.join({
        sessionId: session.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Activity is invite-only",
    })
  })

  it("requires join form answers when session join form fields exist", async () => {
    await createTestActivityMember({
      activityId: openActivityId,
      userId: memberUser.id,
      status: "active",
    })

    const session = await createPublishedSession({
      activityId: openActivityId,
      joinFormSchema: {
        fields: [
          {
            id: "reason",
            type: "text",
            label: "Reason",
            required: true,
          },
        ],
      },
    })
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.participation.join({
        sessionId: session.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This session requires a join form to be filled out",
    })
  })

  it("enforces cancel ownership by rejecting cancellation of another user's participation", async () => {
    const session = await createPublishedSession({ activityId: openActivityId })
    const [otherUsersParticipation] = await db
      .insert(participationTable)
      .values({
        sessionId: session.id,
        userId: secondMemberUser.id,
        status: "joined",
      })
      .returning({ id: participationTable.id })

    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.participation.cancel({
        participationId: otherUsersParticipation.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const [stored] = await db
      .select({ status: participationTable.status })
      .from(participationTable)
      .where(eq(participationTable.id, otherUsersParticipation.id))
      .limit(1)

    expect(stored?.status).toBe("joined")
  })

  it("redacts participant contact info for non-admin users", async () => {
    const session = await createPublishedSession({ activityId: openActivityId })

    await db.insert(participationTable).values({
      sessionId: session.id,
      userId: secondMemberUser.id,
      status: "joined",
    })

    const memberCaller = buildCaller(memberUser, organizationId)
    const adminCaller = buildCaller(admin, organizationId)

    const memberView = await memberCaller.participation.participants({
      sessionId: session.id,
      status: "joined",
      limit: 20,
      offset: 0,
    })

    const adminView = await adminCaller.participation.participants({
      sessionId: session.id,
      status: "joined",
      limit: 20,
      offset: 0,
    })

    const memberEntry = memberView.find((entry) => entry.user.id === secondMemberUser.id)
    const adminEntry = adminView.find((entry) => entry.user.id === secondMemberUser.id)

    expect(memberEntry?.user.email).toBe("")
    expect(memberEntry?.user.phoneNumber).toBe("")
    expect(adminEntry?.user.email).toBe(secondMemberUser.email)
    expect(adminEntry?.user.phoneNumber).toBe(secondMemberUser.phoneNumber)
  })

  it("blocks non-admin users from admin-only participation procedures", async () => {
    const sourceSession = await createPublishedSession({ activityId: openActivityId })
    const targetSession = await createPublishedSession({
      activityId: openActivityId,
      title: "Target Session",
    })

    const [pendingParticipation] = await db
      .insert(participationTable)
      .values({
        sessionId: sourceSession.id,
        userId: secondMemberUser.id,
        status: "pending",
      })
      .returning({ id: participationTable.id })

    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.participation.update({
        participationId: pendingParticipation.id,
        attendance: "show",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.bulkUpdateAttendance({
        sessionId: sourceSession.id,
        updates: [
          {
            participationId: pendingParticipation.id,
            attendance: "show",
          },
        ],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.bulkUpdatePayment({
        sessionId: sourceSession.id,
        updates: [
          {
            participationId: pendingParticipation.id,
            payment: "paid",
          },
        ],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.userHistory({
        userId: secondMemberUser.id,
        limit: 20,
        offset: 0,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.adminAdd({
        sessionId: sourceSession.id,
        identifier: secondMemberUser.email,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.move({
        participationId: pendingParticipation.id,
        targetSessionId: targetSession.id,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.approvePending({
        participationId: pendingParticipation.id,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.rejectPending({
        participationId: pendingParticipation.id,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    await expect(
      memberCaller.participation.pendingApprovalsSummary({
        limit: 5,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("applies adminAdd user lookup and organization membership checks", async () => {
    const session = await createPublishedSession({ activityId: openActivityId })
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.participation.adminAdd({
        sessionId: session.id,
        identifier: "missing-user@example.com",
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No user found with that email or phone",
    })

    const externalUser = await createTestUser("External User")
    userIds.push(externalUser.id)

    await expect(
      adminCaller.participation.adminAdd({
        sessionId: session.id,
        identifier: externalUser.email,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "User is not a member of this organization",
    })
  })

  it("supports adminAddByUserId with membership and org-scope guards", async () => {
    const session = await createPublishedSession({ activityId: openActivityId })
    const adminCaller = buildCaller(admin, organizationId)

    const added = await adminCaller.participation.adminAddByUserId({
      sessionId: session.id,
      userId: secondMemberUser.id,
    })
    expect(added.sessionId).toBe(session.id)
    expect(added.userId).toBe(secondMemberUser.id)
    expect(added.status).toBe("joined")

    const outsider = await createTestUser("AdminAddById Outsider")
    userIds.push(outsider.id)

    await expect(
      adminCaller.participation.adminAddByUserId({
        sessionId: session.id,
        userId: outsider.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "User is not a member of this organization",
    })

    const otherOrgSession = await createPublishedSession({
      organizationId: otherOrganizationId,
      activityId: otherOrgActivityId,
      title: "Other Org Session",
    })

    await expect(
      adminCaller.participation.adminAddByUserId({
        sessionId: otherOrgSession.id,
        userId: secondMemberUser.id,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Session not found",
    })
  })

  it("enforces move cross-organization and same-session guards", async () => {
    const sourceSession = await createPublishedSession({
      organizationId,
      activityId: openActivityId,
      title: "Source Session",
    })
    const targetSession = await createPublishedSession({
      organizationId,
      activityId: openActivityId,
      title: "Target Session",
    })
    const otherOrgSession = await createPublishedSession({
      organizationId: otherOrganizationId,
      activityId: otherOrgActivityId,
      title: "Other Org Session",
    })

    const [sourceParticipation] = await db
      .insert(participationTable)
      .values({
        sessionId: sourceSession.id,
        userId: memberUser.id,
        status: "joined",
      })
      .returning({ id: participationTable.id })

    const [otherOrgParticipation] = await db
      .insert(participationTable)
      .values({
        sessionId: otherOrgSession.id,
        userId: memberUser.id,
        status: "joined",
      })
      .returning({ id: participationTable.id })

    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      adminCaller.participation.move({
        participationId: otherOrgParticipation.id,
        targetSessionId: targetSession.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    await expect(
      adminCaller.participation.move({
        participationId: sourceParticipation.id,
        targetSessionId: otherOrgSession.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    await expect(
      adminCaller.participation.move({
        participationId: sourceParticipation.id,
        targetSessionId: sourceSession.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Cannot move participant to the same session",
    })
  })

  it("allows admins to approve and reject pending participations", async () => {
    await createTestActivityMember({
      activityId: openActivityId,
      userId: memberUser.id,
      status: "active",
    })
    await createTestActivityMember({
      activityId: openActivityId,
      userId: secondMemberUser.id,
      status: "active",
    })

    const approvalSession = await createPublishedSession({
      activityId: openActivityId,
      joinMode: "approval_required",
      maxCapacity: 10,
      maxWaitlist: 5,
    })

    const memberCaller = buildCaller(memberUser, organizationId)
    const secondMemberCaller = buildCaller(secondMemberUser, organizationId)
    const adminCaller = buildCaller(admin, organizationId)

    const pendingForApproval = await memberCaller.participation.join({
      sessionId: approvalSession.id,
    })
    expect(pendingForApproval.status).toBe("pending")

    const approved = await adminCaller.participation.approvePending({
      participationId: pendingForApproval.id,
    })
    expect(approved.status).toBe("joined")

    const pendingForRejection = await secondMemberCaller.participation.join({
      sessionId: approvalSession.id,
    })
    expect(pendingForRejection.status).toBe("pending")

    const rejected = await adminCaller.participation.rejectPending({
      participationId: pendingForRejection.id,
    })
    expect(rejected.status).toBe("cancelled")
  })

  it("limits pending summary access to admins and respects organization scope", async () => {
    const orgSessionOne = await createPublishedSession({
      organizationId,
      activityId: openActivityId,
      title: "Org Session One",
    })
    const orgSessionTwo = await createPublishedSession({
      organizationId,
      activityId: openActivityId,
      title: "Org Session Two",
    })
    const otherOrgSession = await createPublishedSession({
      organizationId: otherOrganizationId,
      activityId: otherOrgActivityId,
      title: "Other Org Pending Session",
    })

    await db.insert(participationTable).values([
      {
        sessionId: orgSessionOne.id,
        userId: memberUser.id,
        status: "pending",
      },
      {
        sessionId: orgSessionTwo.id,
        userId: secondMemberUser.id,
        status: "pending",
      },
      {
        sessionId: otherOrgSession.id,
        userId: admin.id,
        status: "pending",
      },
    ])

    const adminCaller = buildCaller(admin, organizationId)
    const memberCaller = buildCaller(memberUser, organizationId)

    const summary = await adminCaller.participation.pendingApprovalsSummary({
      limit: 10,
    })

    expect(summary.totalPending).toBe(2)
    expect(summary.sessionsWithPending).toBe(2)
    expect(summary.sessions.map((session) => session.sessionId).sort()).toEqual(
      [orgSessionOne.id, orgSessionTwo.id].sort()
    )

    await expect(
      memberCaller.participation.pendingApprovalsSummary({
        limit: 10,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

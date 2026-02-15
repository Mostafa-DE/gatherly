import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import { eventSession, participation } from "@/db/schema"
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

describe("groupMemberProfile router", () => {
  let organizationId = ""
  let ownerUser!: User
  let adminUser!: User
  let memberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("group-member-profile-owner")
    const owner = await createTestUser("Group Profile Owner")
    const admin = await createTestUser("Group Profile Admin")
    const member = await createTestUser("Group Profile Member")

    organizationId = organization.id
    ownerUser = owner
    adminUser = admin
    memberUser = member

    organizationIds.push(organizationId)
    userIds.push(owner.id, admin.id, member.id)

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
      userId: member.id,
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

  it("returns null from myProfile when profile is missing", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(memberCaller.groupMemberProfile.myProfile({})).resolves.toBeNull()
  })

  it("upserts the member profile via updateMyProfile then submitJoinForm", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    const created = await memberCaller.groupMemberProfile.updateMyProfile({
      nickname: "Rally Fox",
      answers: {
        level: "beginner",
      },
    })

    expect(created.organizationId).toBe(organizationId)
    expect(created.userId).toBe(memberUser.id)
    expect(created.nickname).toBe("Rally Fox")
    expect(created.answers).toEqual({
      level: "beginner",
    })

    const updated = await memberCaller.groupMemberProfile.submitJoinForm({
      answers: {
        level: "advanced",
        city: "Amman",
      },
    })

    expect(updated.id).toBe(created.id)
    expect(updated.answers).toEqual({
      level: "advanced",
      city: "Amman",
    })
    expect(updated.nickname).toBe("Rally Fox")

    const myProfile = await memberCaller.groupMemberProfile.myProfile({})
    expect(myProfile?.id).toBe(created.id)
    expect(myProfile?.answers).toEqual({
      level: "advanced",
      city: "Amman",
    })
  })

  it("enforces admin guard on getUserProfile and getUserStats", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.groupMemberProfile.getUserProfile({
        userId: memberUser.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization owners and admins can perform this action",
    })

    await expect(
      memberCaller.groupMemberProfile.getUserStats({
        userId: memberUser.id,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Only organization owners and admins can perform this action",
    })
  })

  it("returns not found when admin requests a missing user profile", async () => {
    const adminCaller = buildCaller(adminUser, organizationId)
    const missingUserId = `usr_missing_${randomUUID().replaceAll("-", "")}`

    await expect(
      adminCaller.groupMemberProfile.getUserProfile({
        userId: missingUserId,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Profile not found",
    })
  })

  it("returns expected engagement stats for myStats and getUserStats", async () => {
    const activity = await createTestActivity({
      organizationId,
      createdBy: ownerUser.id,
      name: "Group Profile Stats Activity",
    })

    const now = Date.now()
    const [attendedSession, noShowSession, upcomingSession] = await db
      .insert(eventSession)
      .values([
        {
          organizationId,
          activityId: activity.id,
          title: "Attended Session",
          dateTime: new Date(now - 2 * 24 * 60 * 60 * 1000),
          maxCapacity: 12,
          maxWaitlist: 0,
          joinMode: "open",
          status: "published",
          createdBy: ownerUser.id,
        },
        {
          organizationId,
          activityId: activity.id,
          title: "No-show Session",
          dateTime: new Date(now - 24 * 60 * 60 * 1000),
          maxCapacity: 12,
          maxWaitlist: 0,
          joinMode: "open",
          status: "published",
          createdBy: ownerUser.id,
        },
        {
          organizationId,
          activityId: activity.id,
          title: "Upcoming Session",
          dateTime: new Date(now + 24 * 60 * 60 * 1000),
          maxCapacity: 12,
          maxWaitlist: 0,
          joinMode: "open",
          status: "published",
          createdBy: ownerUser.id,
        },
      ])
      .returning({ id: eventSession.id })

    await db.insert(participation).values([
      {
        sessionId: attendedSession.id,
        userId: memberUser.id,
        status: "joined",
        attendance: "show",
        payment: "unpaid",
      },
      {
        sessionId: noShowSession.id,
        userId: memberUser.id,
        status: "joined",
        attendance: "no_show",
        payment: "unpaid",
      },
      {
        sessionId: upcomingSession.id,
        userId: memberUser.id,
        status: "joined",
        attendance: "pending",
        payment: "unpaid",
      },
    ])

    const memberCaller = buildCaller(memberUser, organizationId)
    const adminCaller = buildCaller(adminUser, organizationId)

    const myStats = await memberCaller.groupMemberProfile.myStats()

    expect(myStats).toEqual({
      sessionsAttended: 1,
      noShows: 1,
      totalCompleted: 2,
      attendanceRate: 50,
      upcomingSessions: 1,
    })

    const targetUserStats = await adminCaller.groupMemberProfile.getUserStats({
      userId: memberUser.id,
    })

    expect(targetUserStats).toEqual(myStats)
  })
})

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  eventSession,
  organizationSettings,
  participation,
  member,
} from "@/db/schema"
import type { User } from "@/db/types"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import {
  getAnalyticsSummary,
  getAttendancePatternStats,
  getGroupHealthStats,
  getRevenueStats,
  getSessionPerformanceStats,
} from "@/plugins/analytics/queries"

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

describe("analytics queries", () => {
  let orgId = ""
  let otherOrgId = ""
  let emptyOrgId = ""

  let owner!: User
  let memberA!: User
  let memberB!: User
  let memberC!: User
  let memberD!: User
  let otherOrgUser!: User

  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const org = await createTestOrganization("analytics-owner")
    const otherOrg = await createTestOrganization("other-org-owner")
    const emptyOrg = await createTestOrganization("empty-org-owner")

    orgId = org.id
    otherOrgId = otherOrg.id
    emptyOrgId = emptyOrg.id

    organizationIds.push(orgId, otherOrgId, emptyOrgId)

    owner = await createTestUser("Org Owner")
    memberA = await createTestUser("Member A")
    memberB = await createTestUser("Member B")
    memberC = await createTestUser("Member C")
    memberD = await createTestUser("Member D")
    otherOrgUser = await createTestUser("Other Org User")

    userIds.push(
      owner.id,
      memberA.id,
      memberB.id,
      memberC.id,
      memberD.id,
      otherOrgUser.id
    )

    const ownerMembership = await createTestMembership({
      organizationId: orgId,
      userId: owner.id,
      role: "owner",
    })
    const memberAMembership = await createTestMembership({
      organizationId: orgId,
      userId: memberA.id,
      role: "member",
    })
    const memberBMembership = await createTestMembership({
      organizationId: orgId,
      userId: memberB.id,
      role: "member",
    })
    const memberCMembership = await createTestMembership({
      organizationId: orgId,
      userId: memberC.id,
      role: "member",
    })
    const memberDMembership = await createTestMembership({
      organizationId: orgId,
      userId: memberD.id,
      role: "member",
    })

    // Shape membership timeline: 2 new members in current period (30d),
    // 3 older members for baseline/retention checks.
    await db
      .update(member)
      .set({ createdAt: daysAgo(40) })
      .where(eq(member.id, ownerMembership.id))
    await db
      .update(member)
      .set({ createdAt: daysAgo(20) })
      .where(eq(member.id, memberAMembership.id))
    await db
      .update(member)
      .set({ createdAt: daysAgo(10) })
      .where(eq(member.id, memberBMembership.id))
    await db
      .update(member)
      .set({ createdAt: daysAgo(50) })
      .where(eq(member.id, memberCMembership.id))
    await db
      .update(member)
      .set({ createdAt: daysAgo(70) })
      .where(eq(member.id, memberDMembership.id))

    await createTestMembership({
      organizationId: otherOrgId,
      userId: otherOrgUser.id,
      role: "owner",
    })

    await db.insert(organizationSettings).values([
      {
        organizationId: orgId,
        currency: "USD",
        joinFormSchema: null,
        joinFormVersion: 1,
      },
      {
        organizationId: otherOrgId,
        currency: "EUR",
        joinFormSchema: null,
        joinFormVersion: 1,
      },
    ])

    const [previousPeriodSession, sessionA, sessionB, sessionC, cancelledSession] =
      await db
        .insert(eventSession)
        .values([
          {
            organizationId: orgId,
            title: "Previous Period Session",
            dateTime: daysAgo(35),
            maxCapacity: 6,
            maxWaitlist: 0,
            joinMode: "open",
            status: "published",
            createdBy: owner.id,
            price: "12.00",
          },
          {
            organizationId: orgId,
            title: "Session A",
            dateTime: daysAgo(7),
            maxCapacity: 10,
            maxWaitlist: 2,
            joinMode: "open",
            status: "published",
            createdBy: owner.id,
            price: "10.00",
          },
          {
            organizationId: orgId,
            title: "Session B",
            dateTime: daysAgo(5),
            maxCapacity: 8,
            maxWaitlist: 2,
            joinMode: "open",
            status: "completed",
            createdBy: owner.id,
            price: "15.00",
          },
          {
            organizationId: orgId,
            title: "Session C",
            dateTime: daysAgo(3),
            maxCapacity: 4,
            maxWaitlist: 2,
            joinMode: "open",
            status: "published",
            createdBy: owner.id,
            price: "20.00",
          },
          {
            organizationId: orgId,
            title: "Cancelled Session",
            dateTime: daysAgo(2),
            maxCapacity: 4,
            maxWaitlist: 0,
            joinMode: "open",
            status: "cancelled",
            createdBy: owner.id,
            price: "100.00",
          },
        ])
        .returning()

    const [otherOrgSession] = await db
      .insert(eventSession)
      .values({
        organizationId: otherOrgId,
        title: "Other Org Session",
        dateTime: daysAgo(4),
        maxCapacity: 1,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: otherOrgUser.id,
        price: "999.00",
      })
      .returning()

    await db.insert(participation).values([
      // Previous period attendance (retention baseline)
      {
        sessionId: previousPeriodSession.id,
        userId: memberA.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },
      {
        sessionId: previousPeriodSession.id,
        userId: memberC.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },
      {
        sessionId: previousPeriodSession.id,
        userId: owner.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },

      // Current period - Session A
      {
        sessionId: sessionA.id,
        userId: memberA.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },
      {
        sessionId: sessionA.id,
        userId: memberB.id,
        status: "joined",
        attendance: "no_show",
        payment: "unpaid",
      },
      {
        sessionId: sessionA.id,
        userId: memberC.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },
      {
        sessionId: sessionA.id,
        userId: memberD.id,
        status: "waitlisted",
        attendance: "pending",
        payment: "unpaid",
      },

      // Current period - Session B
      {
        sessionId: sessionB.id,
        userId: memberA.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },
      {
        sessionId: sessionB.id,
        userId: memberB.id,
        status: "joined",
        attendance: "show",
        payment: "unpaid",
      },

      // Current period - Session C
      {
        sessionId: sessionC.id,
        userId: memberC.id,
        status: "joined",
        attendance: "no_show",
        payment: "unpaid",
      },
      {
        sessionId: sessionC.id,
        userId: memberD.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },
      {
        sessionId: sessionC.id,
        userId: memberB.id,
        status: "waitlisted",
        attendance: "pending",
        payment: "unpaid",
      },

      // Should be excluded (cancelled session)
      {
        sessionId: cancelledSession.id,
        userId: memberA.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },

      // Other org data should not leak into org metrics
      {
        sessionId: otherOrgSession.id,
        userId: otherOrgUser.id,
        status: "joined",
        attendance: "show",
        payment: "paid",
      },
    ])
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({
        organizationIds,
        userIds,
      })
    }

    orgId = ""
    otherOrgId = ""
    emptyOrgId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("computes group health metrics correctly", async () => {
    const stats = await getGroupHealthStats(orgId, 30)

    expect(stats.totalMembers).toBe(5)
    expect(stats.newMembers).toBe(2)
    expect(stats.activeMembers).toBe(4)
    expect(stats.inactiveMembers).toBe(1)
    expect(stats.retentionRate).toBe(67)
    expect(stats.memberGrowth.reduce((sum, point) => sum + point.count, 0)).toBe(2)
  })

  it("computes session performance metrics correctly", async () => {
    const stats = await getSessionPerformanceStats(orgId, 30)

    expect(stats.totalSessions).toBe(3)
    expect(stats.avgCapacityUtilization).toBe(35)
    expect(stats.avgNoShowRate).toBe(28)
    expect(stats.topSessions[0]?.fillRate).toBe(50)
    expect(stats.topSessions[0]?.title).toBe("Session C")
  })

  it("computes attendance pattern metrics correctly", async () => {
    const stats = await getAttendancePatternStats(orgId, 30)

    expect(stats.overallShowRate).toBe(71)
    expect(stats.repeatRate).toBe(25)
    expect(stats.topAttendees[0]?.userId).toBe(memberA.id)
    expect(stats.topAttendees[0]?.count).toBe(2)
    expect(stats.peakDays.reduce((sum, row) => sum + row.count, 0)).toBe(5)
  })

  it("computes revenue metrics correctly", async () => {
    const stats = await getRevenueStats(orgId, 30)

    expect(stats.totalRevenue).toBe(55)
    expect(stats.avgRevenuePerSession).toBe(18.33)
    expect(stats.collectionRate).toBe(57)
    expect(stats.outstandingCount).toBe(3)
    expect(stats.outstandingAmount).toBe(45)
    expect(stats.currency).toBe("USD")
  })

  it("computes summary metrics correctly", async () => {
    const summary = await getAnalyticsSummary(orgId, 30)

    expect(summary.totalMembers).toBe(5)
    expect(summary.avgCapacityUtilization).toBe(35)
    expect(summary.overallShowRate).toBe(71)
    expect(summary.totalRevenue).toBe(55)
    expect(summary.currency).toBe("USD")
  })

  it("returns zeroed metrics for empty organizations", async () => {
    const [group, sessions, attendance, revenue, summary] = await Promise.all([
      getGroupHealthStats(emptyOrgId, 30),
      getSessionPerformanceStats(emptyOrgId, 30),
      getAttendancePatternStats(emptyOrgId, 30),
      getRevenueStats(emptyOrgId, 30),
      getAnalyticsSummary(emptyOrgId, 30),
    ])

    expect(group.totalMembers).toBe(0)
    expect(group.newMembers).toBe(0)
    expect(group.activeMembers).toBe(0)
    expect(group.inactiveMembers).toBe(0)
    expect(group.retentionRate).toBe(0)
    expect(group.memberGrowth).toEqual([])

    expect(sessions.totalSessions).toBe(0)
    expect(sessions.avgCapacityUtilization).toBe(0)
    expect(sessions.avgNoShowRate).toBe(0)
    expect(sessions.capacityTrend).toEqual([])
    expect(sessions.topSessions).toEqual([])

    expect(attendance.overallShowRate).toBe(0)
    expect(attendance.repeatRate).toBe(0)
    expect(attendance.showRateTrend).toEqual([])
    expect(attendance.peakDays).toEqual([])
    expect(attendance.topAttendees).toEqual([])

    expect(revenue.totalRevenue).toBe(0)
    expect(revenue.avgRevenuePerSession).toBe(0)
    expect(revenue.collectionRate).toBe(0)
    expect(revenue.outstandingCount).toBe(0)
    expect(revenue.outstandingAmount).toBe(0)
    expect(revenue.revenueTrend).toEqual([])
    expect(revenue.currency).toBeNull()

    expect(summary.totalMembers).toBe(0)
    expect(summary.avgCapacityUtilization).toBe(0)
    expect(summary.overallShowRate).toBe(0)
    expect(summary.totalRevenue).toBe(0)
    expect(summary.currency).toBeNull()
  })
})

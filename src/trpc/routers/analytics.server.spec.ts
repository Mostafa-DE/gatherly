import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"

function buildCaller(user: User, activeOrganizationId: string | null) {
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

describe("analytics router", () => {
  let organizationId = ""
  let owner!: User
  let memberUser!: User
  let outsiderUser!: User

  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("analytics-router-owner")
    const createdOwner = await createTestUser("Analytics Owner")
    const createdMember = await createTestUser("Analytics Member")
    const createdOutsider = await createTestUser("Analytics Outsider")

    organizationId = organization.id
    owner = createdOwner
    memberUser = createdMember
    outsiderUser = createdOutsider

    organizationIds.push(organizationId)
    userIds.push(owner.id, memberUser.id, outsiderUser.id)

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

  it("allows admins to access all analytics endpoints", async () => {
    const ownerCaller = buildCaller(owner, organizationId)

    const [summary, groupHealth, sessionPerformance, attendancePatterns, revenue] =
      await Promise.all([
        ownerCaller.plugin.analytics.summary({ days: "30" }),
        ownerCaller.plugin.analytics.groupHealth({ days: "30" }),
        ownerCaller.plugin.analytics.sessionPerformance({ days: "30" }),
        ownerCaller.plugin.analytics.attendancePatterns({ days: "30" }),
        ownerCaller.plugin.analytics.revenue({ days: "30" }),
      ])

    expect(summary).toMatchObject({
      totalMembers: expect.any(Number),
      avgCapacityUtilization: expect.any(Number),
      overallShowRate: expect.any(Number),
      totalRevenue: expect.any(Number),
    })

    expect(groupHealth).toMatchObject({
      totalMembers: expect.any(Number),
      newMembers: expect.any(Number),
      activeMembers: expect.any(Number),
      inactiveMembers: expect.any(Number),
      retentionRate: expect.any(Number),
      memberGrowth: expect.any(Array),
    })

    expect(sessionPerformance).toMatchObject({
      totalSessions: expect.any(Number),
      avgCapacityUtilization: expect.any(Number),
      avgNoShowRate: expect.any(Number),
      capacityTrend: expect.any(Array),
      topSessions: expect.any(Array),
    })

    expect(attendancePatterns).toMatchObject({
      overallShowRate: expect.any(Number),
      showRateTrend: expect.any(Array),
      peakDays: expect.any(Array),
      topAttendees: expect.any(Array),
      repeatRate: expect.any(Number),
    })

    expect(revenue).toMatchObject({
      totalRevenue: expect.any(Number),
      avgRevenuePerSession: expect.any(Number),
      collectionRate: expect.any(Number),
      outstandingCount: expect.any(Number),
      outstandingAmount: expect.any(Number),
      revenueTrend: expect.any(Array),
    })
  })

  it("forbids non-admin members from accessing analytics", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.plugin.analytics.summary({ days: "30" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("rejects org procedures when active organization is missing", async () => {
    const ownerWithoutActiveOrg = buildCaller(owner, null)

    await expect(
      ownerWithoutActiveOrg.plugin.analytics.summary({ days: "30" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects org procedures when caller is not a member of active organization", async () => {
    const outsiderCaller = buildCaller(outsiderUser, organizationId)

    await expect(
      outsiderCaller.plugin.analytics.summary({ days: "30" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

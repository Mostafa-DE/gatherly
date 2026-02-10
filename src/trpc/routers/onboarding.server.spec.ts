import { randomUUID } from "node:crypto"
import { and, eq, inArray } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import {
  interest,
  interestCategory,
  organizationInterest,
  user,
  userInterest,
} from "@/db/schema"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"

function buildCaller(userData: User, activeOrganizationId: string | null = null) {
  const authSession: Session = {
    id: `sess_${randomUUID().replaceAll("-", "")}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    token: `token_${randomUUID().replaceAll("-", "")}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
    userId: userData.id,
    activeOrganizationId,
  }

  return appRouter.createCaller(
    createTRPCContext({ user: userData, session: authSession })
  )
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`
}

describe("onboarding router", () => {
  let orgId = ""
  let otherOrgId = ""
  let owner!: User
  let memberUser!: User
  let standaloneUser!: User
  let categoryId = ""
  let interestAId = ""
  let interestBId = ""
  let interestCId = ""

  const organizationIds: string[] = []
  const userIds: string[] = []
  const categoryIds: string[] = []

  beforeEach(async () => {
    const org = await createTestOrganization("owner-main")
    const otherOrg = await createTestOrganization("owner-other")
    const ownerUser = await createTestUser("Owner")
    const memberOnlyUser = await createTestUser("Member")
    const standalone = await createTestUser("Standalone")

    orgId = org.id
    otherOrgId = otherOrg.id
    owner = ownerUser
    memberUser = memberOnlyUser
    standaloneUser = standalone

    organizationIds.push(orgId, otherOrgId)
    userIds.push(owner.id, memberUser.id, standaloneUser.id)

    await createTestMembership({
      organizationId: orgId,
      userId: owner.id,
      role: "owner",
    })

    await createTestMembership({
      organizationId: orgId,
      userId: memberUser.id,
      role: "member",
    })

    categoryId = createId("cat")
    interestAId = createId("interest")
    interestBId = createId("interest")
    interestCId = createId("interest")
    categoryIds.push(categoryId)

    await db.insert(interestCategory).values({
      id: categoryId,
      name: `Category ${categoryId}`,
      slug: `category-${categoryId.toLowerCase()}`,
      displayOrder: 1,
    })

    await db.insert(interest).values([
      {
        id: interestAId,
        categoryId,
        name: `Interest ${interestAId}`,
        slug: `interest-${interestAId.toLowerCase()}`,
      },
      {
        id: interestBId,
        categoryId,
        name: `Interest ${interestBId}`,
        slug: `interest-${interestBId.toLowerCase()}`,
      },
      {
        id: interestCId,
        categoryId,
        name: `Interest ${interestCId}`,
        slug: `interest-${interestCId.toLowerCase()}`,
      },
    ])
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({ organizationIds, userIds })
    }

    if (categoryIds.length > 0) {
      await db
        .delete(interestCategory)
        .where(inArray(interestCategory.id, categoryIds))
    }

    orgId = ""
    otherOrgId = ""
    categoryId = ""
    interestAId = ""
    interestBId = ""
    interestCId = ""
    organizationIds.length = 0
    userIds.length = 0
    categoryIds.length = 0
  })

  it("updates intent/city/timezone and marks onboarding as completed", async () => {
    const caller = buildCaller(standaloneUser)

    const result = await caller.onboarding.complete({
      intent: "join",
      country: "JO",
      city: "Amman",
      timezone: "Asia/Amman",
    })

    expect(result.success).toBe(true)

    const [updatedUser] = await db
      .select({
        intent: user.intent,
        country: user.country,
        city: user.city,
        timezone: user.timezone,
        onboardingCompleted: user.onboardingCompleted,
      })
      .from(user)
      .where(eq(user.id, standaloneUser.id))
      .limit(1)

    expect(updatedUser).toMatchObject({
      intent: "join",
      country: "JO",
      city: "Amman",
      timezone: "Asia/Amman",
      onboardingCompleted: true,
    })
  })

  it("saves and returns user interests", async () => {
    const caller = buildCaller(standaloneUser)

    await caller.onboarding.saveInterests({
      interestIds: [interestAId, interestBId],
    })

    const interests = await caller.onboarding.getUserInterests()
    expect(interests.sort()).toEqual([interestAId, interestBId].sort())

    const storedRows = await db
      .select({ interestId: userInterest.interestId })
      .from(userInterest)
      .where(eq(userInterest.userId, standaloneUser.id))

    expect(storedRows.map((row) => row.interestId).sort()).toEqual(
      [interestAId, interestBId].sort()
    )
  })

  it("forbids non-admin members from setting organization interests", async () => {
    const memberCaller = buildCaller(memberUser, orgId)

    await expect(
      memberCaller.onboarding.setOrganizationInterests({
        interestIds: [interestAId],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("scopes organization interests to active organization", async () => {
    await db.insert(organizationInterest).values([
      { organizationId: orgId, interestId: interestAId },
      { organizationId: otherOrgId, interestId: interestCId },
    ])

    const ownerCaller = buildCaller(owner, orgId)
    const scopedInterests = await ownerCaller.onboarding.getOrganizationInterests()

    expect(scopedInterests).toEqual([interestAId])

    await ownerCaller.onboarding.setOrganizationInterests({
      interestIds: [interestBId],
    })

    const orgRows = await db
      .select({ interestId: organizationInterest.interestId })
      .from(organizationInterest)
      .where(eq(organizationInterest.organizationId, orgId))

    const otherOrgRows = await db
      .select({ interestId: organizationInterest.interestId })
      .from(organizationInterest)
      .where(eq(organizationInterest.organizationId, otherOrgId))

    expect(orgRows.map((row) => row.interestId)).toEqual([interestBId])
    expect(otherOrgRows.map((row) => row.interestId)).toEqual([interestCId])
  })

  it("rejects org-scoped onboarding procedures when active org is missing", async () => {
    const ownerWithoutActiveOrg = buildCaller(owner)

    await expect(
      ownerWithoutActiveOrg.onboarding.getOrganizationInterests()
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects org-scoped onboarding procedures when user is not a member of active org", async () => {
    const standaloneCaller = buildCaller(standaloneUser, orgId)

    await expect(
      standaloneCaller.onboarding.getOrganizationInterests()
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"

describe("organization router", () => {
  let orgId = ""
  let otherOrgId = ""
  let ownerUsername = "public-owner"
  let groupSlug = ""
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const org = await createTestOrganization(ownerUsername)
    const otherOrg = await createTestOrganization("other-owner")
    const owner = await createTestUser("Owner")
    const member = await createTestUser("Member")
    const external = await createTestUser("External")

    orgId = org.id
    otherOrgId = otherOrg.id
    groupSlug = org.userSlug

    organizationIds.push(orgId, otherOrgId)
    userIds.push(owner.id, member.id, external.id)

    await createTestMembership({
      organizationId: orgId,
      userId: owner.id,
      role: "owner",
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
    expect(result.memberCount).toBe(2)
  })
})

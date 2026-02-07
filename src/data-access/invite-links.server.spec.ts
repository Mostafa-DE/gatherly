import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  createInviteLink,
  deactivateInviteLink,
  getValidInviteLinkByToken,
  incrementUsedCount,
  listInviteLinks,
} from "@/data-access/invite-links"
import { db } from "@/db"
import { inviteLink } from "@/db/schema"
import {
  cleanupTestData,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"

describe("invite-links data-access", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let ownerId = ""
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("owner-one")
    const otherOrganization = await createTestOrganization("owner-two")
    const owner = await createTestUser("Invite Link Owner")

    organizationId = organization.id
    otherOrganizationId = otherOrganization.id
    ownerId = owner.id

    organizationIds.push(organizationId, otherOrganizationId)
    userIds.push(ownerId)
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
    ownerId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("returns link only when token is active, not expired, and below max uses", async () => {
    const valid = await createInviteLink(organizationId, ownerId, {
      role: "member",
    })
    const expired = await createInviteLink(organizationId, ownerId, {
      role: "member",
      expiresAt: new Date(Date.now() - 60_000),
    })
    const maxed = await createInviteLink(organizationId, ownerId, {
      role: "member",
      maxUses: 1,
    })
    const inactive = await createInviteLink(organizationId, ownerId, {
      role: "member",
    })

    await incrementUsedCount(maxed.id)
    await deactivateInviteLink(inactive.id, organizationId)

    await expect(getValidInviteLinkByToken(valid.token)).resolves.toMatchObject({
      id: valid.id,
    })
    await expect(getValidInviteLinkByToken(expired.token)).resolves.toBeNull()
    await expect(getValidInviteLinkByToken(maxed.token)).resolves.toBeNull()
    await expect(getValidInviteLinkByToken(inactive.token)).resolves.toBeNull()
  })

  it("increments used count and lists links for one organization only", async () => {
    const first = await createInviteLink(organizationId, ownerId, {
      role: "member",
    })
    await createInviteLink(otherOrganizationId, ownerId, {
      role: "member",
    })

    await incrementUsedCount(first.id)
    await incrementUsedCount(first.id)

    const scoped = await listInviteLinks(organizationId)
    expect(scoped).toHaveLength(1)
    expect(scoped[0]?.id).toBe(first.id)

    const [reloaded] = await db
      .select()
      .from(inviteLink)
      .where(eq(inviteLink.id, first.id))
      .limit(1)

    expect(reloaded?.usedCount).toBe(2)
  })

  it("deactivates only links that belong to the provided organization", async () => {
    const link = await createInviteLink(organizationId, ownerId, {
      role: "member",
    })

    const wrongOrgResult = await deactivateInviteLink(link.id, otherOrganizationId)
    expect(wrongOrgResult).toBeNull()

    const deactivated = await deactivateInviteLink(link.id, organizationId)
    expect(deactivated?.isActive).toBe(false)

    const [stored] = await db
      .select()
      .from(inviteLink)
      .where(
        and(
          eq(inviteLink.id, link.id),
          eq(inviteLink.organizationId, organizationId)
        )
      )
      .limit(1)

    expect(stored?.isActive).toBe(false)
  })
})

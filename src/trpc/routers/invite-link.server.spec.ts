import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { auth } from "@/auth"
import { db } from "@/db"
import { groupMemberProfile, inviteLink, member } from "@/db/schema"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"

function buildCaller(user: User, activeOrganizationId: string | null = null) {
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

describe("invite-link router", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  let invitee!: User
  let secondInvitee!: User
  let existingMemberUser!: User
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("owner-main")
    const otherOrganization = await createTestOrganization("owner-other")
    const ownerUser = await createTestUser("Owner")
    const adminUser = await createTestUser("Admin")
    const memberOnlyUser = await createTestUser("Member")
    const inviteeUser = await createTestUser("Invitee")
    const secondInviteeUser = await createTestUser("Invitee 2")
    const existingMember = await createTestUser("Existing Member")

    organizationId = organization.id
    otherOrganizationId = otherOrganization.id
    owner = ownerUser
    admin = adminUser
    memberUser = memberOnlyUser
    invitee = inviteeUser
    secondInvitee = secondInviteeUser
    existingMemberUser = existingMember

    organizationIds.push(organizationId, otherOrganizationId)
    userIds.push(
      owner.id,
      admin.id,
      memberUser.id,
      invitee.id,
      secondInvitee.id,
      existingMemberUser.id
    )

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
      userId: existingMemberUser.id,
      role: "member",
    })
    await createTestMembership({
      organizationId: otherOrganizationId,
      userId: admin.id,
      role: "admin",
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

    organizationId = ""
    otherOrganizationId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("allows admins to create/list links and rejects members", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const memberCaller = buildCaller(memberUser, organizationId)

    await expect(
      memberCaller.inviteLink.create({
        role: "member",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    const created = await ownerCaller.inviteLink.create({
      role: "admin",
      maxUses: 5,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })

    expect(created.organizationId).toBe(organizationId)
    expect(created.createdBy).toBe(owner.id)
    expect(created.role).toBe("admin")
    expect(created.maxUses).toBe(5)

    const listed = await ownerCaller.inviteLink.list()
    expect(listed.some((item) => item.id === created.id)).toBe(true)
  })

  it("deactivates in-scope links and rejects cross-org deactivation", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const otherOrgAdminCaller = buildCaller(admin, otherOrganizationId)

    const link = await ownerCaller.inviteLink.create({
      role: "member",
    })

    await expect(
      otherOrgAdminCaller.inviteLink.deactivate({
        inviteLinkId: link.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const deactivated = await ownerCaller.inviteLink.deactivate({
      inviteLinkId: link.id,
    })
    expect(deactivated.isActive).toBe(false)

    const validateResult = await ownerCaller.inviteLink.validate({
      token: link.token,
    })
    expect(validateResult.valid).toBe(false)
  })

  it("validates active token and rejects expired or exhausted links", async () => {
    const ownerCaller = buildCaller(owner, organizationId)

    const activeLink = await ownerCaller.inviteLink.create({
      role: "member",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const expiredLink = await ownerCaller.inviteLink.create({
      role: "member",
      expiresAt: new Date(Date.now() - 60 * 1000),
    })
    const exhaustedLink = await ownerCaller.inviteLink.create({
      role: "member",
      maxUses: 1,
    })

    await db
      .update(inviteLink)
      .set({ usedCount: 1 })
      .where(eq(inviteLink.id, exhaustedLink.id))

    await expect(
      ownerCaller.inviteLink.validate({
        token: activeLink.token,
      })
    ).resolves.toEqual({ valid: true })

    await expect(
      ownerCaller.inviteLink.validate({
        token: expiredLink.token,
      })
    ).resolves.toEqual({ valid: false })

    await expect(
      ownerCaller.inviteLink.validate({
        token: exhaustedLink.token,
      })
    ).resolves.toEqual({ valid: false })
  })

  it("uses token to add membership, persist answers, and increment used count", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const inviteeCaller = buildCaller(invitee)

    const link = await ownerCaller.inviteLink.create({
      role: "member",
      maxUses: 2,
    })

    const addMemberImpl = async (ctx: unknown) => {
      const { body } = ctx as { body: { organizationId: string; userId: string; role: string } }
      await db.insert(member).values({
        id: `mem_${randomUUID().replaceAll("-", "")}`,
        organizationId: body.organizationId,
        userId: body.userId,
        role: body.role as "member" | "admin" | "owner",
        createdAt: new Date(),
      })

      return undefined as never
    }

    const addMemberSpy = vi
      .spyOn(auth.api, "addMember")
      .mockImplementation(addMemberImpl as unknown as typeof auth.api.addMember)

    const result = await inviteeCaller.inviteLink.useToken({
      token: link.token,
      formAnswers: {
        motivation: "I want to join",
      },
    })

    expect(result.organizationId).toBe(organizationId)
    expect(addMemberSpy).toHaveBeenCalledTimes(1)

    const [createdMembership] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.userId, invitee.id)
        )
      )
      .limit(1)

    expect(createdMembership?.role).toBe("member")

    const [profile] = await db
      .select()
      .from(groupMemberProfile)
      .where(
        and(
          eq(groupMemberProfile.organizationId, organizationId),
          eq(groupMemberProfile.userId, invitee.id)
        )
      )
      .limit(1)

    expect(profile?.answers).toEqual({
      motivation: "I want to join",
    })

    const [usedLink] = await db
      .select()
      .from(inviteLink)
      .where(eq(inviteLink.id, link.id))
      .limit(1)

    expect(usedLink?.usedCount).toBe(1)
  })

  it("rejects using a deactivated link token", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const inviteeCaller = buildCaller(invitee)

    const link = await ownerCaller.inviteLink.create({
      role: "member",
      maxUses: 1,
    })

    await ownerCaller.inviteLink.deactivate({
      inviteLinkId: link.id,
    })

    const addMemberSpy = vi.spyOn(auth.api, "addMember")

    await expect(
      inviteeCaller.inviteLink.useToken({
        token: link.token,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })

    const [linkAfterAttempt] = await db
      .select({ usedCount: inviteLink.usedCount })
      .from(inviteLink)
      .where(eq(inviteLink.id, link.id))
      .limit(1)

    expect(linkAfterAttempt?.usedCount).toBe(0)
    expect(addMemberSpy).not.toHaveBeenCalled()
  })

  it("enforces maxUses and rejects a second redemption", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const firstInviteeCaller = buildCaller(invitee)
    const secondInviteeCaller = buildCaller(secondInvitee)

    const link = await ownerCaller.inviteLink.create({
      role: "member",
      maxUses: 1,
    })

    const addMemberImpl = async (ctx: unknown) => {
      const { body } = ctx as { body: { organizationId: string; userId: string; role: string } }
      await db.insert(member).values({
        id: `mem_${randomUUID().replaceAll("-", "")}`,
        organizationId: body.organizationId,
        userId: body.userId,
        role: body.role as "member" | "admin" | "owner",
        createdAt: new Date(),
      })

      return undefined as never
    }

    const addMemberSpy = vi
      .spyOn(auth.api, "addMember")
      .mockImplementation(addMemberImpl as unknown as typeof auth.api.addMember)

    await firstInviteeCaller.inviteLink.useToken({
      token: link.token,
    })

    await expect(
      secondInviteeCaller.inviteLink.useToken({
        token: link.token,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })

    const [linkAfterSecondAttempt] = await db
      .select({ usedCount: inviteLink.usedCount })
      .from(inviteLink)
      .where(eq(inviteLink.id, link.id))
      .limit(1)

    expect(linkAfterSecondAttempt?.usedCount).toBe(1)
    expect(addMemberSpy).toHaveBeenCalledTimes(1)
  })

  it("rejects token usage for invalid token, exhausted token, and existing members", async () => {
    const ownerCaller = buildCaller(owner, organizationId)
    const inviteeCaller = buildCaller(invitee)
    const existingMemberCaller = buildCaller(existingMemberUser)

    const exhaustedLink = await ownerCaller.inviteLink.create({
      role: "member",
      maxUses: 1,
    })
    const regularLink = await ownerCaller.inviteLink.create({
      role: "member",
    })

    await db
      .update(inviteLink)
      .set({ usedCount: 1 })
      .where(eq(inviteLink.id, exhaustedLink.id))

    const addMemberSpy = vi.spyOn(auth.api, "addMember")

    await expect(
      inviteeCaller.inviteLink.useToken({
        token: "missing-token",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })

    await expect(
      inviteeCaller.inviteLink.useToken({
        token: exhaustedLink.token,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })

    await expect(
      existingMemberCaller.inviteLink.useToken({
        token: regularLink.token,
      })
    ).rejects.toMatchObject({ code: "CONFLICT" })

    const [regularLinkAfterConflict] = await db
      .select({ usedCount: inviteLink.usedCount })
      .from(inviteLink)
      .where(eq(inviteLink.id, regularLink.id))
      .limit(1)

    expect(regularLinkAfterConflict?.usedCount).toBe(0)

    expect(addMemberSpy).not.toHaveBeenCalled()
  })
})

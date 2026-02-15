import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { eq } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/db"
import { invitation, user } from "@/db/auth-schema"
import type { Session, User } from "@/db/types"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { createTRPCContext } from "@/trpc/context"
import { appRouter } from "@/trpc/routers/_app"

function createToken(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`
}

function buildCaller(user: User, activeOrganizationId: string | null = null) {
  const authSession: Session = {
    id: createToken("sess"),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    token: createToken("token"),
    createdAt: new Date(),
    updatedAt: new Date(),
    ipAddress: null,
    userAgent: null,
    userId: user.id,
    activeOrganizationId,
  }

  return appRouter.createCaller(createTRPCContext({ user, session: authSession }))
}

describe("user router", () => {
  let currentUser!: User
  let otherUser!: User
  let inviterUser!: User
  let firstOrganizationId = ""
  let secondOrganizationId = ""
  const organizationIds: string[] = []
  const userIds: string[] = []

  async function createInvitationFixture(input?: {
    organizationId?: string
    email?: string
    status?: "pending" | "accepted" | "rejected" | "canceled"
    expiresAt?: Date
  }) {
    const [createdInvitation] = await db
      .insert(invitation)
      .values({
        id: createToken("inv"),
        organizationId: input?.organizationId ?? firstOrganizationId,
        email: input?.email ?? currentUser.email,
        role: "member",
        status: input?.status ?? "pending",
        expiresAt: input?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
        inviterId: inviterUser.id,
      })
      .returning()

    return createdInvitation
  }

  beforeEach(async () => {
    currentUser = await createTestUser("Current User")
    otherUser = await createTestUser("Other User")
    inviterUser = await createTestUser("Inviter User")
    const validUsername = `member${randomUUID().replaceAll("-", "").slice(0, 10)}`

    const firstOrganization = await createTestOrganization("owner-one")
    const secondOrganization = await createTestOrganization("owner-two")

    firstOrganizationId = firstOrganization.id
    secondOrganizationId = secondOrganization.id

    organizationIds.push(firstOrganizationId, secondOrganizationId)
    userIds.push(currentUser.id, otherUser.id, inviterUser.id)

    await db
      .update(user)
      .set({ username: validUsername })
      .where(eq(user.id, currentUser.id))
    currentUser = {
      ...currentUser,
      username: validUsername,
    }

    await createTestMembership({
      organizationId: firstOrganizationId,
      userId: currentUser.id,
      role: "owner",
    })
    await createTestMembership({
      organizationId: secondOrganizationId,
      userId: currentUser.id,
      role: "member",
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

    firstOrganizationId = ""
    secondOrganizationId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("returns current user from me", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)

    const result = await caller.user.me()

    expect(result.id).toBe(currentUser.id)
    expect(result.email).toBe(currentUser.email)
  })

  it("returns null active organization and membership in whoami when no active org is selected", async () => {
    const caller = buildCaller(currentUser)

    const result = await caller.user.whoami()

    expect(result.user.id).toBe(currentUser.id)
    expect(result.activeOrganization).toBeNull()
    expect(result.membership).toBeNull()
  })

  it("returns active organization and membership in whoami when active org is selected", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)

    const result = await caller.user.whoami()

    expect(result.user.id).toBe(currentUser.id)
    expect(result.activeOrganization?.id).toBe(firstOrganizationId)
    expect(result.membership?.organizationId).toBe(firstOrganizationId)
    expect(result.membership?.role).toBe("owner")
  })

  it("returns all memberships in myOrgs", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)

    const result = await caller.user.myOrgs()

    expect(result).toHaveLength(2)
    expect(result.some((row) => row.organization.id === firstOrganizationId)).toBe(true)
    expect(result.some((row) => row.organization.id === secondOrganizationId)).toBe(true)
    expect(
      result.find((row) => row.organization.id === firstOrganizationId)?.role
    ).toBe("owner")
    expect(
      result.find((row) => row.organization.id === secondOrganizationId)?.role
    ).toBe("member")
  })

  it("returns username availability for taken and available usernames", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    if (!currentUser.username) {
      throw new Error("Expected current user username to exist")
    }

    await expect(
      publicCaller.user.checkUsernameAvailable({
        username: currentUser.username,
      })
    ).resolves.toEqual({ available: false })

    await expect(
      publicCaller.user.checkUsernameAvailable({
        username: `fresh-${randomUUID().slice(0, 8)}`,
      })
    ).resolves.toEqual({ available: true })
  })

  it("scopes listMyInvitations to caller email and pending invitations", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)

    const pendingOwnFirstOrg = await createInvitationFixture({
      organizationId: firstOrganizationId,
      email: currentUser.email,
      status: "pending",
    })
    const pendingOwnSecondOrg = await createInvitationFixture({
      organizationId: secondOrganizationId,
      email: currentUser.email,
      status: "pending",
    })
    const pendingOtherEmail = await createInvitationFixture({
      organizationId: firstOrganizationId,
      email: otherUser.email,
      status: "pending",
    })
    const acceptedOwnInvitation = await createInvitationFixture({
      organizationId: firstOrganizationId,
      email: currentUser.email,
      status: "accepted",
    })

    const result = await caller.user.listMyInvitations()
    const returnedInvitationIds = result.map((row) => row.invitation.id)

    expect(result).toHaveLength(2)
    expect(returnedInvitationIds).toContain(pendingOwnFirstOrg.id)
    expect(returnedInvitationIds).toContain(pendingOwnSecondOrg.id)
    expect(returnedInvitationIds).not.toContain(pendingOtherEmail.id)
    expect(returnedInvitationIds).not.toContain(acceptedOwnInvitation.id)
  })

  it("accepts invitation for matching pending invitation", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const pendingInvitation = await createInvitationFixture({
      organizationId: firstOrganizationId,
      email: currentUser.email,
      status: "pending",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    const acceptInvitationSpy = vi
      .spyOn(auth.api, "acceptInvitation")
      .mockImplementation(async () => undefined as never)

    const result = await caller.user.acceptInvitation({
      invitationId: pendingInvitation.id,
    })

    expect(result).toEqual({ success: true })
    expect(acceptInvitationSpy).toHaveBeenCalledTimes(1)
    expect(acceptInvitationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          invitationId: pendingInvitation.id,
        },
      })
    )
  })

  it("rejects accepting a missing invitation", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const acceptInvitationSpy = vi.spyOn(auth.api, "acceptInvitation")

    await expect(
      caller.user.acceptInvitation({
        invitationId: createToken("missing"),
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
    expect(acceptInvitationSpy).not.toHaveBeenCalled()
  })

  it("rejects accepting invitation addressed to another email", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const wrongEmailInvitation = await createInvitationFixture({
      email: otherUser.email,
      status: "pending",
    })
    const acceptInvitationSpy = vi.spyOn(auth.api, "acceptInvitation")

    await expect(
      caller.user.acceptInvitation({
        invitationId: wrongEmailInvitation.id,
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
    expect(acceptInvitationSpy).not.toHaveBeenCalled()
  })

  it("rejects accepting invitation when status is not pending", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const acceptedInvitation = await createInvitationFixture({
      status: "accepted",
    })
    const acceptInvitationSpy = vi.spyOn(auth.api, "acceptInvitation")

    await expect(
      caller.user.acceptInvitation({
        invitationId: acceptedInvitation.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invitation is no longer valid",
    })
    expect(acceptInvitationSpy).not.toHaveBeenCalled()
  })

  it("rejects accepting expired invitation", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const expiredInvitation = await createInvitationFixture({
      status: "pending",
      expiresAt: new Date(Date.now() - 60 * 1000),
    })
    const acceptInvitationSpy = vi.spyOn(auth.api, "acceptInvitation")

    await expect(
      caller.user.acceptInvitation({
        invitationId: expiredInvitation.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invitation has expired",
    })
    expect(acceptInvitationSpy).not.toHaveBeenCalled()
  })

  it("rejects invitation for matching pending invitation", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const pendingInvitation = await createInvitationFixture({
      organizationId: firstOrganizationId,
      email: currentUser.email,
      status: "pending",
    })
    const rejectInvitationSpy = vi
      .spyOn(auth.api, "rejectInvitation")
      .mockImplementation(async () => undefined as never)

    const result = await caller.user.rejectInvitation({
      invitationId: pendingInvitation.id,
    })

    expect(result).toEqual({ success: true })
    expect(rejectInvitationSpy).toHaveBeenCalledTimes(1)
    expect(rejectInvitationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          invitationId: pendingInvitation.id,
        },
      })
    )
  })

  it("rejects rejectInvitation when invitation is missing", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const rejectInvitationSpy = vi.spyOn(auth.api, "rejectInvitation")

    await expect(
      caller.user.rejectInvitation({
        invitationId: createToken("missing"),
      })
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Invitation not found",
    })
    expect(rejectInvitationSpy).not.toHaveBeenCalled()
  })

  it("rejects rejectInvitation when invitation is not pending", async () => {
    const caller = buildCaller(currentUser, firstOrganizationId)
    const canceledInvitation = await createInvitationFixture({
      status: "canceled",
    })
    const rejectInvitationSpy = vi.spyOn(auth.api, "rejectInvitation")

    await expect(
      caller.user.rejectInvitation({
        invitationId: canceledInvitation.id,
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Invitation is no longer valid",
    })
    expect(rejectInvitationSpy).not.toHaveBeenCalled()
  })

  it("requires username before createOrg", async () => {
    const userWithoutUsername: User = { ...currentUser, username: null }
    const caller = buildCaller(userWithoutUsername, firstOrganizationId)
    const createOrganizationSpy = vi.spyOn(auth.api, "createOrganization")

    await expect(
      caller.user.createOrg({
        name: "No Username Org",
        slug: "no-username-org",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Please complete onboarding before creating an organization",
    })
    expect(createOrganizationSpy).not.toHaveBeenCalled()
  })

  it("creates organization when username exists", async () => {
    if (!currentUser.username) {
      throw new Error("Expected current user username to exist")
    }

    const caller = buildCaller(currentUser, firstOrganizationId)
    const createdOrganizationId = createToken("org")
    const createOrganizationSpy = vi
      .spyOn(auth.api, "createOrganization")
      .mockImplementation(async () =>
        ({
          id: createdOrganizationId,
          name: "Created Organization",
        } as never)
      )

    const result = await caller.user.createOrg({
      name: "Created Organization",
      slug: "created-organization",
      timezone: "UTC",
      defaultJoinMode: "open",
    })

    expect(result.id).toBe(createdOrganizationId)
    expect(createOrganizationSpy).toHaveBeenCalledTimes(1)
    expect(createOrganizationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          name: "Created Organization",
          slug: `${currentUser.username}-created-organization`,
          timezone: "UTC",
          defaultJoinMode: "open",
          userSlug: "created-organization",
          ownerUsername: currentUser.username,
        }),
      })
    )
  })
})

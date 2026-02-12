import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import { eventSession, memberNote, participation } from "@/db/schema"
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

describe("security isolation regressions", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let owner!: User
  let admin!: User
  let memberUser!: User
  let participantUser!: User
  let sessionId = ""
  let crossOrgNoteId = ""
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("security-owner")
    const otherOrganization = await createTestOrganization("security-other-owner")
    const ownerUser = await createTestUser("Security Owner")
    const adminUser = await createTestUser("Security Admin")
    const member = await createTestUser("Security Member")
    const participant = await createTestUser("Security Participant")

    organizationId = organization.id
    otherOrganizationId = otherOrganization.id
    owner = ownerUser
    admin = adminUser
    memberUser = member
    participantUser = participant

    organizationIds.push(organizationId, otherOrganizationId)
    userIds.push(owner.id, admin.id, memberUser.id, participantUser.id)

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
      userId: participantUser.id,
      role: "member",
    })
    await createTestMembership({
      organizationId: otherOrganizationId,
      userId: admin.id,
      role: "admin",
    })

    const [createdSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        title: "Security Session",
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        maxCapacity: 10,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: owner.id,
      })
      .returning({ id: eventSession.id })
    sessionId = createdSession.id

    await db.insert(participation).values({
      sessionId,
      userId: participantUser.id,
      status: "joined",
      attendance: "pending",
      payment: "unpaid",
    })

    const [createdNote] = await db
      .insert(memberNote)
      .values({
        organizationId: otherOrganizationId,
        targetUserId: participantUser.id,
        authorUserId: admin.id,
        content: "Cross org note",
      })
      .returning({ id: memberNote.id })
    crossOrgNoteId = createdNote.id
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
    sessionId = ""
    crossOrgNoteId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("returns only public fields from user.getById", async () => {
    const publicCaller = appRouter.createCaller(createTRPCContext({}))

    const result = await publicCaller.user.getById({ id: participantUser.id })

    expect(result).toEqual({
      id: participantUser.id,
      name: participantUser.name,
      image: participantUser.image,
      username: participantUser.username,
    })
  })

  it("blocks non-admin users from organization.listMembers", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)
    const adminCaller = buildCaller(admin, organizationId)

    await expect(
      memberCaller.organization.listMembers()
    ).rejects.toMatchObject({ code: "FORBIDDEN" })

    const list = await adminCaller.organization.listMembers()
    expect(list.length).toBeGreaterThan(0)
  })

  it("redacts participant contact info for non-admin users", async () => {
    const memberCaller = buildCaller(memberUser, organizationId)
    const adminCaller = buildCaller(admin, organizationId)

    const memberView = await memberCaller.participation.participants({
      sessionId,
      status: "joined",
      limit: 20,
      offset: 0,
    })
    const adminView = await adminCaller.participation.participants({
      sessionId,
      status: "joined",
      limit: 20,
      offset: 0,
    })

    expect(memberView.length).toBeGreaterThan(0)
    expect(memberView[0]?.user.email).toBe("")
    expect(memberView[0]?.user.phoneNumber).toBe("")

    expect(adminView.length).toBeGreaterThan(0)
    expect(adminView[0]?.user.email).toBe(participantUser.email)
    expect(adminView[0]?.user.phoneNumber).toBe(participantUser.phoneNumber)
  })

  it("enforces organization scope on member note update/delete", async () => {
    const adminOrgOneCaller = buildCaller(admin, organizationId)
    const adminOrgTwoCaller = buildCaller(admin, otherOrganizationId)

    await expect(
      adminOrgOneCaller.memberNote.update({
        noteId: crossOrgNoteId,
        content: "Should fail",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    await expect(
      adminOrgOneCaller.memberNote.delete({
        noteId: crossOrgNoteId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const updated = await adminOrgTwoCaller.memberNote.update({
      noteId: crossOrgNoteId,
      content: "Updated in correct org",
    })
    expect(updated.content).toBe("Updated in correct org")

    await expect(
      adminOrgTwoCaller.memberNote.delete({
        noteId: crossOrgNoteId,
      })
    ).resolves.toEqual({ success: true })
  })
})

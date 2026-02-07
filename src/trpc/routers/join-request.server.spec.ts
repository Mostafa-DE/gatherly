import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { auth } from "@/auth"
import { db } from "@/db"
import { groupMemberProfile, joinRequest, member, organization } from "@/db/schema"
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

describe("join-request router", () => {
  let orgId = ""
  let otherOrgId = ""
  let owner!: User
  let admin!: User
  let requester!: User
  const userIds: string[] = []
  const organizationIds: string[] = []

  beforeEach(async () => {
    const primaryOrg = await createTestOrganization()
    const secondaryOrg = await createTestOrganization()
    const ownerUser = await createTestUser("Owner")
    const adminUser = await createTestUser("Admin")
    const requesterUser = await createTestUser("Requester")

    orgId = primaryOrg.id
    otherOrgId = secondaryOrg.id
    owner = ownerUser
    admin = adminUser
    requester = requesterUser

    organizationIds.push(orgId, otherOrgId)
    userIds.push(owner.id, admin.id, requester.id)

    await db
      .update(organization)
      .set({ defaultJoinMode: "approval" })
      .where(eq(organization.id, orgId))

    await db
      .update(organization)
      .set({ defaultJoinMode: "approval" })
      .where(eq(organization.id, otherOrgId))

    await createTestMembership({
      organizationId: orgId,
      userId: owner.id,
      role: "owner",
    })

    await createTestMembership({
      organizationId: orgId,
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

    orgId = ""
    otherOrgId = ""
    userIds.length = 0
    organizationIds.length = 0
  })

  it("creates a pending request for an approval-based organization", async () => {
    const caller = buildCaller(requester)

    const created = await caller.joinRequest.request({
      organizationId: orgId,
      message: "Please approve",
      formAnswers: {
        experience: "beginner",
      },
    })

    expect(created.organizationId).toBe(orgId)
    expect(created.userId).toBe(requester.id)
    expect(created.status).toBe("pending")
  })

  it("rejects request when organization join mode is open", async () => {
    await db
      .update(organization)
      .set({ defaultJoinMode: "open" })
      .where(eq(organization.id, orgId))

    const caller = buildCaller(requester)

    await expect(
      caller.joinRequest.request({
        organizationId: orgId,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("approves a pending request as admin, adds membership, and stores form answers", async () => {
    const requesterCaller = buildCaller(requester)
    const adminCaller = buildCaller(admin, orgId)

    const addMemberSpy = vi.spyOn(auth.api, "addMember").mockImplementation(
      async ({ body }) => {
        await db.insert(member).values({
          id: `mem_${randomUUID().replaceAll("-", "")}`,
          organizationId: body.organizationId,
          userId: body.userId,
          role: body.role,
          createdAt: new Date(),
        })

        return undefined as never
      }
    )

    const request = await requesterCaller.joinRequest.request({
      organizationId: orgId,
      formAnswers: {
        nickname: "req-user",
      },
    })

    const approved = await adminCaller.joinRequest.approve({
      requestId: request.id,
    })

    expect(approved.status).toBe("approved")
    expect(addMemberSpy).toHaveBeenCalledTimes(1)

    const [createdMembership] = await db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, orgId),
          eq(member.userId, requester.id)
        )
      )
      .limit(1)

    expect(createdMembership?.role).toBe("member")

    const [profile] = await db
      .select()
      .from(groupMemberProfile)
      .where(
        and(
          eq(groupMemberProfile.organizationId, orgId),
          eq(groupMemberProfile.userId, requester.id)
        )
      )
      .limit(1)

    expect(profile?.answers).toEqual({
      nickname: "req-user",
    })
  })

  it("rejects cross-organization approval attempts", async () => {
    const requesterCaller = buildCaller(requester)
    const adminCaller = buildCaller(admin, orgId)

    const request = await requesterCaller.joinRequest.request({
      organizationId: otherOrgId,
      message: "Try other org",
    })

    await expect(
      adminCaller.joinRequest.approve({
        requestId: request.id,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("rejects requests by users who are already members", async () => {
    await createTestMembership({
      organizationId: orgId,
      userId: requester.id,
      role: "member",
    })

    const caller = buildCaller(requester)

    await expect(
      caller.joinRequest.request({
        organizationId: orgId,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("rejects a pending request and marks it as rejected", async () => {
    const requesterCaller = buildCaller(requester)
    const adminCaller = buildCaller(owner, orgId)

    const request = await requesterCaller.joinRequest.request({
      organizationId: orgId,
      message: "Please review",
    })

    const rejected = await adminCaller.joinRequest.reject({
      requestId: request.id,
    })

    expect(rejected.status).toBe("rejected")

    const stored = await db
      .select()
      .from(joinRequest)
      .where(eq(joinRequest.id, request.id))
      .limit(1)

    expect(stored[0]?.status).toBe("rejected")
  })
})

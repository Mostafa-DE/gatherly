import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import { db } from "@/db"
import { activity, eventSession, participation } from "@/db/schema"
import {
  adminAddParticipant,
  approvePendingParticipation,
  bulkUpdateAttendance,
  cancelParticipation,
  getActiveParticipation,
  getParticipationById,
  joinSession,
  moveParticipant,
  rejectPendingParticipation,
} from "@/data-access/participations"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"

describe("participations data-access", () => {
  let organizationId = ""
  let activityId = ""
  const userIds: string[] = []
  let ownerId = ""
  let attendeeAId = ""
  let attendeeBId = ""

  beforeEach(async () => {
    const organization = await createTestOrganization()
    const owner = await createTestUser("Owner")
    const attendeeA = await createTestUser("Attendee A")
    const attendeeB = await createTestUser("Attendee B")

    organizationId = organization.id
    ownerId = owner.id
    attendeeAId = attendeeA.id
    attendeeBId = attendeeB.id
    userIds.push(owner.id, attendeeA.id, attendeeB.id)

    activityId = createId()
    await db.insert(activity).values({
      id: activityId,
      organizationId,
      name: "Test Activity",
      slug: "test-activity",
      joinMode: "open",
      createdBy: ownerId,
    })

    await createTestMembership({
      organizationId: organization.id,
      userId: owner.id,
      role: "owner",
    })

    await createTestMembership({
      organizationId: organization.id,
      userId: attendeeA.id,
      role: "member",
    })

    await createTestMembership({
      organizationId: organization.id,
      userId: attendeeB.id,
      role: "member",
    })
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData({
        organizationIds: [organizationId],
        userIds,
      })
    }

    organizationId = ""
    activityId = ""
    userIds.length = 0
  })

  it("keeps join idempotent and promotes waitlisted user on cancel", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Session A",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 1,
        maxWaitlist: 2,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const firstJoin = await joinSession(session.id, attendeeAId)
    expect(firstJoin.status).toBe("joined")

    const secondJoinSameUser = await joinSession(session.id, attendeeAId)
    expect(secondJoinSameUser.id).toBe(firstJoin.id)

    const waitlistedJoin = await joinSession(session.id, attendeeBId)
    expect(waitlistedJoin.status).toBe("waitlisted")

    await cancelParticipation(firstJoin.id, attendeeAId)

    const cancelled = await getParticipationById(firstJoin.id)
    expect(cancelled?.status).toBe("cancelled")

    const promoted = await getActiveParticipation(session.id, attendeeBId)
    expect(promoted?.status).toBe("joined")
  })

  it("creates pending participation for approval-required sessions", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Approval Required Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 2,
        maxWaitlist: 2,
        joinMode: "approval_required",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const result = await joinSession(session.id, attendeeAId)
    expect(result.status).toBe("pending")
  })

  it("rejects self-join when session is invite-only", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Invite Only Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 2,
        maxWaitlist: 2,
        joinMode: "invite_only",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    await expect(joinSession(session.id, attendeeAId)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("approves pending requests into joined/waitlisted based on capacity", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Approval Queue Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 1,
        maxWaitlist: 1,
        joinMode: "approval_required",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const pendingA = await joinSession(session.id, attendeeAId)
    const pendingB = await joinSession(session.id, attendeeBId)
    expect(pendingA.status).toBe("pending")
    expect(pendingB.status).toBe("pending")

    const approvedA = await approvePendingParticipation(pendingA.id)
    expect(approvedA.status).toBe("joined")

    const approvedB = await approvePendingParticipation(pendingB.id)
    expect(approvedB.status).toBe("waitlisted")
  })

  it("rejects pending request by cancelling participation", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Reject Pending Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 1,
        maxWaitlist: 1,
        joinMode: "approval_required",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const pending = await joinSession(session.id, attendeeAId)
    expect(pending.status).toBe("pending")

    const rejected = await rejectPendingParticipation(pending.id)
    expect(rejected.status).toBe("cancelled")
    expect(rejected.cancelledAt).toBeTruthy()
  })

  it("updates attendance only for participations that belong to the target session", async () => {
    const [sessionA] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Session A",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 3,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const [sessionB] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Session B",
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxCapacity: 3,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const participationA = await joinSession(sessionA.id, attendeeAId)
    const participationB = await joinSession(sessionB.id, attendeeBId)

    await expect(
      bulkUpdateAttendance(sessionA.id, [
        {
          participationId: participationB.id,
          attendance: "show",
        },
      ])
    ).rejects.toMatchObject({ code: "NOT_FOUND" })

    const updatedCount = await bulkUpdateAttendance(sessionA.id, [
      {
        participationId: participationA.id,
        attendance: "show",
      },
    ])
    expect(updatedCount).toBe(1)

    const [updatedRow] = await db
      .select()
      .from(participation)
      .where(eq(participation.id, participationA.id))
      .limit(1)

    expect(updatedRow?.attendance).toBe("show")
  })

  it("adds participants as joined or waitlisted based on capacity and waitlist limits", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Admin Add Capacity",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 1,
        maxWaitlist: 1,
        joinMode: "invite_only",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const first = await adminAddParticipant(session.id, attendeeAId)
    expect(first.status).toBe("joined")

    const second = await adminAddParticipant(session.id, attendeeBId)
    expect(second.status).toBe("waitlisted")
  })

  it("moves participant to target session without auto-promoting source waitlist", async () => {
    const [sourceSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Source Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 1,
        maxWaitlist: 1,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const [targetSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Target Session",
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxCapacity: 2,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const sourceJoined = await joinSession(sourceSession.id, attendeeAId)
    const sourceWaitlisted = await joinSession(sourceSession.id, attendeeBId)
    expect(sourceJoined.status).toBe("joined")
    expect(sourceWaitlisted.status).toBe("waitlisted")

    const moved = await moveParticipant(sourceJoined.id, targetSession.id)
    expect(moved.cancelled.status).toBe("cancelled")
    expect(moved.created.sessionId).toBe(targetSession.id)
    expect(moved.created.status).toBe("joined")

    const sourceWaitlistedAfterMove = await getActiveParticipation(
      sourceSession.id,
      attendeeBId
    )
    expect(sourceWaitlistedAfterMove?.status).toBe("waitlisted")
  })

  it("rolls back move when target session is full", async () => {
    const [sourceSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Source Session Rollback",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 2,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const [targetSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Target Session Full",
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxCapacity: 1,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const sourceParticipation = await joinSession(sourceSession.id, attendeeAId)
    await joinSession(targetSession.id, attendeeBId)

    await expect(
      moveParticipant(sourceParticipation.id, targetSession.id)
    ).rejects.toMatchObject({ code: "CONFLICT" })

    const sourceAfterFailedMove = await getParticipationById(sourceParticipation.id)
    expect(sourceAfterFailedMove?.status).toBe("joined")
  })

  it("moves pending request to another session and auto-confirms as joined when capacity exists", async () => {
    const [sourceSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Source Approval Session",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 10,
        maxWaitlist: 0,
        joinMode: "approval_required",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const [targetSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Target Open Session",
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxCapacity: 2,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const pending = await joinSession(sourceSession.id, attendeeAId)
    expect(pending.status).toBe("pending")

    const moved = await moveParticipant(pending.id, targetSession.id)
    expect(moved.cancelled.status).toBe("cancelled")
    expect(moved.created.sessionId).toBe(targetSession.id)
    expect(moved.created.status).toBe("joined")

    const sourceActiveAfterMove = await getActiveParticipation(
      sourceSession.id,
      attendeeAId
    )
    expect(sourceActiveAfterMove).toBeNull()

    const targetActiveAfterMove = await getActiveParticipation(
      targetSession.id,
      attendeeAId
    )
    expect(targetActiveAfterMove?.status).toBe("joined")
  })

  it("moves pending request to another session and auto-confirms as waitlisted when full", async () => {
    const [sourceSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Source Approval Session Waitlist",
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 10,
        maxWaitlist: 0,
        joinMode: "approval_required",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const [targetSession] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId,
        title: "Target Full Session with Waitlist",
        dateTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        maxCapacity: 1,
        maxWaitlist: 1,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    const pending = await joinSession(sourceSession.id, attendeeAId)
    expect(pending.status).toBe("pending")

    await joinSession(targetSession.id, attendeeBId)

    const moved = await moveParticipant(pending.id, targetSession.id)
    expect(moved.cancelled.status).toBe("cancelled")
    expect(moved.created.sessionId).toBe(targetSession.id)
    expect(moved.created.status).toBe("waitlisted")

    const targetActiveAfterMove = await getActiveParticipation(
      targetSession.id,
      attendeeAId
    )
    expect(targetActiveAfterMove?.status).toBe("waitlisted")
  })
})

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { eventSession, participation } from "@/db/schema"
import {
  bulkUpdateAttendance,
  cancelParticipation,
  getActiveParticipation,
  getParticipationById,
  joinSession,
} from "@/data-access/participations"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"

describe("participations data-access", () => {
  let organizationId = ""
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
    userIds.length = 0
  })

  it("keeps join idempotent and promotes waitlisted user on cancel", async () => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
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

  it("updates attendance only for participations that belong to the target session", async () => {
    const [sessionA] = await db
      .insert(eventSession)
      .values({
        organizationId,
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
})

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createSession, getSessionById, getSessionByIdWithDeleted, softDeleteSession, updateSession, updateSessionStatus } from "@/data-access/sessions"
import {
  cleanupTestData,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"

describe("sessions data-access", () => {
  let organizationId = ""
  let userId = ""

  beforeEach(async () => {
    const organization = await createTestOrganization()
    const user = await createTestUser("Session Owner")

    organizationId = organization.id
    userId = user.id
  })

  afterEach(async () => {
    if (organizationId || userId) {
      await cleanupTestData({
        organizationIds: organizationId ? [organizationId] : [],
        userIds: userId ? [userId] : [],
      })
    }

    organizationId = ""
    userId = ""
  })

  it("allows creating two sessions at the same date and time", async () => {
    const sessionTime = new Date(Date.now() + 2 * 60 * 60 * 1000)

    await createSession(organizationId, userId, {
      title: "Session A",
      dateTime: sessionTime,
      maxCapacity: 10,
      maxWaitlist: 0,
      joinMode: "open",
    })

    await expect(
      createSession(organizationId, userId, {
        title: "Session B",
        dateTime: sessionTime,
        maxCapacity: 10,
        maxWaitlist: 0,
        joinMode: "open",
      })
    ).resolves.toBeTruthy()
  })

  it("allows updating a session to a date and time used by another session", async () => {
    const sessionTime = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const otherTime = new Date(Date.now() + 4 * 60 * 60 * 1000)

    const sessionA = await createSession(organizationId, userId, {
      title: "Session A",
      dateTime: sessionTime,
      maxCapacity: 10,
      maxWaitlist: 0,
      joinMode: "open",
    })

    const sessionB = await createSession(organizationId, userId, {
      title: "Session B",
      dateTime: otherTime,
      maxCapacity: 10,
      maxWaitlist: 0,
      joinMode: "open",
    })

    await expect(
      updateSession(sessionB.id, { dateTime: sessionTime })
    ).resolves.toBeTruthy()

    await expect(
      updateSession(sessionA.id, { dateTime: sessionTime })
    ).resolves.toBeTruthy()
  })

  it("enforces valid session status transitions", async () => {
    const session = await createSession(organizationId, userId, {
      title: "Status Flow",
      dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      maxCapacity: 10,
      maxWaitlist: 0,
      joinMode: "open",
    })

    await expect(
      updateSessionStatus(session.id, "completed")
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })

    const published = await updateSessionStatus(session.id, "published")
    expect(published.status).toBe("published")

    const completed = await updateSessionStatus(session.id, "completed")
    expect(completed.status).toBe("completed")
  })

  it("soft deletes session and excludes it from active lookup", async () => {
    const session = await createSession(organizationId, userId, {
      title: "Soft Delete",
      dateTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
      maxCapacity: 10,
      maxWaitlist: 0,
      joinMode: "open",
    })

    const deleted = await softDeleteSession(session.id)
    expect(deleted.deletedAt).toBeTruthy()

    const activeLookup = await getSessionById(session.id)
    expect(activeLookup).toBeNull()

    const includeDeletedLookup = await getSessionByIdWithDeleted(session.id)
    expect(includeDeletedLookup?.id).toBe(session.id)
    expect(includeDeletedLookup?.deletedAt).toBeTruthy()
  })
})

import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { createSession, updateSession } from "@/data-access/sessions"
import { ConflictError } from "@/exceptions"
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

  it("rejects creating two sessions at the same date and time", async () => {
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
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it("rejects updating a session to a conflicting date and time", async () => {
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
    ).rejects.toBeInstanceOf(ConflictError)

    await expect(
      updateSession(sessionA.id, { dateTime: sessionTime })
    ).resolves.toBeTruthy()
  })
})

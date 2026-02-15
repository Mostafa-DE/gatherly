import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { getActiveActivityMemberIds } from "@/data-access/activity-members"
import {
  cleanupTestData,
  createTestActivity,
  createTestActivityMember,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"

describe("activity-members data-access", () => {
  let organizationId = ""
  let ownerId = ""
  let activityId = ""
  let otherActivityId = ""
  let activeUserId = ""
  let pendingUserId = ""
  let rejectedUserId = ""
  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("activity-members-owner")
    const owner = await createTestUser("Activity Members Owner")
    const activeUser = await createTestUser("Active User")
    const pendingUser = await createTestUser("Pending User")
    const rejectedUser = await createTestUser("Rejected User")

    organizationId = organization.id
    ownerId = owner.id
    activeUserId = activeUser.id
    pendingUserId = pendingUser.id
    rejectedUserId = rejectedUser.id

    organizationIds.push(organizationId)
    userIds.push(ownerId, activeUserId, pendingUserId, rejectedUserId)

    const activity = await createTestActivity({
      organizationId,
      createdBy: ownerId,
      name: "Primary Activity",
    })
    activityId = activity.id

    const otherActivity = await createTestActivity({
      organizationId,
      createdBy: ownerId,
      name: "Secondary Activity",
    })
    otherActivityId = otherActivity.id
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({
        organizationIds,
        userIds,
      })
    }

    organizationId = ""
    ownerId = ""
    activityId = ""
    otherActivityId = ""
    activeUserId = ""
    pendingUserId = ""
    rejectedUserId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("returns only active members from the provided user list", async () => {
    await createTestActivityMember({
      activityId,
      userId: activeUserId,
      status: "active",
    })
    await createTestActivityMember({
      activityId,
      userId: pendingUserId,
      status: "pending",
    })
    await createTestActivityMember({
      activityId,
      userId: rejectedUserId,
      status: "rejected",
    })

    const result = await getActiveActivityMemberIds(activityId, [
      activeUserId,
      pendingUserId,
      rejectedUserId,
      "missing-user",
    ])

    expect(Array.from(result).sort()).toEqual([activeUserId])
  })

  it("returns an empty set when no user IDs are provided", async () => {
    const result = await getActiveActivityMemberIds(activityId, [])

    expect(result.size).toBe(0)
  })

  it("filters by activity and does not return active memberships from other activities", async () => {
    await createTestActivityMember({
      activityId,
      userId: pendingUserId,
      status: "pending",
    })
    await createTestActivityMember({
      activityId: otherActivityId,
      userId: activeUserId,
      status: "active",
    })

    const result = await getActiveActivityMemberIds(activityId, [
      activeUserId,
      pendingUserId,
    ])

    expect(result.size).toBe(0)
  })
})

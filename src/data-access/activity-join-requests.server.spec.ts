import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  approveActivityJoinRequest,
  cancelActivityJoinRequest,
  countPendingActivityRequestsForOrg,
  createActivityJoinRequest,
  getActivityJoinRequestById,
  getActivityJoinRequestByIdForActivity,
  getPendingActivityRequest,
  listAllPendingActivityRequestsForOrg,
  listPendingActivityRequests,
  rejectActivityJoinRequest,
} from "@/data-access/activity-join-requests"
import {
  cleanupTestData,
  createTestActivity,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"

describe("activity-join-requests data-access", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let activityId = ""
  let secondaryActivityId = ""
  let otherOrganizationActivityId = ""
  let requesterId = ""
  let secondRequesterId = ""
  let thirdRequesterId = ""
  let reviewerId = ""

  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization("activity-requests-owner")
    const otherOrganization = await createTestOrganization("activity-requests-other-owner")

    const requester = await createTestUser("Requester One")
    const secondRequester = await createTestUser("Requester Two")
    const thirdRequester = await createTestUser("Requester Three")
    const reviewer = await createTestUser("Reviewer")

    organizationId = organization.id
    otherOrganizationId = otherOrganization.id
    requesterId = requester.id
    secondRequesterId = secondRequester.id
    thirdRequesterId = thirdRequester.id
    reviewerId = reviewer.id

    organizationIds.push(organizationId, otherOrganizationId)
    userIds.push(requesterId, secondRequesterId, thirdRequesterId, reviewerId)

    const activity = await createTestActivity({
      organizationId,
      createdBy: reviewerId,
      name: "Alpha Activity",
      joinMode: "require_approval",
    })

    const secondaryActivity = await createTestActivity({
      organizationId,
      createdBy: reviewerId,
      name: "Beta Activity",
      joinMode: "require_approval",
    })

    const otherOrganizationActivity = await createTestActivity({
      organizationId: otherOrganizationId,
      createdBy: reviewerId,
      name: "Gamma Activity",
      joinMode: "require_approval",
    })

    activityId = activity.id
    secondaryActivityId = secondaryActivity.id
    otherOrganizationActivityId = otherOrganizationActivity.id
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
    activityId = ""
    secondaryActivityId = ""
    otherOrganizationActivityId = ""
    requesterId = ""
    secondRequesterId = ""
    thirdRequesterId = ""
    reviewerId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  it("creates a request and rejects duplicate pending requests with conflict", async () => {
    const first = await createActivityJoinRequest(
      activityId,
      requesterId,
      "I'd like to join",
      { source: "test" }
    )

    expect(first.status).toBe("pending")
    expect(first.activityId).toBe(activityId)
    expect(first.userId).toBe(requesterId)

    await expect(
      createActivityJoinRequest(activityId, requesterId, "duplicate")
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You already have a pending request for this activity",
    })
  })

  it("supports get queries by id, activity scope, and pending status", async () => {
    const request = await createActivityJoinRequest(activityId, requesterId)

    await expect(getActivityJoinRequestById(request.id)).resolves.toMatchObject({
      id: request.id,
      activityId,
      userId: requesterId,
      status: "pending",
    })

    await expect(
      getActivityJoinRequestByIdForActivity(request.id, activityId)
    ).resolves.toMatchObject({ id: request.id })

    await expect(
      getActivityJoinRequestByIdForActivity(request.id, secondaryActivityId)
    ).resolves.toBeNull()

    await expect(getActivityJoinRequestById("missing-request")).resolves.toBeNull()

    await expect(getPendingActivityRequest(activityId, requesterId)).resolves.toMatchObject({
      id: request.id,
      status: "pending",
    })

    await approveActivityJoinRequest(request.id, reviewerId)

    await expect(getPendingActivityRequest(activityId, requesterId)).resolves.toBeNull()
  })

  it("lists pending requests for one activity only", async () => {
    const pendingForTarget = await createActivityJoinRequest(activityId, requesterId)
    const approvedForTarget = await createActivityJoinRequest(activityId, secondRequesterId)
    await createActivityJoinRequest(secondaryActivityId, thirdRequesterId)

    await approveActivityJoinRequest(approvedForTarget.id, reviewerId)

    const rows = await listPendingActivityRequests(activityId)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.request.id).toBe(pendingForTarget.id)
    expect(rows[0]?.request.status).toBe("pending")
    expect(rows[0]?.user.id).toBe(requesterId)
  })

  it("scopes listAllPending and countPending by organization", async () => {
    await createActivityJoinRequest(activityId, requesterId)
    await createActivityJoinRequest(secondaryActivityId, secondRequesterId)

    const approved = await createActivityJoinRequest(activityId, thirdRequesterId)
    await approveActivityJoinRequest(approved.id, reviewerId)

    await createActivityJoinRequest(otherOrganizationActivityId, thirdRequesterId)

    const orgRows = await listAllPendingActivityRequestsForOrg(organizationId)
    const otherOrgRows = await listAllPendingActivityRequestsForOrg(otherOrganizationId)

    expect(orgRows).toHaveLength(2)
    expect(orgRows.every((row) => row.request.status === "pending")).toBe(true)
    expect(
      new Set(orgRows.map((row) => row.activity.id))
    ).toEqual(new Set([activityId, secondaryActivityId]))

    expect(otherOrgRows).toHaveLength(1)
    expect(otherOrgRows[0]?.activity.id).toBe(otherOrganizationActivityId)

    await expect(countPendingActivityRequestsForOrg(organizationId)).resolves.toBe(2)
    await expect(countPendingActivityRequestsForOrg(otherOrganizationId)).resolves.toBe(1)
  })

  it("approves pending requests and sets reviewer metadata", async () => {
    const request = await createActivityJoinRequest(activityId, requesterId)

    const approved = await approveActivityJoinRequest(request.id, reviewerId)

    expect(approved.status).toBe("approved")
    expect(approved.reviewedBy).toBe(reviewerId)
    expect(approved.reviewedAt).toBeTruthy()
  })

  it("returns errors when approving missing or non-pending requests", async () => {
    await expect(approveActivityJoinRequest("missing-request", reviewerId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    })

    const request = await createActivityJoinRequest(activityId, requesterId)
    await rejectActivityJoinRequest(request.id, reviewerId)

    await expect(approveActivityJoinRequest(request.id, reviewerId)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("rejects pending requests and sets reviewer metadata", async () => {
    const request = await createActivityJoinRequest(activityId, requesterId)

    const rejected = await rejectActivityJoinRequest(request.id, reviewerId)

    expect(rejected.status).toBe("rejected")
    expect(rejected.reviewedBy).toBe(reviewerId)
    expect(rejected.reviewedAt).toBeTruthy()
  })

  it("returns errors when rejecting missing or non-pending requests", async () => {
    await expect(rejectActivityJoinRequest("missing-request", reviewerId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    })

    const request = await createActivityJoinRequest(activityId, requesterId)
    await approveActivityJoinRequest(request.id, reviewerId)

    await expect(rejectActivityJoinRequest(request.id, reviewerId)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    })
  })

  it("cancels own pending request and records reviewer metadata", async () => {
    const request = await createActivityJoinRequest(activityId, requesterId)

    const cancelled = await cancelActivityJoinRequest(request.id, requesterId)

    expect(cancelled.status).toBe("rejected")
    expect(cancelled.reviewedBy).toBe(requesterId)
    expect(cancelled.reviewedAt).toBeTruthy()
  })

  it("returns errors when cancelling missing, foreign, or non-pending requests", async () => {
    await expect(cancelActivityJoinRequest("missing-request", requesterId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    })

    const foreignRequest = await createActivityJoinRequest(activityId, requesterId)
    await expect(cancelActivityJoinRequest(foreignRequest.id, secondRequesterId)).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
      }
    )

    const approvedRequest = await createActivityJoinRequest(activityId, secondRequesterId)
    await approveActivityJoinRequest(approvedRequest.id, reviewerId)

    await expect(cancelActivityJoinRequest(approvedRequest.id, secondRequesterId)).rejects.toMatchObject(
      {
        code: "BAD_REQUEST",
      }
    )
  })
})

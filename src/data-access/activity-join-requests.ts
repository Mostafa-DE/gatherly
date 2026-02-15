import { and, eq, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { activityJoinRequest, activity, user } from "@/db/schema"
import type { ActivityJoinRequest } from "@/db/types"
import { NotFoundError, ConflictError, BadRequestError } from "@/exceptions"

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidate = error as { code?: string; cause?: unknown }
  if (candidate.code === "23505") {
    return true
  }

  if (candidate.cause && typeof candidate.cause === "object") {
    return ((candidate.cause as { code?: string }).code === "23505")
  }

  return false
}

// =============================================================================
// Queries
// =============================================================================

export async function getActivityJoinRequestById(
  requestId: string
): Promise<ActivityJoinRequest | null> {
  const result = await db
    .select()
    .from(activityJoinRequest)
    .where(eq(activityJoinRequest.id, requestId))
    .limit(1)
  return result[0] ?? null
}

export async function getActivityJoinRequestByIdForActivity(
  requestId: string,
  activityId: string
): Promise<ActivityJoinRequest | null> {
  const result = await db
    .select()
    .from(activityJoinRequest)
    .where(
      and(
        eq(activityJoinRequest.id, requestId),
        eq(activityJoinRequest.activityId, activityId)
      )
    )
    .limit(1)
  return result[0] ?? null
}

export async function getPendingActivityRequest(
  activityId: string,
  userId: string
): Promise<ActivityJoinRequest | null> {
  const result = await db
    .select()
    .from(activityJoinRequest)
    .where(
      and(
        eq(activityJoinRequest.activityId, activityId),
        eq(activityJoinRequest.userId, userId),
        eq(activityJoinRequest.status, "pending")
      )
    )
    .limit(1)
  return result[0] ?? null
}

export async function listPendingActivityRequests(activityId: string) {
  return db
    .select({
      request: activityJoinRequest,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(activityJoinRequest)
    .innerJoin(user, eq(activityJoinRequest.userId, user.id))
    .where(
      and(
        eq(activityJoinRequest.activityId, activityId),
        eq(activityJoinRequest.status, "pending")
      )
    )
    .orderBy(desc(activityJoinRequest.createdAt))
}

/** Returns all pending activity join requests across ALL activities in an org, grouped by activity */
export async function listAllPendingActivityRequestsForOrg(organizationId: string) {
  return db
    .select({
      request: activityJoinRequest,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
      activity: {
        id: activity.id,
        name: activity.name,
        slug: activity.slug,
      },
    })
    .from(activityJoinRequest)
    .innerJoin(activity, eq(activityJoinRequest.activityId, activity.id))
    .innerJoin(user, eq(activityJoinRequest.userId, user.id))
    .where(
      and(
        eq(activity.organizationId, organizationId),
        eq(activityJoinRequest.status, "pending")
      )
    )
    .orderBy(activity.name, desc(activityJoinRequest.createdAt))
}

export async function countPendingActivityRequestsForOrg(organizationId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityJoinRequest)
    .innerJoin(activity, eq(activityJoinRequest.activityId, activity.id))
    .where(
      and(
        eq(activity.organizationId, organizationId),
        eq(activityJoinRequest.status, "pending")
      )
    )
  return result?.count ?? 0
}

// =============================================================================
// Mutations
// =============================================================================

export async function createActivityJoinRequest(
  activityId: string,
  userId: string,
  message?: string,
  formAnswers?: Record<string, unknown>
): Promise<ActivityJoinRequest> {
  try {
    const [result] = await db
      .insert(activityJoinRequest)
      .values({
        activityId,
        userId,
        message,
        formAnswers,
        status: "pending",
      })
      .returning()
    return result
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError("You already have a pending request for this activity")
    }
    throw error
  }
}

export async function approveActivityJoinRequest(
  requestId: string,
  reviewerId: string
): Promise<ActivityJoinRequest> {
  const request = await getActivityJoinRequestById(requestId)

  if (!request) {
    throw new NotFoundError("Activity join request not found")
  }
  if (request.status !== "pending") {
    throw new BadRequestError("Only pending requests can be approved")
  }

  const [updated] = await db
    .update(activityJoinRequest)
    .set({
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activityJoinRequest.id, requestId))
    .returning()

  return updated
}

export async function rejectActivityJoinRequest(
  requestId: string,
  reviewerId: string
): Promise<ActivityJoinRequest> {
  const request = await getActivityJoinRequestById(requestId)

  if (!request) {
    throw new NotFoundError("Activity join request not found")
  }
  if (request.status !== "pending") {
    throw new BadRequestError("Only pending requests can be rejected")
  }

  const [updated] = await db
    .update(activityJoinRequest)
    .set({
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activityJoinRequest.id, requestId))
    .returning()

  return updated
}

export async function cancelActivityJoinRequest(
  requestId: string,
  userId: string
): Promise<ActivityJoinRequest> {
  const request = await getActivityJoinRequestById(requestId)

  if (!request) {
    throw new NotFoundError("Activity join request not found")
  }
  if (request.userId !== userId) {
    throw new NotFoundError("Activity join request not found")
  }
  if (request.status !== "pending") {
    throw new BadRequestError("Only pending requests can be cancelled")
  }

  const [updated] = await db
    .update(activityJoinRequest)
    .set({
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activityJoinRequest.id, requestId))
    .returning()

  return updated
}

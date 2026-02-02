import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { joinRequest, organization, user } from "@/db/schema";
import type { JoinRequest } from "@/db/types";
import { NotFoundError, ConflictError, BadRequestError } from "@/exceptions";

// =============================================================================
// Helper: Check if error is a unique constraint violation
// =============================================================================

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505";
}

// =============================================================================
// Queries
// =============================================================================

export async function getJoinRequestById(requestId: string) {
  const result = await db
    .select()
    .from(joinRequest)
    .where(eq(joinRequest.id, requestId))
    .limit(1);
  return result[0] ?? null;
}

export async function getJoinRequestWithDetails(requestId: string) {
  const result = await db
    .select({
      request: joinRequest,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(joinRequest)
    .innerJoin(organization, eq(joinRequest.organizationId, organization.id))
    .innerJoin(user, eq(joinRequest.userId, user.id))
    .where(eq(joinRequest.id, requestId))
    .limit(1);
  return result[0] ?? null;
}

export async function getPendingRequest(organizationId: string, userId: string) {
  const result = await db
    .select()
    .from(joinRequest)
    .where(
      and(
        eq(joinRequest.organizationId, organizationId),
        eq(joinRequest.userId, userId),
        eq(joinRequest.status, "pending")
      )
    )
    .limit(1);
  return result[0] ?? null;
}

export async function listPendingRequestsForOrg(organizationId: string) {
  return db
    .select({
      request: joinRequest,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(joinRequest)
    .innerJoin(user, eq(joinRequest.userId, user.id))
    .where(
      and(
        eq(joinRequest.organizationId, organizationId),
        eq(joinRequest.status, "pending")
      )
    )
    .orderBy(desc(joinRequest.createdAt));
}

export async function listMyJoinRequests(userId: string) {
  return db
    .select({
      request: joinRequest,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
      },
    })
    .from(joinRequest)
    .innerJoin(organization, eq(joinRequest.organizationId, organization.id))
    .where(eq(joinRequest.userId, userId))
    .orderBy(desc(joinRequest.createdAt));
}

// =============================================================================
// Mutations
// =============================================================================

export async function createJoinRequest(
  organizationId: string,
  userId: string,
  message?: string
): Promise<JoinRequest> {
  try {
    const [result] = await db
      .insert(joinRequest)
      .values({
        organizationId,
        userId,
        message,
        status: "pending",
      })
      .returning();
    return result;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError("You already have a pending request for this organization");
    }
    throw error;
  }
}

export async function cancelJoinRequest(
  requestId: string,
  userId: string
): Promise<JoinRequest> {
  const request = await getJoinRequestById(requestId);

  if (!request) {
    throw new NotFoundError("Join request not found");
  }
  if (request.userId !== userId) {
    throw new NotFoundError("Join request not found");
  }
  if (request.status !== "pending") {
    throw new BadRequestError("Only pending requests can be cancelled");
  }

  // Update status to 'rejected' (self-cancellation)
  const [updated] = await db
    .update(joinRequest)
    .set({
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(joinRequest.id, requestId))
    .returning();

  return updated;
}

export async function approveJoinRequest(
  requestId: string,
  reviewerId: string
): Promise<JoinRequest> {
  const request = await getJoinRequestById(requestId);

  if (!request) {
    throw new NotFoundError("Join request not found");
  }
  if (request.status !== "pending") {
    throw new BadRequestError("Only pending requests can be approved");
  }

  const [updated] = await db
    .update(joinRequest)
    .set({
      status: "approved",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(joinRequest.id, requestId))
    .returning();

  return updated;
}

export async function rejectJoinRequest(
  requestId: string,
  reviewerId: string
): Promise<JoinRequest> {
  const request = await getJoinRequestById(requestId);

  if (!request) {
    throw new NotFoundError("Join request not found");
  }
  if (request.status !== "pending") {
    throw new BadRequestError("Only pending requests can be rejected");
  }

  const [updated] = await db
    .update(joinRequest)
    .set({
      status: "rejected",
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(joinRequest.id, requestId))
    .returning();

  return updated;
}

import { and, eq, count, desc } from "drizzle-orm"
import { db } from "@/db"
import { activityMember, activity, user } from "@/db/schema"
import type { ActivityMember } from "@/db/types"
import { ConflictError } from "@/exceptions"

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505"
}

export async function getActivityMember(
  activityId: string,
  userId: string
): Promise<ActivityMember | null> {
  const result = await db
    .select()
    .from(activityMember)
    .where(
      and(
        eq(activityMember.activityId, activityId),
        eq(activityMember.userId, userId)
      )
    )
    .limit(1)
  return result[0] ?? null
}

export async function getActiveActivityMember(
  activityId: string,
  userId: string
): Promise<ActivityMember | null> {
  const result = await db
    .select()
    .from(activityMember)
    .where(
      and(
        eq(activityMember.activityId, activityId),
        eq(activityMember.userId, userId),
        eq(activityMember.status, "active")
      )
    )
    .limit(1)
  return result[0] ?? null
}

export async function createActivityMember(
  activityId: string,
  userId: string,
  status: "pending" | "active" = "active"
): Promise<ActivityMember> {
  try {
    const [created] = await db
      .insert(activityMember)
      .values({
        activityId,
        userId,
        status,
      })
      .returning()
    return created
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError("User is already a member of this activity")
    }
    throw error
  }
}

export async function updateActivityMemberStatus(
  activityId: string,
  userId: string,
  status: "pending" | "active" | "rejected"
): Promise<ActivityMember | null> {
  const [updated] = await db
    .update(activityMember)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(activityMember.activityId, activityId),
        eq(activityMember.userId, userId)
      )
    )
    .returning()
  return updated ?? null
}

export async function removeActivityMember(
  activityId: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .delete(activityMember)
    .where(
      and(
        eq(activityMember.activityId, activityId),
        eq(activityMember.userId, userId)
      )
    )
    .returning()
  return result.length > 0
}

export async function listActivityMembers(
  activityId: string,
  options: { status?: string; limit: number; offset: number }
) {
  const conditions = [eq(activityMember.activityId, activityId)]

  if (options.status) {
    conditions.push(eq(activityMember.status, options.status))
  }

  return db
    .select({
      member: activityMember,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(activityMember)
    .innerJoin(user, eq(activityMember.userId, user.id))
    .where(and(...conditions))
    .orderBy(desc(activityMember.createdAt))
    .limit(options.limit)
    .offset(options.offset)
}

export async function listUserActivityMemberships(
  userId: string,
  organizationId: string
) {
  return db
    .select({
      membership: activityMember,
      activity: {
        id: activity.id,
        name: activity.name,
        slug: activity.slug,
        joinMode: activity.joinMode,
      },
    })
    .from(activityMember)
    .innerJoin(activity, eq(activityMember.activityId, activity.id))
    .where(
      and(
        eq(activityMember.userId, userId),
        eq(activity.organizationId, organizationId),
        eq(activityMember.status, "active")
      )
    )
    .orderBy(desc(activityMember.createdAt))
}

export async function countActiveMembers(activityId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(activityMember)
    .where(
      and(
        eq(activityMember.activityId, activityId),
        eq(activityMember.status, "active")
      )
    )
  return result?.count ?? 0
}

import { and, eq, ne, asc, sql } from "drizzle-orm"
import { db } from "@/db"
import { activity, activityMember, activityJoinRequest } from "@/db/schema"
import type { Activity } from "@/db/types"
import type { CreateActivityInput } from "@/schemas/activity"
import type { JoinFormSchema } from "@/types/form"
import { ConflictError } from "@/exceptions"

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

export async function createActivity(
  organizationId: string,
  createdBy: string,
  input: CreateActivityInput
): Promise<Activity> {
  try {
    const [created] = await db
      .insert(activity)
      .values({
        organizationId,
        createdBy,
        name: input.name,
        slug: input.slug,
        joinMode: input.joinMode,
        joinFormSchema: input.joinFormSchema ?? null,
      })
      .returning()
    return created
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError("An activity with this slug already exists in this organization")
    }
    throw error
  }
}

export async function updateActivity(
  activityId: string,
  organizationId: string,
  data: { name?: string; joinMode?: string; joinFormSchema?: JoinFormSchema | null }
): Promise<Activity | null> {
  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (data.name !== undefined) setData.name = data.name
  if (data.joinMode !== undefined) setData.joinMode = data.joinMode
  if (data.joinFormSchema !== undefined) {
    setData.joinFormSchema = data.joinFormSchema
    setData.joinFormVersion = sql`${activity.joinFormVersion} + 1`
  }

  const [updated] = await db
    .update(activity)
    .set(setData)
    .where(
      and(eq(activity.id, activityId), eq(activity.organizationId, organizationId))
    )
    .returning()
  return updated ?? null
}

export async function getActivityById(activityId: string): Promise<Activity | null> {
  const result = await db
    .select()
    .from(activity)
    .where(eq(activity.id, activityId))
    .limit(1)
  return result[0] ?? null
}

export async function getActivityByIdForOrg(
  activityId: string,
  organizationId: string
): Promise<Activity | null> {
  const result = await db
    .select()
    .from(activity)
    .where(
      and(eq(activity.id, activityId), eq(activity.organizationId, organizationId))
    )
    .limit(1)
  return result[0] ?? null
}

export async function getActivityBySlugForOrg(
  slug: string,
  organizationId: string
): Promise<Activity | null> {
  const result = await db
    .select()
    .from(activity)
    .where(
      and(eq(activity.slug, slug), eq(activity.organizationId, organizationId))
    )
    .limit(1)
  return result[0] ?? null
}

const pendingJoinRequest = db
  .select({
    activityId: activityJoinRequest.activityId,
    userId: activityJoinRequest.userId,
    status: activityJoinRequest.status,
  })
  .from(activityJoinRequest)
  .where(eq(activityJoinRequest.status, "pending"))
  .as("pending_join_request")

/** Returns activities in the org with user's membership + join request status */
export async function listActivitiesForOrg(
  organizationId: string,
  userId: string,
  options: { limit: number; offset: number; includeInactive?: boolean }
) {
  const conditions = [eq(activity.organizationId, organizationId)]
  if (!options.includeInactive) {
    conditions.push(eq(activity.isActive, true))
  }

  return db
    .select({
      id: activity.id,
      organizationId: activity.organizationId,
      name: activity.name,
      slug: activity.slug,
      joinMode: activity.joinMode,
      joinFormSchema: activity.joinFormSchema,
      joinFormVersion: activity.joinFormVersion,
      isActive: activity.isActive,
      createdBy: activity.createdBy,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      myMembershipStatus: sql<string | null>`${activityMember.status}`.as("my_membership_status"),
      myJoinRequestStatus: sql<string | null>`${pendingJoinRequest.status}`.as("my_join_request_status"),
    })
    .from(activity)
    .leftJoin(
      activityMember,
      and(
        eq(activityMember.activityId, activity.id),
        eq(activityMember.userId, userId)
      )
    )
    .leftJoin(
      pendingJoinRequest,
      and(
        eq(pendingJoinRequest.activityId, activity.id),
        eq(pendingJoinRequest.userId, userId)
      )
    )
    .where(and(...conditions))
    .orderBy(asc(activity.createdAt))
    .limit(options.limit)
    .offset(options.offset)
}

export async function listPublicActivitiesForOrg(
  organizationId: string,
  options: { limit: number; offset: number }
) {
  return db
    .select()
    .from(activity)
    .where(
      and(
        eq(activity.organizationId, organizationId),
        eq(activity.isActive, true),
        ne(activity.joinMode, "invite")
      )
    )
    .orderBy(asc(activity.createdAt))
    .limit(options.limit)
    .offset(options.offset)
}

export async function listActivitiesWithMemberCount(
  organizationId: string,
  options?: { includeInactive?: boolean }
) {
  const memberCountSq = db
    .select({
      activityId: activityMember.activityId,
      memberCount: sql<number>`count(*)::int`.as("member_count"),
    })
    .from(activityMember)
    .where(eq(activityMember.status, "active"))
    .groupBy(activityMember.activityId)
    .as("member_counts")

  const conditions = [eq(activity.organizationId, organizationId)]
  if (!options?.includeInactive) {
    conditions.push(eq(activity.isActive, true))
  }

  return db
    .select({
      id: activity.id,
      organizationId: activity.organizationId,
      name: activity.name,
      slug: activity.slug,
      joinMode: activity.joinMode,
      joinFormSchema: activity.joinFormSchema,
      joinFormVersion: activity.joinFormVersion,
      isActive: activity.isActive,
      createdBy: activity.createdBy,
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      memberCount: sql<number>`coalesce(${memberCountSq.memberCount}, 0)::int`,
    })
    .from(activity)
    .leftJoin(memberCountSq, eq(memberCountSq.activityId, activity.id))
    .where(and(...conditions))
    .orderBy(asc(activity.createdAt))
}

export async function countActiveActivitiesForOrg(organizationId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activity)
    .where(and(eq(activity.organizationId, organizationId), eq(activity.isActive, true)))
  return result?.count ?? 0
}

export async function deactivateActivity(
  activityId: string,
  organizationId: string
): Promise<Activity | null> {
  const [updated] = await db
    .update(activity)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(eq(activity.id, activityId), eq(activity.organizationId, organizationId))
    )
    .returning()
  return updated ?? null
}

export async function reactivateActivity(
  activityId: string,
  organizationId: string
): Promise<Activity | null> {
  const [updated] = await db
    .update(activity)
    .set({ isActive: true, updatedAt: new Date() })
    .where(
      and(eq(activity.id, activityId), eq(activity.organizationId, organizationId))
    )
    .returning()
  return updated ?? null
}

/**
 * Toggle a plugin on/off for an activity.
 * Uses atomic jsonb_set to avoid lost-update races from concurrent toggles.
 */
export async function updateActivityEnabledPlugins(
  activityId: string,
  organizationId: string,
  pluginId: string,
  enabled: boolean
): Promise<Activity | null> {
  const [updated] = await db
    .update(activity)
    .set({
      enabledPlugins: sql`jsonb_set(coalesce(${activity.enabledPlugins}, '{}'::jsonb), ${`{${pluginId}}`}, ${JSON.stringify(enabled)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(activity.id, activityId), eq(activity.organizationId, organizationId))
    )
    .returning()
  return updated ?? null
}

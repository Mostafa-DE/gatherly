import { and, eq } from "drizzle-orm"
import { db } from "@/db"
import { groupMemberProfile } from "@/db/schema"
import type { GroupMemberProfile } from "@/db/types"
import { NotFoundError } from "@/exceptions"

// =============================================================================
// Queries
// =============================================================================

export async function getProfileByOrgAndUser(
  organizationId: string,
  userId: string
): Promise<GroupMemberProfile | null> {
  const result = await db
    .select()
    .from(groupMemberProfile)
    .where(
      and(
        eq(groupMemberProfile.organizationId, organizationId),
        eq(groupMemberProfile.userId, userId)
      )
    )
    .limit(1)
  return result[0] ?? null
}

export async function getProfileById(
  profileId: string
): Promise<GroupMemberProfile | null> {
  const result = await db
    .select()
    .from(groupMemberProfile)
    .where(eq(groupMemberProfile.id, profileId))
    .limit(1)
  return result[0] ?? null
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Create or update a group member profile (upsert)
 */
export async function upsertProfile(
  organizationId: string,
  userId: string,
  answers: Record<string, unknown>,
  nickname?: string | null
): Promise<GroupMemberProfile> {
  const existing = await getProfileByOrgAndUser(organizationId, userId)

  if (existing) {
    const updates: Record<string, unknown> = {
      answers,
      updatedAt: new Date(),
    }
    if (nickname !== undefined) {
      updates.nickname = nickname
    }

    const [updated] = await db
      .update(groupMemberProfile)
      .set(updates)
      .where(eq(groupMemberProfile.id, existing.id))
      .returning()
    return updated
  }

  // Create new profile
  const [created] = await db
    .insert(groupMemberProfile)
    .values({
      organizationId,
      userId,
      answers,
      ...(nickname !== undefined ? { nickname } : {}),
    })
    .returning()

  return created
}

/**
 * Update own profile
 */
export async function updateMyProfile(
  organizationId: string,
  userId: string,
  answers: Record<string, unknown>
): Promise<GroupMemberProfile> {
  return upsertProfile(organizationId, userId, answers)
}

/**
 * Submit join form (creates profile if doesn't exist)
 */
export async function submitJoinForm(
  organizationId: string,
  userId: string,
  answers: Record<string, unknown>
): Promise<GroupMemberProfile> {
  return upsertProfile(organizationId, userId, answers)
}

/**
 * Get user's profile (admin)
 */
export async function getUserProfile(
  organizationId: string,
  userId: string
): Promise<GroupMemberProfile> {
  const profile = await getProfileByOrgAndUser(organizationId, userId)
  if (!profile) {
    throw new NotFoundError("Profile not found")
  }
  return profile
}

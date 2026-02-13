import { and, eq, gt, or, isNull, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { inviteLink } from "@/db/schema"
import type { CreateInviteLinkInput } from "@/schemas/invite-link"

export async function createInviteLink(
  organizationId: string,
  createdBy: string,
  input: CreateInviteLinkInput
) {
  const [link] = await db
    .insert(inviteLink)
    .values({
      organizationId,
      createdBy,
      role: input.role,
      expiresAt: input.expiresAt ?? null,
      maxUses: input.maxUses ?? null,
    })
    .returning()

  return link
}

export async function getValidInviteLinkByToken(token: string) {
  const now = new Date()

  const [link] = await db
    .select()
    .from(inviteLink)
    .where(
      and(
        eq(inviteLink.token, token),
        eq(inviteLink.isActive, true),
        or(isNull(inviteLink.expiresAt), gt(inviteLink.expiresAt, now))
      )
    )
    .limit(1)

  if (!link) return null

  // Check max uses
  if (link.maxUses !== null && link.usedCount >= link.maxUses) {
    return null
  }

  return link
}

export async function incrementUsedCount(id: string) {
  await db
    .update(inviteLink)
    .set({
      usedCount: sql`${inviteLink.usedCount} + 1`,
    })
    .where(eq(inviteLink.id, id))
}

/**
 * Atomically claim an invite link: validates token, expiration, active status,
 * and max uses in a single UPDATE ... WHERE ... RETURNING query.
 * Returns null if the link is invalid, expired, or fully used.
 */
export async function claimInviteLinkByToken(token: string) {
  const now = new Date()

  const [link] = await db
    .update(inviteLink)
    .set({
      usedCount: sql`${inviteLink.usedCount} + 1`,
    })
    .where(
      and(
        eq(inviteLink.token, token),
        eq(inviteLink.isActive, true),
        or(isNull(inviteLink.expiresAt), gt(inviteLink.expiresAt, now)),
        or(
          isNull(inviteLink.maxUses),
          sql`${inviteLink.usedCount} < ${inviteLink.maxUses}`
        )
      )
    )
    .returning()

  return link ?? null
}

export async function listInviteLinks(organizationId: string) {
  return db
    .select()
    .from(inviteLink)
    .where(eq(inviteLink.organizationId, organizationId))
    .orderBy(desc(inviteLink.createdAt))
}

export async function deactivateInviteLink(id: string, organizationId: string) {
  const [updated] = await db
    .update(inviteLink)
    .set({ isActive: false })
    .where(
      and(eq(inviteLink.id, id), eq(inviteLink.organizationId, organizationId))
    )
    .returning()

  return updated ?? null
}

import { and, eq, or, ilike, notInArray } from "drizzle-orm"
import { db } from "@/db"
import { invitation, member, organization, user } from "@/db/schema"

export async function getOrganizationById(organizationId: string) {
  const result = await db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)

  return result[0] ?? null
}

export async function getOrganizationMemberByUserId(
  organizationId: string,
  userId: string
) {
  const result = await db
    .select()
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId)
      )
    )
    .limit(1)

  return result[0] ?? null
}

export async function getUserByEmail(email: string) {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  return result[0] ?? null
}

export async function getPendingInvitationByEmail(
  organizationId: string,
  email: string
) {
  const result = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.email, email),
        eq(invitation.status, "pending")
      )
    )
    .limit(1)

  return result[0] ?? null
}

export async function getInvitationById(invitationId: string) {
  const result = await db
    .select()
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1)

  return result[0] ?? null
}

export async function getMemberById(memberId: string) {
  const result = await db
    .select()
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1)

  return result[0] ?? null
}

export async function searchOrgMembers(
  orgId: string,
  search: string,
  excludeUserIds: string[],
  limit: number
) {
  const pattern = `%${search}%`

  const conditions = [
    eq(member.organizationId, orgId),
    or(ilike(user.name, pattern), ilike(user.email, pattern)),
  ]

  if (excludeUserIds.length > 0) {
    conditions.push(notInArray(user.id, excludeUserIds))
  }

  return db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(...conditions))
    .limit(limit)
}

export async function updateOrganizationById(
  organizationId: string,
  updates: Partial<{
    name: string
    timezone: string | null
    defaultJoinMode: "open" | "invite" | "approval"
  }>
) {
  await db
    .update(organization)
    .set(updates)
    .where(eq(organization.id, organizationId))
}

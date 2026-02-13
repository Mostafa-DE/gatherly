import { and, eq, desc } from "drizzle-orm"
import { db } from "@/db"
import { memberNote } from "@/db/schema"
import { user } from "@/db/auth-schema"
import type { MemberNote } from "@/db/types"

export async function createMemberNote(
  organizationId: string,
  targetUserId: string,
  authorUserId: string,
  content: string,
  activityId?: string
): Promise<MemberNote> {
  const [created] = await db
    .insert(memberNote)
    .values({
      organizationId,
      targetUserId,
      authorUserId,
      content,
      activityId: activityId ?? null,
    })
    .returning()
  return created
}

export async function listMemberNotes(
  organizationId: string,
  targetUserId: string,
  activityId?: string
) {
  const conditions = [
    eq(memberNote.organizationId, organizationId),
    eq(memberNote.targetUserId, targetUserId),
  ]

  if (activityId) {
    conditions.push(eq(memberNote.activityId, activityId))
  }

  return db
    .select({
      note: memberNote,
      author: {
        id: user.id,
        name: user.name,
        image: user.image,
      },
    })
    .from(memberNote)
    .innerJoin(user, eq(memberNote.authorUserId, user.id))
    .where(and(...conditions))
    .orderBy(desc(memberNote.createdAt))
}

export async function updateMemberNote(
  organizationId: string,
  noteId: string,
  authorUserId: string,
  content: string
): Promise<MemberNote | null> {
  const [updated] = await db
    .update(memberNote)
    .set({ content, updatedAt: new Date() })
    .where(
      and(
        eq(memberNote.id, noteId),
        eq(memberNote.organizationId, organizationId),
        eq(memberNote.authorUserId, authorUserId)
      )
    )
    .returning()
  return updated ?? null
}

export async function deleteMemberNote(
  organizationId: string,
  noteId: string,
  authorUserId: string
): Promise<boolean> {
  const result = await db
    .delete(memberNote)
    .where(
      and(
        eq(memberNote.id, noteId),
        eq(memberNote.organizationId, organizationId),
        eq(memberNote.authorUserId, authorUserId)
      )
    )
    .returning()
  return result.length > 0
}

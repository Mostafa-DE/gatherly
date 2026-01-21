import { eq } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/schema"

export async function getUserById(id: string) {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .limit(1)
  return result[0] ?? null
}

export async function updateUser(
  id: string,
  data: { name?: string; image?: string }
) {
  const result = await db
    .update(user)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))
    .returning()
  return result[0] ?? null
}

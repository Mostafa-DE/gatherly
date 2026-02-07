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

export async function getUserByUsername(username: string) {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.username, username))
    .limit(1)
  return result[0] ?? null
}

export async function getUserByPhone(phoneNumber: string) {
  const result = await db
    .select()
    .from(user)
    .where(eq(user.phoneNumber, phoneNumber))
    .limit(1)
  return result[0] ?? null
}

export async function getUserByEmailOrPhone(identifier: string) {
  // If contains @, treat as email; otherwise treat as phone
  const isEmail = identifier.includes("@")

  if (isEmail) {
    const result = await db
      .select()
      .from(user)
      .where(eq(user.email, identifier))
      .limit(1)
    return result[0] ?? null
  } else {
    return getUserByPhone(identifier)
  }
}

export async function updateUser(
  id: string,
  data: { name?: string; image?: string; phoneNumber?: string }
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

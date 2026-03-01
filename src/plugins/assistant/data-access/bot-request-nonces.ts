import { and, eq, lte } from "drizzle-orm"
import { db } from "@/db"
import { assistantBotRequestNonce } from "@/plugins/assistant/schema"

export async function consumeBotRequestNonce(input: {
  senderId: string
  nonce: string
  ttlMs: number
}) {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + input.ttlMs)

  // Keep nonce table bounded for active senders.
  await db
    .delete(assistantBotRequestNonce)
    .where(
      and(
        eq(assistantBotRequestNonce.senderId, input.senderId),
        lte(assistantBotRequestNonce.expiresAt, now)
      )
    )

  const inserted = await db
    .insert(assistantBotRequestNonce)
    .values({
      senderId: input.senderId,
      nonce: input.nonce,
      expiresAt,
    })
    .onConflictDoNothing()
    .returning({ id: assistantBotRequestNonce.id })

  return inserted.length > 0
}

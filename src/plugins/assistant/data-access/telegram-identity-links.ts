import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/db"
import { member, organization } from "@/db/auth-schema"
import { telegramIdentityLink } from "@/plugins/assistant/schema"

function canonicalizeTelegramUserId(telegramUserId: string): string {
  const raw = String(telegramUserId ?? "").trim()
  if (!raw) return raw

  // OpenClaw sender_id may include transport prefixes; store and query canonical numeric IDs.
  const withoutPrefix = raw.replace(/^(tg:|telegram:)/i, "").trim()
  if (/^\d+$/.test(withoutPrefix)) return withoutPrefix
  const trailingDigitsMatch = withoutPrefix.match(/(\d{5,})$/)
  if (trailingDigitsMatch) return trailingDigitsMatch[1]

  return withoutPrefix
}

function telegramUserIdCandidates(telegramUserId: string): string[] {
  const raw = String(telegramUserId ?? "").trim()
  const canonical = canonicalizeTelegramUserId(raw)

  if (!raw && !canonical) return [""]
  if (!raw) return [canonical]
  if (!canonical) return [raw]
  return raw === canonical ? [raw] : [raw, canonical]
}

export async function createOrUpdateTelegramLink(
  organizationId: string,
  userId: string,
  telegramUserId: string,
  linkedByUserId: string,
  telegramChatId?: string | null
) {
  const now = new Date()
  const candidates = telegramUserIdCandidates(telegramUserId)
  const canonicalTelegramUserId = canonicalizeTelegramUserId(telegramUserId)

  // Upsert: if this telegram user is already linked in this org, replace
  const [existing] = await db
    .select()
    .from(telegramIdentityLink)
    .where(
      and(
        eq(telegramIdentityLink.organizationId, organizationId),
        candidates.length === 1
          ? eq(telegramIdentityLink.telegramUserId, candidates[0])
          : inArray(telegramIdentityLink.telegramUserId, candidates)
      )
    )
    .limit(1)

  if (existing) {
    const [updated] = await db
      .update(telegramIdentityLink)
      .set({
        userId,
        linkedByUserId,
        linkedAt: now,
        telegramUserId: canonicalTelegramUserId,
        telegramChatId: telegramChatId ?? null,
      })
      .where(eq(telegramIdentityLink.id, existing.id))
      .returning()

    return updated
  }

  const [created] = await db
    .insert(telegramIdentityLink)
    .values({
      organizationId,
      userId,
      telegramUserId: canonicalTelegramUserId,
      telegramChatId: telegramChatId ?? null,
      linkedByUserId,
      linkedAt: now,
    })
    .returning()

  return created
}

export async function findLinkByTelegramUserId(
  organizationId: string,
  telegramUserId: string
) {
  const candidates = telegramUserIdCandidates(telegramUserId)

  const [link] = await db
    .select()
    .from(telegramIdentityLink)
    .where(
      and(
        eq(telegramIdentityLink.organizationId, organizationId),
        candidates.length === 1
          ? eq(telegramIdentityLink.telegramUserId, candidates[0])
          : inArray(telegramIdentityLink.telegramUserId, candidates)
      )
    )
    .limit(1)

  return link ?? null
}

/**
 * Find all org links for a Telegram user (no org filter).
 * Used by bot endpoints where the API key is not org-scoped.
 */
export async function findLinksByTelegramUserId(telegramUserId: string) {
  const candidates = telegramUserIdCandidates(telegramUserId)

  return db
    .select()
    .from(telegramIdentityLink)
    .where(
      candidates.length === 1
        ? eq(telegramIdentityLink.telegramUserId, candidates[0])
        : inArray(telegramIdentityLink.telegramUserId, candidates)
    )
}

/**
 * Find all linked orgs for a Telegram user with org name and member role.
 * Single query using JOINs. Used by multi-org picker in getCapabilities.
 */
export async function findLinkedOrgsWithRoles(telegramUserId: string) {
  const candidates = telegramUserIdCandidates(telegramUserId)

  return db
    .select({
      organizationId: telegramIdentityLink.organizationId,
      orgName: organization.name,
      userId: telegramIdentityLink.userId,
      role: member.role,
    })
    .from(telegramIdentityLink)
    .innerJoin(
      organization,
      eq(organization.id, telegramIdentityLink.organizationId)
    )
    .innerJoin(
      member,
      and(
        eq(member.organizationId, telegramIdentityLink.organizationId),
        eq(member.userId, telegramIdentityLink.userId)
      )
    )
    .where(
      candidates.length === 1
        ? eq(telegramIdentityLink.telegramUserId, candidates[0])
        : inArray(telegramIdentityLink.telegramUserId, candidates)
    )
}

export async function findLinkByUserId(
  organizationId: string,
  userId: string
) {
  const [link] = await db
    .select()
    .from(telegramIdentityLink)
    .where(
      and(
        eq(telegramIdentityLink.organizationId, organizationId),
        eq(telegramIdentityLink.userId, userId)
      )
    )
    .limit(1)

  return link ?? null
}

export async function deleteTelegramLinkByUserId(
  organizationId: string,
  userId: string
) {
  const [deleted] = await db
    .delete(telegramIdentityLink)
    .where(
      and(
        eq(telegramIdentityLink.organizationId, organizationId),
        eq(telegramIdentityLink.userId, userId)
      )
    )
    .returning()

  return deleted ?? null
}

import { and, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/db"
import { organizationSettings } from "@/db/schema"
import type { OrganizationSettings } from "@/db/types"
import type { JoinFormSchema } from "@/schemas/organization-settings"

// =============================================================================
// Queries
// =============================================================================

export async function getOrgSettings(
  organizationId: string
): Promise<OrganizationSettings | null> {
  const result = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1)
  return result[0] ?? null
}

/**
 * Get or create organization settings
 * Returns existing settings or creates default if none exist
 */
export async function getOrCreateOrgSettings(
  organizationId: string
): Promise<OrganizationSettings> {
  const existing = await getOrgSettings(organizationId)
  if (existing) {
    return existing
  }

  // Create default settings
  const [created] = await db
    .insert(organizationSettings)
    .values({
      organizationId,
      joinFormSchema: null,
      joinFormVersion: 1,
    })
    .returning()

  return created
}

// =============================================================================
// Mutations
// =============================================================================

/**
 * Update join form schema
 * Increments version when schema changes
 */
export async function updateJoinFormSchema(
  organizationId: string,
  joinFormSchema: JoinFormSchema | null
): Promise<OrganizationSettings> {
  const existing = await getOrgSettings(organizationId)

  if (existing) {
    // Update existing settings, increment version
    const [updated] = await db
      .update(organizationSettings)
      .set({
        joinFormSchema,
        joinFormVersion: existing.joinFormVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(organizationSettings.organizationId, organizationId))
      .returning()
    return updated
  }

  // Create new settings
  const [created] = await db
    .insert(organizationSettings)
    .values({
      organizationId,
      joinFormSchema,
      joinFormVersion: 1,
    })
    .returning()

  return created
}

/**
 * Update enabled plugins for an organization.
 * Uses atomic jsonb_set to avoid lost-update races from concurrent toggles.
 */
export async function updateEnabledPlugins(
  organizationId: string,
  pluginId: string,
  enabled: boolean
): Promise<OrganizationSettings> {
  await getOrCreateOrgSettings(organizationId)

  const [result] = await db
    .update(organizationSettings)
    .set({
      enabledPlugins: sql`jsonb_set(coalesce(${organizationSettings.enabledPlugins}, '{}'::jsonb), ${`{${pluginId}}`}, ${JSON.stringify(enabled)}::jsonb)`,
      updatedAt: new Date(),
    })
    .where(eq(organizationSettings.organizationId, organizationId))
    .returning()

  return result
}

/**
 * Mark organization name as changed (one-time lock)
 */
export async function markNameChanged(organizationId: string): Promise<void> {
  await getOrCreateOrgSettings(organizationId)
  await db
    .update(organizationSettings)
    .set({ nameChangedAt: new Date(), updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, organizationId))
}

/**
 * Atomically lock organization name changes.
 * Returns false when the name was already changed before.
 */
export async function lockOrganizationNameChange(organizationId: string): Promise<boolean> {
  await getOrCreateOrgSettings(organizationId)

  const [updated] = await db
    .update(organizationSettings)
    .set({ nameChangedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(organizationSettings.organizationId, organizationId),
        isNull(organizationSettings.nameChangedAt)
      )
    )
    .returning({ organizationId: organizationSettings.organizationId })

  return !!updated
}

/**
 * Update organization currency
 */
export async function updateOrgCurrency(
  organizationId: string,
  currency: string | null
): Promise<OrganizationSettings> {
  const existing = await getOrgSettings(organizationId)

  if (existing) {
    const [updated] = await db
      .update(organizationSettings)
      .set({
        currency,
        updatedAt: new Date(),
      })
      .where(eq(organizationSettings.organizationId, organizationId))
      .returning()
    return updated
  }

  // Create new settings
  const [created] = await db
    .insert(organizationSettings)
    .values({
      organizationId,
      currency,
      joinFormSchema: null,
      joinFormVersion: 1,
    })
    .returning()

  return created
}

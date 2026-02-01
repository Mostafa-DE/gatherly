import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationSettings } from "@/db/schema";
import type { OrganizationSettings } from "@/db/types";
import type { JoinFormSchema } from "@/schemas/organization-settings";

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
    .limit(1);
  return result[0] ?? null;
}

/**
 * Get or create organization settings
 * Returns existing settings or creates default if none exist
 */
export async function getOrCreateOrgSettings(
  organizationId: string
): Promise<OrganizationSettings> {
  const existing = await getOrgSettings(organizationId);
  if (existing) {
    return existing;
  }

  // Create default settings
  const [created] = await db
    .insert(organizationSettings)
    .values({
      organizationId,
      joinFormSchema: null,
      joinFormVersion: 1,
    })
    .returning();

  return created;
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
  const existing = await getOrgSettings(organizationId);

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
      .returning();
    return updated;
  }

  // Create new settings
  const [created] = await db
    .insert(organizationSettings)
    .values({
      organizationId,
      joinFormSchema,
      joinFormVersion: 1,
    })
    .returning();

  return created;
}

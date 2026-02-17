import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { smartGroupConfig } from "@/plugins/smart-groups/schema"
import type { SmartGroupConfig } from "@/db/types"
import { ConflictError, NotFoundError } from "@/exceptions"
import type { CreateConfigInput, UpdateConfigInput } from "../schemas"

export async function getConfigByActivity(
  activityId: string,
  organizationId: string
): Promise<SmartGroupConfig | null> {
  const [result] = await db
    .select()
    .from(smartGroupConfig)
    .where(
      and(
        eq(smartGroupConfig.activityId, activityId),
        eq(smartGroupConfig.organizationId, organizationId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function getConfigById(
  configId: string,
  organizationId: string
): Promise<SmartGroupConfig | null> {
  const [result] = await db
    .select()
    .from(smartGroupConfig)
    .where(
      and(
        eq(smartGroupConfig.id, configId),
        eq(smartGroupConfig.organizationId, organizationId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function createConfig(
  organizationId: string,
  createdBy: string,
  input: CreateConfigInput
): Promise<SmartGroupConfig> {
  // Check unique constraint before insert
  const existing = await getConfigByActivity(input.activityId, organizationId)
  if (existing) {
    throw new ConflictError("Smart Groups config already exists for this activity")
  }

  const [config] = await db
    .insert(smartGroupConfig)
    .values({
      organizationId,
      activityId: input.activityId,
      name: input.name,
      defaultCriteria: input.defaultCriteria ?? null,
      createdBy,
    })
    .returning()

  return config
}

export async function updateConfig(
  configId: string,
  organizationId: string,
  updates: Omit<UpdateConfigInput, "configId">
): Promise<SmartGroupConfig> {
  const setValues: Record<string, unknown> = {}
  if (updates.name !== undefined) setValues.name = updates.name
  if (updates.defaultCriteria !== undefined) setValues.defaultCriteria = updates.defaultCriteria

  if (Object.keys(setValues).length === 0) {
    const config = await getConfigById(configId, organizationId)
    if (!config) throw new NotFoundError("Smart Groups config not found")
    return config
  }

  const [updated] = await db
    .update(smartGroupConfig)
    .set(setValues)
    .where(
      and(
        eq(smartGroupConfig.id, configId),
        eq(smartGroupConfig.organizationId, organizationId)
      )
    )
    .returning()

  if (!updated) {
    throw new NotFoundError("Smart Groups config not found")
  }

  return updated
}

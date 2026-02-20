import type { AttributeField } from "@/plugins/ranking/domains/types"
import type { FormField, JoinFormSchema } from "@/types/form"

const RANKING_ATTR_PREFIX = "ranking_attr_"

/**
 * Convert domain attribute fields to FormField entries for the join form.
 * Each attribute becomes a required "select" field with `id: "ranking_attr_{attr.id}"`.
 */
export function domainAttributesToFormFields(attrs: AttributeField[]): FormField[] {
  return attrs.map((attr) => ({
    id: `${RANKING_ATTR_PREFIX}${attr.id}`,
    type: "select" as const,
    label: attr.label,
    required: true,
    options: attr.options,
  }))
}

/** Check whether a form field ID belongs to a ranking attribute (auto-managed). */
export function isRankingAttributeField(fieldId: string): boolean {
  return fieldId.startsWith(RANKING_ATTR_PREFIX)
}

/**
 * Extract ranking-prefixed keys from form answers, strip the prefix,
 * and return a record suitable for `memberRank.attributes`.
 *
 * Example: `{ "ranking_attr_position": "GK" }` -> `{ "position": "GK" }`
 */
export function extractRankingAttributesFromAnswers(
  formAnswers: Record<string, unknown>
): Record<string, string> | null {
  const result: Record<string, string> = {}
  let found = false

  for (const [key, value] of Object.entries(formAnswers)) {
    if (key.startsWith(RANKING_ATTR_PREFIX) && typeof value === "string") {
      result[key.slice(RANKING_ATTR_PREFIX.length)] = value
      found = true
    }
  }

  return found ? result : null
}

/**
 * Inject ranking attribute fields into an existing join form schema.
 * Removes any existing `ranking_attr_*` fields first, then appends the new ones.
 */
export function injectRankingAttributeFields(
  currentSchema: JoinFormSchema | null,
  attrs: AttributeField[]
): JoinFormSchema {
  const existingFields = currentSchema?.fields ?? []
  const customFields = existingFields.filter((f) => !isRankingAttributeField(f.id))
  const rankingFields = domainAttributesToFormFields(attrs)

  return { fields: [...customFields, ...rankingFields] }
}

/**
 * Remove all `ranking_attr_*` fields from a join form schema.
 * Returns `null` if no fields remain.
 */
export function removeRankingAttributeFields(
  currentSchema: JoinFormSchema | null
): JoinFormSchema | null {
  if (!currentSchema) return null

  const remaining = currentSchema.fields.filter((f) => !isRankingAttributeField(f.id))
  return remaining.length > 0 ? { fields: remaining } : null
}

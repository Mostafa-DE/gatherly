import type { AIFeatureContext } from "@/plugins/ai/types"

type PIIReplacements = {
  names: Array<{ original: string; replacement: string }>
  orgName: { original: string; replacement: string }
}

/**
 * Collects known PII values from the feature context.
 * Additional names can be provided by features via collectPII.
 */
export function buildPIIReplacements(
  ctx: AIFeatureContext,
  additionalPII: string[] = []
): PIIReplacements {
  const orgName = {
    original: ctx.activeOrganization.name,
    replacement: "this group",
  }

  // Collect all known names
  const nameSet = new Set<string>()

  // Current user's name (though usually not in the prompt)
  if (ctx.user.name) nameSet.add(ctx.user.name)

  // Additional names from feature's collectPII
  for (const name of additionalPII) {
    if (name && name.trim()) nameSet.add(name.trim())
  }

  const names = Array.from(nameSet)
    .filter((n) => n.length > 1) // Skip single characters
    .sort((a, b) => b.length - a.length) // Replace longest first to avoid partial matches
    .map((n) => ({ original: n, replacement: "this member" }))

  return { names, orgName }
}

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g
const URL_PATTERN = /https?:\/\/[^\s,)"]+/g

/**
 * Strips PII from a prompt string using the provided replacement map.
 * Applied only when using cloud providers (Groq, Cerebras, etc.).
 */
export function sanitizePrompt(
  prompt: string,
  replacements: PIIReplacements
): string {
  let sanitized = prompt

  // Replace org name first (may appear in many places)
  if (replacements.orgName.original) {
    sanitized = sanitized.replaceAll(
      replacements.orgName.original,
      replacements.orgName.replacement
    )
  }

  // Replace names (longest first to avoid partial matches)
  for (const { original, replacement } of replacements.names) {
    sanitized = sanitized.replaceAll(original, replacement)
  }

  // Strip email addresses
  sanitized = sanitized.replace(EMAIL_PATTERN, "[redacted]")

  // Strip phone numbers
  sanitized = sanitized.replace(PHONE_PATTERN, (match) => {
    // Only redact if it looks like a phone number (at least 7 digits)
    const digits = match.replace(/\D/g, "")
    return digits.length >= 7 ? "[redacted]" : match
  })

  // Strip URLs (could contain tracking params or personal links)
  sanitized = sanitized.replace(URL_PATTERN, "[redacted]")

  return sanitized
}

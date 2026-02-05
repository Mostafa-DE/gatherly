const FALLBACK_TIMEZONES = ["UTC"]

function safeSupportedTimezones(): string[] {
  if (typeof Intl === "undefined") return []
  if (typeof Intl.supportedValuesOf !== "function") return []
  try {
    return Intl.supportedValuesOf("timeZone")
  } catch {
    return []
  }
}

export function getTimezones(): string[] {
  const supported = safeSupportedTimezones()
  const resolved =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined

  const base = supported.length > 0 ? supported : resolved ? [resolved] : []
  const merged = [...base]

  for (const timezone of FALLBACK_TIMEZONES) {
    if (!merged.includes(timezone)) {
      merged.push(timezone)
    }
  }

  return merged.filter((timezone) => typeof timezone === "string" && timezone.length > 0).sort()
}

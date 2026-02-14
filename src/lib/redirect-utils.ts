/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows relative paths starting with `/` (but not `//`).
 */
export function safeRedirect(
  url: string | undefined,
  fallback: string
): string {
  if (!url || !url.startsWith("/") || url.startsWith("//")) {
    return fallback
  }
  return url
}

type RedirectNavOptions = {
  to: string
  params?: Record<string, string>
  search?: Record<string, string>
}

/**
 * Parse a redirect URL into TanStack Router navigation options.
 *
 * TanStack Router's `navigate({ to })` expects a route path pattern
 * (e.g. `/$username/$groupSlug`), NOT a concrete URL (e.g. `/alice/yoga`).
 * Passing a raw URL navigates to the correct location but params are never
 * extracted, so `Route.useParams()` returns undefined.
 *
 * This function matches the URL against known dynamic route patterns and
 * returns `{ to, params, search }` suitable for `navigate()`.
 */
function parseRedirectPath(
  url: string | undefined,
  fallback: string
): RedirectNavOptions {
  const path = safeRedirect(url, fallback)

  const questionIdx = path.indexOf("?")
  const pathname = questionIdx >= 0 ? path.slice(0, questionIdx) : path
  const search =
    questionIdx >= 0
      ? Object.fromEntries(new URLSearchParams(path.slice(questionIdx)))
      : undefined

  const segments = pathname.split("/").filter(Boolean)

  // /dashboard/org/{orgId}/sessions/{sessionId}
  if (
    segments.length === 5 &&
    segments[0] === "dashboard" &&
    segments[1] === "org" &&
    segments[3] === "sessions"
  ) {
    return {
      to: "/dashboard/org/$orgId/sessions/$sessionId",
      params: { orgId: segments[2], sessionId: segments[4] },
      ...(search && { search }),
    }
  }

  // /{username}/{groupSlug}/sessions/{sessionId}
  if (segments.length === 4 && segments[2] === "sessions") {
    return {
      to: "/$username/$groupSlug/sessions/$sessionId",
      params: {
        username: segments[0],
        groupSlug: segments[1],
        sessionId: segments[3],
      },
      ...(search && { search }),
    }
  }

  // /{username}/{groupSlug}
  const staticPrefixes = ["dashboard", "api", "login", "register", "onboarding"]
  if (segments.length === 2 && !staticPrefixes.includes(segments[0])) {
    return {
      to: "/$username/$groupSlug",
      params: { username: segments[0], groupSlug: segments[1] },
      ...(search && { search }),
    }
  }

  // Static routes (/dashboard, /login, etc.)
  return { to: path }
}

/**
 * Navigate to a redirect URL using TanStack Router's navigate function.
 * Parses the URL to extract route params so dynamic routes work correctly.
 */
export function navigateToRedirect(
  navigate: unknown,
  url: string | undefined,
  fallback: string
) {
  const opts = parseRedirectPath(url, fallback)
  void (navigate as (opts: RedirectNavOptions) => Promise<void>)(opts)
}

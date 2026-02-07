import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildInviteUrl,
  buildOrgUrl,
  buildSessionUrl,
  buildWhatsAppUrl,
} from "@/lib/share-urls"

describe("share-urls", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      location: {
        origin: "https://gatherly.app",
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("builds organization, session, and invite URLs from current origin", () => {
    expect(buildOrgUrl("alice", "book-club")).toBe(
      "https://gatherly.app/alice/book-club"
    )
    expect(buildSessionUrl("alice", "book-club", "sess_123")).toBe(
      "https://gatherly.app/alice/book-club/sessions/sess_123"
    )
    expect(buildInviteUrl("alice", "book-club", "token_456")).toBe(
      "https://gatherly.app/alice/book-club?invite=token_456"
    )
  })

  it("builds WhatsApp links with and without a message", () => {
    expect(buildWhatsAppUrl("https://gatherly.app/alice/book-club")).toBe(
      "https://wa.me/?text=https%3A%2F%2Fgatherly.app%2Falice%2Fbook-club"
    )

    expect(
      buildWhatsAppUrl(
        "https://gatherly.app/alice/book-club",
        "Join our weekly meetup!"
      )
    ).toBe(
      "https://wa.me/?text=Join%20our%20weekly%20meetup!%20https%3A%2F%2Fgatherly.app%2Falice%2Fbook-club"
    )
  })
})

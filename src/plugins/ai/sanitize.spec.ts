import { describe, expect, it } from "vitest"
import { buildPIIReplacements, sanitizePrompt } from "@/plugins/ai/sanitize"
import type { Database } from "@/db"
import type { Organization, Member } from "@/db/types"
import type { AIFeatureContext } from "@/plugins/ai/types"

function makeMockCtx(
  overrides: Partial<{
    orgName: string
    userName: string
    userEmail: string
  }> = {}
): AIFeatureContext {
  return {
    db: {} as Database,
    activeOrganization: {
      name: overrides.orgName ?? "Sunday Football Club",
    } as Organization,
    membership: {} as Member,
    user: {
      id: "user-1",
      name: overrides.userName ?? "Admin User",
      email: overrides.userEmail ?? "admin@example.com",
    },
  }
}

describe("buildPIIReplacements", () => {
  it("collects org name for replacement", () => {
    const ctx = makeMockCtx({ orgName: "Weekend Warriors" })
    const result = buildPIIReplacements(ctx)

    expect(result.orgName).toEqual({
      original: "Weekend Warriors",
      replacement: "this group",
    })
  })

  it("collects current user name", () => {
    const ctx = makeMockCtx({ userName: "Mostafa Ali" })
    const result = buildPIIReplacements(ctx)

    expect(result.names).toContainEqual({
      original: "Mostafa Ali",
      replacement: "this member",
    })
  })

  it("collects additional PII names from features", () => {
    const ctx = makeMockCtx()
    const result = buildPIIReplacements(ctx, [
      "Sara Nasser",
      "Ahmed Hassan",
    ])

    const originals = result.names.map((n) => n.original)
    expect(originals).toContain("Sara Nasser")
    expect(originals).toContain("Ahmed Hassan")
  })

  it("deduplicates names", () => {
    const ctx = makeMockCtx({ userName: "Sara Nasser" })
    const result = buildPIIReplacements(ctx, [
      "Sara Nasser",
      "Sara Nasser",
    ])

    const count = result.names.filter(
      (n) => n.original === "Sara Nasser"
    ).length
    expect(count).toBe(1)
  })

  it("sorts names longest-first to avoid partial match corruption", () => {
    const ctx = makeMockCtx({ userName: "Ali" })
    const result = buildPIIReplacements(ctx, [
      "Sara",
      "Sara Nasser",
      "Ahmed",
    ])

    const originals = result.names.map((n) => n.original)
    // "Sara Nasser" (11 chars) should come before "Ahmed" (5) and "Sara" (4)
    expect(originals.indexOf("Sara Nasser")).toBeLessThan(
      originals.indexOf("Sara")
    )
    expect(originals.indexOf("Sara Nasser")).toBeLessThan(
      originals.indexOf("Ahmed")
    )
  })

  it("skips single-character names", () => {
    const ctx = makeMockCtx({ userName: "X" })
    const result = buildPIIReplacements(ctx, ["A", "Bo"])

    const originals = result.names.map((n) => n.original)
    expect(originals).not.toContain("X")
    expect(originals).not.toContain("A")
    expect(originals).toContain("Bo")
  })

  it("skips empty and whitespace-only additionalPII entries", () => {
    const ctx = makeMockCtx()
    const result = buildPIIReplacements(ctx, ["", "   ", "Valid Name"])

    const originals = result.names.map((n) => n.original)
    expect(originals).toContain("Valid Name")
    expect(originals).toContain("Admin User") // from ctx.user.name
    expect(originals).toHaveLength(2)
  })

  it("works with empty additionalPII array", () => {
    const ctx = makeMockCtx({ userName: "Mostafa" })
    const result = buildPIIReplacements(ctx, [])

    expect(result.names).toEqual([
      { original: "Mostafa", replacement: "this member" },
    ])
  })

  it("works when no additionalPII argument is provided", () => {
    const ctx = makeMockCtx({ userName: "Mostafa" })
    const result = buildPIIReplacements(ctx)

    expect(result.names).toEqual([
      { original: "Mostafa", replacement: "this member" },
    ])
  })

  it("trims whitespace from additional PII names", () => {
    const ctx = makeMockCtx({ userName: "" })
    const result = buildPIIReplacements(ctx, ["  Padded Name  "])

    expect(result.names).toContainEqual({
      original: "Padded Name",
      replacement: "this member",
    })
  })
})

describe("sanitizePrompt", () => {
  it("replaces org name with 'this group'", () => {
    const replacements = buildPIIReplacements(
      makeMockCtx({ orgName: "Sunday Football Club" })
    )
    const prompt = "The member joined Sunday Football Club in 2024."
    const result = sanitizePrompt(prompt, replacements)

    expect(result).toBe("The member joined this group in 2024.")
    expect(result).not.toContain("Sunday Football Club")
  })

  it("replaces member names with 'this member'", () => {
    const ctx = makeMockCtx()
    const replacements = buildPIIReplacements(ctx, ["Sara Nasser"])
    const prompt = "Sara Nasser attended 15 sessions."
    const result = sanitizePrompt(prompt, replacements)

    expect(result).toBe("this member attended 15 sessions.")
    expect(result).not.toContain("Sara Nasser")
  })

  it("strips email addresses with [redacted]", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const prompt = "Contact them at john.doe@example.com for details."
    const result = sanitizePrompt(prompt, replacements)

    expect(result).toBe("Contact them at [redacted] for details.")
    expect(result).not.toContain("john.doe@example.com")
  })

  it("strips various email formats", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const emails = [
      "user@domain.com",
      "first.last@company.co.uk",
      "name+tag@gmail.com",
      "user_name@sub.domain.org",
    ]
    for (const email of emails) {
      const result = sanitizePrompt(`Email: ${email}`, replacements)
      expect(result).not.toContain(email)
      expect(result).toContain("[redacted]")
    }
  })

  it("strips phone numbers in +1-555-123-4567 format", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const result = sanitizePrompt(
      "Call +1-555-123-4567 for info.",
      replacements
    )
    expect(result).not.toContain("+1-555-123-4567")
    expect(result).toContain("[redacted]")
  })

  it("strips phone numbers in (555) 123-4567 format", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const result = sanitizePrompt(
      "Phone: (555) 123-4567",
      replacements
    )
    expect(result).not.toContain("(555) 123-4567")
    expect(result).toContain("[redacted]")
  })

  it("strips phone numbers in 555.123.4567 format", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const result = sanitizePrompt(
      "Reach them at 555.123.4567 please.",
      replacements
    )
    expect(result).not.toContain("555.123.4567")
    expect(result).toContain("[redacted]")
  })

  it("does NOT strip short number sequences like '15 wins'", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const prompt = "The player has 15 wins and 3 losses."
    const result = sanitizePrompt(prompt, replacements)

    expect(result).toBe("The player has 15 wins and 3 losses.")
  })

  it("strips URLs", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const prompt =
      "Profile: https://example.com/user/123?ref=abc and http://other.site/path"
    const result = sanitizePrompt(prompt, replacements)

    expect(result).not.toContain("https://example.com")
    expect(result).not.toContain("http://other.site")
    expect(result).toContain("[redacted]")
  })

  it("handles multiple PII types in a single prompt", () => {
    const ctx = makeMockCtx({ orgName: "FC Legends" })
    const replacements = buildPIIReplacements(ctx, ["Karim Benzema"])
    const prompt = [
      "Karim Benzema is a member of FC Legends.",
      "Contact: karim@legends.com, +33-612-345-6789.",
      "Profile: https://fc-legends.com/karim",
    ].join(" ")

    const result = sanitizePrompt(prompt, replacements)

    expect(result).not.toContain("Karim Benzema")
    expect(result).not.toContain("FC Legends")
    expect(result).not.toContain("karim@legends.com")
    expect(result).not.toContain("+33-612-345-6789")
    expect(result).not.toContain("https://fc-legends.com/karim")
    expect(result).toContain("this member")
    expect(result).toContain("this group")
    expect(result).toContain("[redacted]")
  })

  it("preserves statistical data", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const prompt = [
      "Attendance rate: 85.5%.",
      "Total sessions: 42.",
      "Ranking: #3 out of 120 members.",
      "Win rate: 67%, 15 wins, 7 losses.",
    ].join(" ")

    const result = sanitizePrompt(prompt, replacements)

    expect(result).toContain("85.5%")
    expect(result).toContain("42")
    expect(result).toContain("#3")
    expect(result).toContain("120 members")
    expect(result).toContain("67%")
    expect(result).toContain("15 wins")
    expect(result).toContain("7 losses")
  })

  it("handles prompts with no PII (passthrough)", () => {
    const replacements = buildPIIReplacements(makeMockCtx())
    const prompt =
      "Summarize the attendance trends for the past month."
    const result = sanitizePrompt(prompt, replacements)

    expect(result).toBe(prompt)
  })

  it("handles overlapping names — longest first prevents partial corruption", () => {
    const ctx = makeMockCtx({ userName: "" })
    const replacements = buildPIIReplacements(ctx, [
      "Sara",
      "Sara Nasser",
    ])
    const prompt =
      "Sara Nasser attended 10 sessions. Sara left early once."

    const result = sanitizePrompt(prompt, replacements)

    // "Sara Nasser" should be replaced as a whole unit first
    expect(result).toBe(
      "this member attended 10 sessions. this member left early once."
    )
    // Should not produce "this member Nasser" from partial replacement
    expect(result).not.toContain("Nasser")
  })

  it("replaces all occurrences of the same name", () => {
    const ctx = makeMockCtx({ orgName: "My Club" })
    const replacements = buildPIIReplacements(ctx, ["Ahmed"])
    const prompt = "Ahmed scored. Ahmed assisted. Ahmed was MVP."
    const result = sanitizePrompt(prompt, replacements)

    expect(result).toBe(
      "this member scored. this member assisted. this member was MVP."
    )
  })

  it("replaces all occurrences of the org name", () => {
    const ctx = makeMockCtx({ orgName: "FC Stars" })
    const replacements = buildPIIReplacements(ctx)
    const prompt =
      "FC Stars is great. I love FC Stars. FC Stars forever."
    const result = sanitizePrompt(prompt, replacements)

    expect(result).toBe(
      "this group is great. I love this group. this group forever."
    )
  })
})

describe("integration: full prompt sanitization", () => {
  it("sanitizes a realistic member profile prompt while preserving stats", () => {
    const ctx = makeMockCtx({
      orgName: "Sunday Football Club",
      userName: "Admin User",
    })
    const replacements = buildPIIReplacements(ctx, [
      "Sara Nasser",
      "Mostafa Ali",
      "Ahmed Hassan",
    ])

    const prompt = [
      "Member Profile Summary for Sara Nasser:",
      "",
      "Sara Nasser is a member of Sunday Football Club.",
      "Email: sara.nasser@gmail.com",
      "Phone: +20-100-123-4567",
      "LinkedIn: https://linkedin.com/in/sara-nasser",
      "",
      "Statistics:",
      "- Attendance rate: 92.3% (48 out of 52 sessions)",
      "- Ranking: #2 out of 85 members",
      "- Win rate: 71%, 34 wins, 14 losses",
      "- Goals scored: 127, Assists: 45",
      "- Average rating: 8.2/10",
      "",
      "Form answers:",
      '- "What position do you play?" => Striker',
      '- "Experience level?" => Advanced (10+ years)',
      "",
      "Notes from admins:",
      "- Admin User noted: reliable and always on time",
      "- Ahmed Hassan recommended promotion to captain",
      "",
      "Recent sessions attended: 15 in the last month.",
      "Mostafa Ali was in the same team 8 times.",
    ].join("\n")

    const result = sanitizePrompt(prompt, replacements)

    // Names should be replaced
    expect(result).not.toContain("Sara Nasser")
    expect(result).not.toContain("Mostafa Ali")
    expect(result).not.toContain("Ahmed Hassan")
    expect(result).not.toContain("Admin User")

    // Org name should be replaced
    expect(result).not.toContain("Sunday Football Club")

    // Email should be redacted
    expect(result).not.toContain("sara.nasser@gmail.com")

    // Phone should be redacted
    expect(result).not.toContain("+20-100-123-4567")

    // URL should be redacted
    expect(result).not.toContain("https://linkedin.com/in/sara-nasser")

    // Replacements should be present
    expect(result).toContain("this member")
    expect(result).toContain("this group")
    expect(result).toContain("[redacted]")

    // Stats should be preserved
    expect(result).toContain("92.3%")
    expect(result).toContain("48 out of 52 sessions")
    expect(result).toContain("#2 out of 85 members")
    expect(result).toContain("71%")
    expect(result).toContain("34 wins")
    expect(result).toContain("14 losses")
    expect(result).toContain("Goals scored: 127")
    expect(result).toContain("Assists: 45")
    expect(result).toContain("8.2/10")
    expect(result).toContain("15 in the last month")
    expect(result).toContain("8 times")

    // Form answers should be preserved
    expect(result).toContain("Striker")
    expect(result).toContain("Advanced (10+ years)")
  })
})

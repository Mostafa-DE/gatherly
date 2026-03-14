/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest"
import { parseInsights } from "@/components/ai-insights"

describe("InsightsPanel", () => {
  it("parses bullet-prefixed insight lines", () => {
    expect(
      parseInsights(
        "- [STRENGTH] Active Participation | Member of multiple activities with regular participation."
      )
    ).toEqual([
      {
        category: "STRENGTH",
        title: "Active Participation",
        description: "Member of multiple activities with regular participation.",
      },
    ])
  })
})

import { describe, it, expect } from "vitest"
import { generateBracket } from "./index"
import type { BracketEntry } from "./types"

function makeEntries(count: number): BracketEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    entryId: `entry-${i + 1}`,
    seed: i + 1,
  }))
}

describe("generateBracket", () => {
  it("dispatches single_elimination", () => {
    const result = generateBracket("single_elimination", {
      entries: makeEntries(4),
      config: {},
    })
    expect(result.stages[0].stageType).toBe("single_elimination")
  })

  it("dispatches double_elimination", () => {
    const result = generateBracket("double_elimination", {
      entries: makeEntries(4),
      config: {},
    })
    expect(result.stages[0].stageType).toBe("double_elimination")
  })

  it("dispatches round_robin", () => {
    const result = generateBracket("round_robin", {
      entries: makeEntries(4),
      config: {},
    })
    expect(result.stages[0].stageType).toBe("round_robin")
  })

  it("dispatches swiss", () => {
    const result = generateBracket("swiss", {
      entries: makeEntries(4),
      config: {},
    })
    expect(result.stages[0].stageType).toBe("swiss")
  })

  it("dispatches group_knockout", () => {
    const result = generateBracket("group_knockout", {
      entries: makeEntries(8),
      config: { groupCount: 2 },
    })
    expect(result.stages[0].stageType).toBe("group")
  })

  it("dispatches free_for_all", () => {
    const result = generateBracket("free_for_all", {
      entries: makeEntries(4),
      config: {},
    })
    expect(result.stages[0].stageType).toBe("free_for_all")
  })
})

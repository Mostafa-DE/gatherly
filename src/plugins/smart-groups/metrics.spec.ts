import { describe, it, expect } from "vitest"
import type { GroupEntry } from "./algorithm"
import type { Criteria } from "./schemas"
import {
  computeBalanceMetrics,
  computeClusterMetrics,
  inferFieldMeta,
} from "./metrics"

// =============================================================================
// Helpers
// =============================================================================

function makeEntry(userId: string, data: Record<string, unknown>): GroupEntry {
  return { userId, data }
}

// =============================================================================
// computeBalanceMetrics
// =============================================================================

describe("computeBalanceMetrics", () => {
  const balancedCriteria = {
    mode: "balanced" as const,
    balanceFields: [{ sourceId: "skill", weight: 1 }],
    teamCount: 2,
  }

  it("returns 100% for perfectly balanced groups", () => {
    const entries = [
      makeEntry("a", { skill: 5 }),
      makeEntry("b", { skill: 5 }),
      makeEntry("c", { skill: 5 }),
      makeEntry("d", { skill: 5 }),
    ]
    const groups = [
      { groupName: "Team 1", memberIds: ["a", "b"] },
      { groupName: "Team 2", memberIds: ["c", "d"] },
    ]

    const result = computeBalanceMetrics(groups, entries, balancedCriteria)

    expect(result.mode).toBe("balanced")
    expect(result.balancePercent).toBe(100)
    expect(result.perFieldGap["skill"]).toBe(0)
    expect(result.perGroup).toHaveLength(2)
    expect(result.perGroup[0].fieldAverages["skill"]).toBe(5)
  })

  it("returns lower % for imbalanced groups", () => {
    const entries = [
      makeEntry("a", { skill: 10 }),
      makeEntry("b", { skill: 10 }),
      makeEntry("c", { skill: 1 }),
      makeEntry("d", { skill: 1 }),
    ]
    const groups = [
      { groupName: "Team 1", memberIds: ["a", "b"] },
      { groupName: "Team 2", memberIds: ["c", "d"] },
    ]

    const result = computeBalanceMetrics(groups, entries, balancedCriteria)

    expect(result.balancePercent).toBeLessThan(100)
    expect(result.perFieldGap["skill"]).toBe(9) // 10 - 1
    expect(result.perGroup[0].fieldAverages["skill"]).toBe(10)
    expect(result.perGroup[1].fieldAverages["skill"]).toBe(1)
  })

  it("handles multiple balance fields with weights", () => {
    const criteria = {
      mode: "balanced" as const,
      balanceFields: [
        { sourceId: "skill", weight: 0.7 },
        { sourceId: "experience", weight: 0.3 },
      ],
      teamCount: 2,
    }

    const entries = [
      makeEntry("a", { skill: 8, experience: 5 }),
      makeEntry("b", { skill: 2, experience: 5 }),
      makeEntry("c", { skill: 8, experience: 5 }),
      makeEntry("d", { skill: 2, experience: 5 }),
    ]
    const groups = [
      { groupName: "Team 1", memberIds: ["a", "d"] },
      { groupName: "Team 2", memberIds: ["b", "c"] },
    ]

    const result = computeBalanceMetrics(groups, entries, criteria)

    // Both groups have same avg for both fields
    expect(result.balancePercent).toBe(100)
    expect(result.perFieldGap["skill"]).toBe(0)
    expect(result.perFieldGap["experience"]).toBe(0)
  })

  it("handles missing entry data gracefully", () => {
    const entries = [
      makeEntry("a", { skill: 5 }),
      makeEntry("b", {}),
    ]
    const groups = [
      { groupName: "Team 1", memberIds: ["a"] },
      { groupName: "Team 2", memberIds: ["b"] },
    ]

    const result = computeBalanceMetrics(groups, entries, balancedCriteria)

    expect(result.mode).toBe("balanced")
    expect(result.perGroup[0].fieldAverages["skill"]).toBe(5)
    // "b" has NaN for skill → count stays 0 → avg is 0
    expect(result.perGroup[1].fieldAverages["skill"]).toBe(0)
  })

  it("handles single group", () => {
    const entries = [
      makeEntry("a", { skill: 3 }),
      makeEntry("b", { skill: 7 }),
    ]
    const groups = [{ groupName: "Team 1", memberIds: ["a", "b"] }]

    const result = computeBalanceMetrics(groups, entries, balancedCriteria)

    expect(result.balancePercent).toBe(100) // single group → gap is 0
    expect(result.perFieldGap["skill"]).toBe(0)
  })
})

// =============================================================================
// computeClusterMetrics
// =============================================================================

describe("computeClusterMetrics", () => {
  it("returns high cohesion for similar groups in similarity mode", () => {
    const entries = [
      makeEntry("a", { score: 10 }),
      makeEntry("b", { score: 10 }),
      makeEntry("c", { score: 1 }),
      makeEntry("d", { score: 1 }),
    ]
    const groups = [
      { groupName: "Group 1", memberIds: ["a", "b"] },
      { groupName: "Group 2", memberIds: ["c", "d"] },
    ]
    const criteria: Extract<Criteria, { mode: "similarity" }> = {
      mode: "similarity",
      fields: [{ sourceId: "score", weight: 1 }],
      groupCount: 2,
    }

    const result = computeClusterMetrics(groups, entries, criteria)

    expect(result.mode).toBe("similarity")
    expect(result.qualityPercent).toBe(100) // identical members → 0 intra distance
    expect(result.perGroup[0].avgIntraDistance).toBe(0)
    expect(result.perGroup[1].avgIntraDistance).toBe(0)
  })

  it("returns lower cohesion for mixed groups in similarity mode", () => {
    const entries = [
      makeEntry("a", { score: 10 }),
      makeEntry("b", { score: 1 }),
      makeEntry("c", { score: 10 }),
      makeEntry("d", { score: 1 }),
    ]
    const groups = [
      { groupName: "Group 1", memberIds: ["a", "b"] },
      { groupName: "Group 2", memberIds: ["c", "d"] },
    ]
    const criteria: Extract<Criteria, { mode: "similarity" }> = {
      mode: "similarity",
      fields: [{ sourceId: "score", weight: 1 }],
      groupCount: 2,
    }

    const result = computeClusterMetrics(groups, entries, criteria)

    expect(result.qualityPercent).toBeLessThan(100)
    expect(result.perGroup[0].avgIntraDistance).toBeGreaterThan(0)
  })

  it("returns high diversity for diverse groups in diversity mode", () => {
    const entries = [
      makeEntry("a", { score: 10 }),
      makeEntry("b", { score: 1 }),
      makeEntry("c", { score: 10 }),
      makeEntry("d", { score: 1 }),
    ]
    const groups = [
      { groupName: "Group 1", memberIds: ["a", "b"] },
      { groupName: "Group 2", memberIds: ["c", "d"] },
    ]
    const criteria: Extract<Criteria, { mode: "diversity" }> = {
      mode: "diversity",
      fields: [{ sourceId: "score", weight: 1 }],
      groupCount: 2,
    }

    const result = computeClusterMetrics(groups, entries, criteria)

    expect(result.mode).toBe("diversity")
    expect(result.qualityPercent).toBeGreaterThan(50)
  })

  it("handles single-member groups", () => {
    const entries = [
      makeEntry("a", { score: 5 }),
      makeEntry("b", { score: 10 }),
    ]
    const groups = [
      { groupName: "Group 1", memberIds: ["a"] },
      { groupName: "Group 2", memberIds: ["b"] },
    ]
    const criteria: Extract<Criteria, { mode: "similarity" }> = {
      mode: "similarity",
      fields: [{ sourceId: "score", weight: 1 }],
      groupCount: 2,
    }

    const result = computeClusterMetrics(groups, entries, criteria)

    // Single-member groups have 0 intra-distance → 100% cohesion
    expect(result.qualityPercent).toBe(100)
    expect(result.perGroup[0].avgIntraDistance).toBe(0)
  })

  it("handles multiselect fields", () => {
    const entries = [
      makeEntry("a", { tags: ["x", "y"] }),
      makeEntry("b", { tags: ["x", "y"] }),
      makeEntry("c", { tags: ["z"] }),
      makeEntry("d", { tags: ["z"] }),
    ]
    const groups = [
      { groupName: "Group 1", memberIds: ["a", "b"] },
      { groupName: "Group 2", memberIds: ["c", "d"] },
    ]
    const criteria: Extract<Criteria, { mode: "similarity" }> = {
      mode: "similarity",
      fields: [{ sourceId: "tags", weight: 1 }],
      groupCount: 2,
    }

    const result = computeClusterMetrics(groups, entries, criteria)

    expect(result.qualityPercent).toBe(100) // identical within groups
  })
})

// =============================================================================
// inferFieldMeta
// =============================================================================

describe("inferFieldMeta", () => {
  it("infers number type from numeric data", () => {
    const entries = [makeEntry("a", { score: 5 })]
    const fields = inferFieldMeta([{ sourceId: "score", weight: 1 }], entries)

    expect(fields[0].type).toBe("number")
    expect(fields[0].sourceId).toBe("score")
    expect(fields[0].weight).toBe(1)
  })

  it("infers checkbox type from boolean data", () => {
    const entries = [makeEntry("a", { active: true })]
    const fields = inferFieldMeta([{ sourceId: "active", weight: 1 }], entries)

    expect(fields[0].type).toBe("checkbox")
  })

  it("infers multiselect type from array data", () => {
    const entries = [makeEntry("a", { tags: ["x", "y"] })]
    const fields = inferFieldMeta([{ sourceId: "tags", weight: 1 }], entries)

    expect(fields[0].type).toBe("multiselect")
  })

  it("infers select type from string data", () => {
    const entries = [makeEntry("a", { level: "beginner" })]
    const fields = inferFieldMeta([{ sourceId: "level", weight: 1 }], entries)

    expect(fields[0].type).toBe("select")
  })

  it("defaults to text when all values are null", () => {
    const entries = [makeEntry("a", { missing: null })]
    const fields = inferFieldMeta([{ sourceId: "missing", weight: 1 }], entries)

    expect(fields[0].type).toBe("text")
  })

  it("skips null entries and infers from first non-null", () => {
    const entries = [
      makeEntry("a", { val: null }),
      makeEntry("b", { val: 42 }),
    ]
    const fields = inferFieldMeta([{ sourceId: "val", weight: 1 }], entries)

    expect(fields[0].type).toBe("number")
  })
})

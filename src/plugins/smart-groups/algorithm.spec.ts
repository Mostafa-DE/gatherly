import { describe, it, expect } from "vitest"
import {
  splitByAttribute,
  splitByAttributes,
  clusterByDistance,
  multiBalancedTeams,
  type GroupEntry,
} from "./algorithm"
import type { FieldMeta } from "./distance"

describe("splitByAttribute (single field)", () => {
  it("returns empty array for empty entries", () => {
    expect(splitByAttribute([], "org:gender")).toEqual([])
  })

  it("groups entries by a single field", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:gender": "Male" } },
      { userId: "u2", data: { "org:gender": "Female" } },
      { userId: "u3", data: { "org:gender": "Male" } },
    ]

    const result = splitByAttribute(entries, "org:gender")

    expect(result).toEqual([
      { groupName: "Female", memberIds: ["u2"] },
      { groupName: "Male", memberIds: ["u1", "u3"] },
    ])
  })

  it("buckets entries with missing field as 'Unknown'", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:gender": "Male" } },
      { userId: "u2", data: {} },
      { userId: "u3", data: { "org:gender": null } },
    ]

    const result = splitByAttribute(entries, "org:gender")

    expect(result).toEqual([
      { groupName: "Male", memberIds: ["u1"] },
      { groupName: "Unknown", memberIds: ["u2", "u3"] },
    ])
  })

  it("handles all entries in one group", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:level": "A" } },
      { userId: "u2", data: { "org:level": "A" } },
    ]

    const result = splitByAttribute(entries, "org:level")

    expect(result).toEqual([{ groupName: "A", memberIds: ["u1", "u2"] }])
  })

  it("handles all entries missing the field", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:other": "X" } },
      { userId: "u2", data: {} },
    ]

    const result = splitByAttribute(entries, "org:gender")

    expect(result).toEqual([
      { groupName: "Unknown", memberIds: ["u1", "u2"] },
    ])
  })

  it("treats empty string as Unknown", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:gender": "" } },
      { userId: "u2", data: { "org:gender": "Male" } },
    ]

    const result = splitByAttribute(entries, "org:gender")

    expect(result).toEqual([
      { groupName: "Male", memberIds: ["u2"] },
      { groupName: "Unknown", memberIds: ["u1"] },
    ])
  })
})

describe("splitByAttributes (multi-field)", () => {
  it("returns empty array for empty fieldIds", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:gender": "Male" } },
    ]
    expect(splitByAttributes(entries, [])).toEqual([])
  })

  it("creates cross-product groups for 2 fields", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:gender": "Male", "session:level": "Advanced" } },
      { userId: "u2", data: { "org:gender": "Female", "session:level": "Beginner" } },
      { userId: "u3", data: { "org:gender": "Male", "session:level": "Beginner" } },
      { userId: "u4", data: { "org:gender": "Female", "session:level": "Advanced" } },
    ]

    const result = splitByAttributes(entries, ["org:gender", "session:level"])

    expect(result).toEqual([
      { groupName: "Female + Advanced", memberIds: ["u4"] },
      { groupName: "Female + Beginner", memberIds: ["u2"] },
      { groupName: "Male + Advanced", memberIds: ["u1"] },
      { groupName: "Male + Beginner", memberIds: ["u3"] },
    ])
  })

  it("handles one field null in multi-field split", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:gender": "Male", "session:level": "A" } },
      { userId: "u2", data: { "org:gender": "Female" } },
      { userId: "u3", data: { "session:level": "A" } },
    ]

    const result = splitByAttributes(entries, ["org:gender", "session:level"])

    expect(result).toEqual([
      { groupName: "Female + Unknown", memberIds: ["u2"] },
      { groupName: "Male + A", memberIds: ["u1"] },
      { groupName: "Unknown + A", memberIds: ["u3"] },
    ])
  })

  it("handles all entries with same values", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "org:gender": "M", "org:level": "A" } },
      { userId: "u2", data: { "org:gender": "M", "org:level": "A" } },
    ]

    const result = splitByAttributes(entries, ["org:gender", "org:level"])

    expect(result).toEqual([{ groupName: "M + A", memberIds: ["u1", "u2"] }])
  })

  it("converts numeric values to strings", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { "ranking:stat:wins": 5 } },
      { userId: "u2", data: { "ranking:stat:wins": 10 } },
      { userId: "u3", data: { "ranking:stat:wins": 5 } },
    ]

    const result = splitByAttribute(entries, "ranking:stat:wins")

    expect(result).toEqual([
      { groupName: "10", memberIds: ["u2"] },
      { groupName: "5", memberIds: ["u1", "u3"] },
    ])
  })
})

// =============================================================================
// clusterByDistance
// =============================================================================

describe("clusterByDistance", () => {
  it("returns empty array for empty entries", () => {
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]
    const result = clusterByDistance([], { groupCount: 2, fields, objective: "similarity" })
    expect(result).toEqual([])
  })

  it("similarity: separates two obvious clusters", () => {
    // Cluster A: score ~10, Cluster B: score ~90
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 12 } },
      { userId: "u3", data: { score: 11 } },
      { userId: "u4", data: { score: 88 } },
      { userId: "u5", data: { score: 90 } },
      { userId: "u6", data: { score: 92 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(2)

    // All members should be accounted for
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"])

    // Low-score cluster should contain u1, u2, u3 and high-score should contain u4, u5, u6
    const lowGroup = result.find((g) => g.memberIds.includes("u1"))!
    const highGroup = result.find((g) => g.memberIds.includes("u4"))!
    expect(lowGroup.memberIds.sort()).toEqual(["u1", "u2", "u3"])
    expect(highGroup.memberIds.sort()).toEqual(["u4", "u5", "u6"])
  })

  it("diversity: each group has mixed members", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 20 } },
      { userId: "u3", data: { score: 80 } },
      { userId: "u4", data: { score: 90 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "diversity",
    })

    expect(result).toHaveLength(2)

    // In diversity mode, each group should have a mix of low and high scores
    // (not all low in one, all high in another)
    for (const group of result) {
      const scores = group.memberIds.map(
        (id) => entries.find((e) => e.userId === id)!.data.score as number
      )
      const hasLow = scores.some((s) => s <= 20)
      const hasHigh = scores.some((s) => s >= 80)
      expect(hasLow).toBe(true)
      expect(hasHigh).toBe(true)
    }
  })

  it("handles groupCount >= entries (each person is their own group)", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { x: "A" } },
      { userId: "u2", data: { x: "B" } },
    ]
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]

    const result = clusterByDistance(entries, {
      groupCount: 5,
      fields,
      objective: "similarity",
    })

    // Should create at most n groups
    expect(result).toHaveLength(2)
    expect(result[0].memberIds).toHaveLength(1)
    expect(result[1].memberIds).toHaveLength(1)
  })

  it("groupCount = 1 puts everyone in one group", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { x: 1 } },
      { userId: "u2", data: { x: 2 } },
      { userId: "u3", data: { x: 3 } },
    ]
    const fields: FieldMeta[] = [{ sourceId: "x", type: "number", weight: 1 }]

    const result = clusterByDistance(entries, {
      groupCount: 1,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(1)
    expect(result[0].memberIds.sort()).toEqual(["u1", "u2", "u3"])
  })

  it("names groups as 'Group 1', 'Group 2', etc.", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { x: "A" } },
      { userId: "u2", data: { x: "B" } },
      { userId: "u3", data: { x: "C" } },
    ]
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]

    const result = clusterByDistance(entries, {
      groupCount: 3,
      fields,
      objective: "similarity",
    })

    expect(result.map((g) => g.groupName)).toEqual(["Group 1", "Group 2", "Group 3"])
  })
})

// =============================================================================
// multiBalancedTeams
// =============================================================================

describe("multiBalancedTeams", () => {
  it("returns empty array for empty entries", () => {
    const result = multiBalancedTeams([], { teamCount: 2, balanceFields: [{ sourceId: "wins", weight: 1 }] })
    expect(result).toEqual([])
  })

  it("creates teams with similar average ratings", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { wins: 10 } },
      { userId: "u2", data: { wins: 9 } },
      { userId: "u3", data: { wins: 8 } },
      { userId: "u4", data: { wins: 7 } },
      { userId: "u5", data: { wins: 6 } },
      { userId: "u6", data: { wins: 5 } },
      { userId: "u7", data: { wins: 4 } },
      { userId: "u8", data: { wins: 3 } },
    ]

    const result = multiBalancedTeams(entries, { teamCount: 2, balanceFields: [{ sourceId: "wins", weight: 1 }] })

    expect(result).toHaveLength(2)

    // All members assigned
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"])

    // Team averages should be close
    const teamAvgs = result.map((t) => {
      const sum = t.memberIds.reduce(
        (acc, id) => acc + (entries.find((e) => e.userId === id)!.data.wins as number),
        0
      )
      return sum / t.memberIds.length
    })

    const spread = Math.max(...teamAvgs) - Math.min(...teamAvgs)
    expect(spread).toBeLessThan(2) // Should be very balanced
  })

  it("snake draft produces correct order", () => {
    // With 4 players sorted [10, 8, 6, 4] → snake: T1=10, T2=8, T2=6, T1=4
    // T1: [10, 4] avg=7, T2: [8, 6] avg=7
    const entries: GroupEntry[] = [
      { userId: "u1", data: { rating: 10 } },
      { userId: "u2", data: { rating: 8 } },
      { userId: "u3", data: { rating: 6 } },
      { userId: "u4", data: { rating: 4 } },
    ]

    const result = multiBalancedTeams(entries, { teamCount: 2, balanceFields: [{ sourceId: "rating", weight: 1 }] })

    expect(result).toHaveLength(2)

    // After snake draft: T1=[u1,u4], T2=[u2,u3]
    // Both teams have avg=7 — perfectly balanced
    const team1Avg = result[0].memberIds.reduce(
      (acc, id) => acc + (entries.find((e) => e.userId === id)!.data.rating as number),
      0
    ) / result[0].memberIds.length

    const team2Avg = result[1].memberIds.reduce(
      (acc, id) => acc + (entries.find((e) => e.userId === id)!.data.rating as number),
      0
    ) / result[1].memberIds.length

    expect(Math.abs(team1Avg - team2Avg)).toBeLessThan(0.01)
  })

  it("handles all same rating", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 5 } },
      { userId: "u2", data: { score: 5 } },
      { userId: "u3", data: { score: 5 } },
      { userId: "u4", data: { score: 5 } },
    ]

    const result = multiBalancedTeams(entries, { teamCount: 2, balanceFields: [{ sourceId: "score", weight: 1 }] })

    expect(result).toHaveLength(2)
    expect(result[0].memberIds).toHaveLength(2)
    expect(result[1].memberIds).toHaveLength(2)
  })

  it("handles teamCount >= entries", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 5 } },
    ]

    const result = multiBalancedTeams(entries, { teamCount: 5, balanceFields: [{ sourceId: "score", weight: 1 }] })

    // Should create at most n teams
    expect(result).toHaveLength(2)
  })

  it("names teams as 'Team 1', 'Team 2', etc.", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 5 } },
      { userId: "u3", data: { score: 8 } },
    ]

    const result = multiBalancedTeams(entries, { teamCount: 3, balanceFields: [{ sourceId: "score", weight: 1 }] })

    expect(result.map((t) => t.groupName)).toEqual(["Team 1", "Team 2", "Team 3"])
  })

  it("swap optimization improves balance", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 100 } },
      { userId: "u2", data: { score: 50 } },
      { userId: "u3", data: { score: 49 } },
      { userId: "u4", data: { score: 1 } },
      { userId: "u5", data: { score: 90 } },
      { userId: "u6", data: { score: 10 } },
    ]

    const result = multiBalancedTeams(entries, { teamCount: 2, balanceFields: [{ sourceId: "score", weight: 1 }] })

    const teamAvgs = result.map((t) => {
      const sum = t.memberIds.reduce(
        (acc, id) => acc + (entries.find((e) => e.userId === id)!.data.score as number),
        0
      )
      return sum / t.memberIds.length
    })

    const spread = Math.max(...teamAvgs) - Math.min(...teamAvgs)
    // After swap optimization, teams should be reasonably balanced
    expect(spread).toBeLessThan(10)
  })
})

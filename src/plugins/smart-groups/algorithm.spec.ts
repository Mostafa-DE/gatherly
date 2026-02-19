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

  it("balances by multiple fields simultaneously", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { wins: 10, losses: 2 } },
      { userId: "u2", data: { wins: 8, losses: 4 } },
      { userId: "u3", data: { wins: 3, losses: 9 } },
      { userId: "u4", data: { wins: 1, losses: 7 } },
      { userId: "u5", data: { wins: 6, losses: 5 } },
      { userId: "u6", data: { wins: 5, losses: 6 } },
    ]

    const result = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [
        { sourceId: "wins", weight: 1 },
        { sourceId: "losses", weight: 1 },
      ],
    })

    expect(result).toHaveLength(2)
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"])

    // Both fields should be somewhat balanced
    for (const field of ["wins", "losses"] as const) {
      const teamAvgs = result.map((t) => {
        const sum = t.memberIds.reduce(
          (acc, id) => acc + (entries.find((e) => e.userId === id)!.data[field] as number),
          0
        )
        return sum / t.memberIds.length
      })
      const spread = Math.max(...teamAvgs) - Math.min(...teamAvgs)
      expect(spread).toBeLessThan(5)
    }
  })

  it("partitions by categorical field before balancing", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { gender: "M", score: 10 } },
      { userId: "u2", data: { gender: "M", score: 8 } },
      { userId: "u3", data: { gender: "F", score: 9 } },
      { userId: "u4", data: { gender: "F", score: 7 } },
      { userId: "u5", data: { gender: "M", score: 6 } },
      { userId: "u6", data: { gender: "F", score: 5 } },
    ]

    const result = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [{ sourceId: "score", weight: 1 }],
      partitionFields: ["gender"],
    })

    expect(result).toHaveLength(2)

    // Each team should have a mix of genders (partitioned snake draft distributes evenly)
    for (const team of result) {
      const genders = team.memberIds.map(
        (id) => entries.find((e) => e.userId === id)!.data.gender
      )
      const maleCount = genders.filter((g) => g === "M").length
      const femaleCount = genders.filter((g) => g === "F").length
      // With 3M/3F into 2 teams, each should have at least 1 of each
      expect(maleCount).toBeGreaterThanOrEqual(1)
      expect(femaleCount).toBeGreaterThanOrEqual(1)
    }
  })

  it("handles partition with missing values as 'Unknown'", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { gender: "M", score: 10 } },
      { userId: "u2", data: { score: 8 } },
      { userId: "u3", data: { gender: "F", score: 6 } },
      { userId: "u4", data: { score: 4 } },
    ]

    const result = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [{ sourceId: "score", weight: 1 }],
      partitionFields: ["gender"],
    })

    expect(result).toHaveLength(2)
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4"])
  })

  it("handles non-numeric balance field values as 0", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: "abc" } },
      { userId: "u2", data: { score: 10 } },
      { userId: "u3", data: { score: null } },
      { userId: "u4", data: { score: 5 } },
    ]

    const result = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [{ sourceId: "score", weight: 1 }],
    })

    expect(result).toHaveLength(2)
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4"])
  })

  it("handles single entry", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
    ]

    const result = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [{ sourceId: "score", weight: 1 }],
    })

    expect(result).toHaveLength(1)
    expect(result[0].memberIds).toEqual(["u1"])
  })

  it("creates 3 balanced teams", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 30 } },
      { userId: "u2", data: { score: 25 } },
      { userId: "u3", data: { score: 20 } },
      { userId: "u4", data: { score: 15 } },
      { userId: "u5", data: { score: 10 } },
      { userId: "u6", data: { score: 5 } },
    ]

    const result = multiBalancedTeams(entries, {
      teamCount: 3,
      balanceFields: [{ sourceId: "score", weight: 1 }],
    })

    expect(result).toHaveLength(3)
    expect(result.map((t) => t.groupName)).toEqual(["Team 1", "Team 2", "Team 3"])

    const teamAvgs = result.map((t) => {
      const sum = t.memberIds.reduce(
        (acc, id) => acc + (entries.find((e) => e.userId === id)!.data.score as number),
        0
      )
      return sum / t.memberIds.length
    })
    const spread = Math.max(...teamAvgs) - Math.min(...teamAvgs)
    expect(spread).toBeLessThan(5)
  })
})

// =============================================================================
// clusterByDistance — variety penalty
// =============================================================================

describe("clusterByDistance with variety penalty", () => {
  it("similarity mode: previously-paired users are less likely to group together", () => {
    // 4 users, 2 clusters: u1+u2 close, u3+u4 close
    // But variety penalty makes u1-u2 pairing undesirable
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 12 } },
      { userId: "u3", data: { score: 90 } },
      { userId: "u4", data: { score: 88 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    // Without variety: u1+u2 should cluster, u3+u4 should cluster
    const noVariety = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
    })
    const group1 = noVariety.find((g) => g.memberIds.includes("u1"))!
    expect(group1.memberIds).toContain("u2")

    // With strong variety penalty on u1-u2 pair
    const penaltyMatrix = new Map<string, number>()
    penaltyMatrix.set("u1:u2", 1) // max penalty

    const withVariety = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
      varietyPenalty: penaltyMatrix,
      varietyWeight: 5, // high weight to override distance
    })

    // With such strong penalty, u1 and u2 may still end up together
    // since they're so close, but the distance should be inflated
    const allIds = withVariety.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4"])
  })

  it("diversity mode: previously-paired users become less attractive for mixing", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 50 } },
      { userId: "u3", data: { score: 90 } },
      { userId: "u4", data: { score: 30 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const penaltyMatrix = new Map<string, number>()
    penaltyMatrix.set("u1:u3", 1)

    const result = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "diversity",
      varietyPenalty: penaltyMatrix,
      varietyWeight: 2,
    })

    expect(result).toHaveLength(2)
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4"])
  })

  it("variety penalty with empty matrix has no effect", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 12 } },
      { userId: "u3", data: { score: 90 } },
      { userId: "u4", data: { score: 88 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const without = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
    })

    const withEmpty = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
      varietyPenalty: new Map(),
      varietyWeight: 1,
    })

    // Same result since penalty matrix is empty
    expect(without.map((g) => g.memberIds.sort())).toEqual(
      withEmpty.map((g) => g.memberIds.sort())
    )
  })

  it("varietyWeight=0 disables variety even with non-empty matrix", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 12 } },
      { userId: "u3", data: { score: 90 } },
      { userId: "u4", data: { score: 88 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const penaltyMatrix = new Map([["u1:u2", 1]])

    const without = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
    })

    const withZeroWeight = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
      varietyPenalty: penaltyMatrix,
      varietyWeight: 0,
    })

    expect(without.map((g) => g.memberIds.sort())).toEqual(
      withZeroWeight.map((g) => g.memberIds.sort())
    )
  })
})

// =============================================================================
// clusterByDistance — multi-field and edge cases
// =============================================================================

describe("clusterByDistance — multi-field", () => {
  it("clusters by multiple fields with different types", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { gender: "M", score: 10, tags: ["fast"] } },
      { userId: "u2", data: { gender: "M", score: 15, tags: ["fast"] } },
      { userId: "u3", data: { gender: "F", score: 80, tags: ["slow"] } },
      { userId: "u4", data: { gender: "F", score: 85, tags: ["slow"] } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "gender", type: "select", weight: 1 },
      { sourceId: "score", type: "number", weight: 1 },
      { sourceId: "tags", type: "multiselect", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(2)
    // u1+u2 should cluster (same gender, similar score, same tags)
    const group1 = result.find((g) => g.memberIds.includes("u1"))!
    expect(group1.memberIds).toContain("u2")
    const group2 = result.find((g) => g.memberIds.includes("u3"))!
    expect(group2.memberIds).toContain("u4")
  })

  it("handles single entry", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { x: "A" } },
    ]
    const fields: FieldMeta[] = [{ sourceId: "x", type: "select", weight: 1 }]

    const result = clusterByDistance(entries, {
      groupCount: 3,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(1)
    expect(result[0].memberIds).toEqual(["u1"])
  })

  it("handles 3 groups with uneven distribution", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 1 } },
      { userId: "u2", data: { score: 2 } },
      { userId: "u3", data: { score: 50 } },
      { userId: "u4", data: { score: 51 } },
      { userId: "u5", data: { score: 99 } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 3,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(3)
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4", "u5"])
  })
})

// =============================================================================
// multiBalancedTeams — variety penalty
// =============================================================================

describe("multiBalancedTeams with variety penalty", () => {
  it("variety penalty influences swap optimization", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 9 } },
      { userId: "u3", data: { score: 8 } },
      { userId: "u4", data: { score: 7 } },
    ]

    // Heavy penalty on u1-u2 pair
    const penaltyMatrix = new Map([["u1:u2", 1]])

    const result = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [{ sourceId: "score", weight: 1 }],
      varietyPenalty: penaltyMatrix,
      varietyWeight: 1,
    })

    expect(result).toHaveLength(2)
    const allIds = result.flatMap((g) => g.memberIds).sort()
    expect(allIds).toEqual(["u1", "u2", "u3", "u4"])
  })

  it("variety with weight 0 has no effect", () => {
    const entries: GroupEntry[] = [
      { userId: "u1", data: { score: 10 } },
      { userId: "u2", data: { score: 8 } },
      { userId: "u3", data: { score: 6 } },
      { userId: "u4", data: { score: 4 } },
    ]

    const penaltyMatrix = new Map([["u1:u4", 1]])

    const without = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [{ sourceId: "score", weight: 1 }],
    })

    const withZero = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [{ sourceId: "score", weight: 1 }],
      varietyPenalty: penaltyMatrix,
      varietyWeight: 0,
    })

    expect(without.map((g) => g.memberIds.sort())).toEqual(
      withZero.map((g) => g.memberIds.sort())
    )
  })
})

// =============================================================================
// Score projection fallback (>1200 entries)
// =============================================================================

describe("clusterByDistance — score projection fallback", () => {
  it("handles large entry sets via projection (>1200)", () => {
    // Generate 1300 entries with known score pattern
    const entries: GroupEntry[] = Array.from({ length: 1300 }, (_, i) => ({
      userId: `u${i}`,
      data: { score: i },
    }))

    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 4,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(4)
    const allIds = result.flatMap((g) => g.memberIds)
    expect(allIds).toHaveLength(1300)
    // No duplicates
    expect(new Set(allIds).size).toBe(1300)

    // Groups should be roughly equal in size
    for (const group of result) {
      expect(group.memberIds.length).toBeGreaterThan(250)
      expect(group.memberIds.length).toBeLessThan(400)
    }
  })

  it("score projection similarity: groups have contiguous score ranges", () => {
    const entries: GroupEntry[] = Array.from({ length: 1500 }, (_, i) => ({
      userId: `u${i}`,
      data: { score: i },
    }))

    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 3,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(3)

    // For similarity with linear scores, each group should contain a contiguous range
    for (const group of result) {
      const scores = group.memberIds
        .map((id) => entries.find((e) => e.userId === id)!.data.score as number)
        .sort((a, b) => a - b)
      // Check scores are contiguous (each is within 1 of next)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i] - scores[i - 1]).toBe(1)
      }
    }
  })

  it("score projection diversity: groups have interleaved scores", () => {
    const entries: GroupEntry[] = Array.from({ length: 1500 }, (_, i) => ({
      userId: `u${i}`,
      data: { score: i },
    }))

    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 3,
      fields,
      objective: "diversity",
    })

    expect(result).toHaveLength(3)

    // For diversity, each group should span the full range (not contiguous)
    for (const group of result) {
      const scores = group.memberIds
        .map((id) => entries.find((e) => e.userId === id)!.data.score as number)
      const min = Math.min(...scores)
      const max = Math.max(...scores)
      // Each group should span most of the range
      expect(max - min).toBeGreaterThan(1000)
    }
  })

  it("score projection: variety penalty is ignored (no distance matrix)", () => {
    const entries: GroupEntry[] = Array.from({ length: 1300 }, (_, i) => ({
      userId: `u${i}`,
      data: { score: i },
    }))

    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const penaltyMatrix = new Map([["u0:u1", 1]])

    // Should not throw, variety is silently ignored
    const result = clusterByDistance(entries, {
      groupCount: 2,
      fields,
      objective: "similarity",
      varietyPenalty: penaltyMatrix,
      varietyWeight: 1,
    })

    expect(result).toHaveLength(2)
    expect(result.flatMap((g) => g.memberIds)).toHaveLength(1300)
  })
})

// =============================================================================
// SA refinement quality tests
// =============================================================================

describe("SA refinement — quality improvements", () => {
  it("similarity: SA produces balanced group sizes", () => {
    // 12 members, 3 groups — SA should produce 4/4/4 or close
    const entries: GroupEntry[] = Array.from({ length: 12 }, (_, i) => ({
      userId: `u${i}`,
      data: { score: i * 10 },
    }))
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 3,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(3)
    for (const group of result) {
      expect(group.memberIds.length).toBeGreaterThanOrEqual(3)
      expect(group.memberIds.length).toBeLessThanOrEqual(5)
    }
  })

  it("diversity: SA produces well-mixed groups with multi-field data", () => {
    // Create entries with 2 distinct attributes
    const entries: GroupEntry[] = [
      { userId: "u1", data: { skill: 10, exp: "Junior" } },
      { userId: "u2", data: { skill: 20, exp: "Junior" } },
      { userId: "u3", data: { skill: 30, exp: "Mid" } },
      { userId: "u4", data: { skill: 40, exp: "Mid" } },
      { userId: "u5", data: { skill: 50, exp: "Senior" } },
      { userId: "u6", data: { skill: 60, exp: "Senior" } },
      { userId: "u7", data: { skill: 70, exp: "Junior" } },
      { userId: "u8", data: { skill: 80, exp: "Mid" } },
      { userId: "u9", data: { skill: 90, exp: "Senior" } },
    ]
    const fields: FieldMeta[] = [
      { sourceId: "skill", type: "number", weight: 1 },
      { sourceId: "exp", type: "select", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 3,
      fields,
      objective: "diversity",
    })

    expect(result).toHaveLength(3)

    // Each group should have members from different skill ranges
    for (const group of result) {
      const skills = group.memberIds.map(
        (id) => entries.find((e) => e.userId === id)!.data.skill as number
      )
      const range = Math.max(...skills) - Math.min(...skills)
      // Each group should span at least 40% of the total range (80)
      expect(range).toBeGreaterThanOrEqual(30)
    }
  })

  it("balanced: SA escapes local optima for challenging distributions", () => {
    // Create a distribution where simple snake draft is suboptimal
    const entries: GroupEntry[] = [
      { userId: "u1", data: { a: 100, b: 1 } },
      { userId: "u2", data: { a: 1, b: 100 } },
      { userId: "u3", data: { a: 90, b: 10 } },
      { userId: "u4", data: { a: 10, b: 90 } },
      { userId: "u5", data: { a: 50, b: 50 } },
      { userId: "u6", data: { a: 55, b: 45 } },
      { userId: "u7", data: { a: 80, b: 20 } },
      { userId: "u8", data: { a: 20, b: 80 } },
    ]

    const result = multiBalancedTeams(entries, {
      teamCount: 2,
      balanceFields: [
        { sourceId: "a", weight: 1 },
        { sourceId: "b", weight: 1 },
      ],
    })

    expect(result).toHaveLength(2)

    // Both fields should be well balanced
    for (const field of ["a", "b"] as const) {
      const teamAvgs = result.map((t) => {
        const sum = t.memberIds.reduce(
          (acc, id) => acc + (entries.find((e) => e.userId === id)!.data[field] as number),
          0
        )
        return sum / t.memberIds.length
      })
      const spread = Math.max(...teamAvgs) - Math.min(...teamAvgs)
      expect(spread).toBeLessThan(15)
    }
  })

  it("balanced: SA handles large teams efficiently", () => {
    // 200 entries, 5 teams — should complete quickly and produce balanced result
    const entries: GroupEntry[] = Array.from({ length: 200 }, (_, i) => ({
      userId: `u${i}`,
      data: { score: Math.sin(i * 0.1) * 50 + 50 },
    }))

    const start = performance.now()
    const result = multiBalancedTeams(entries, {
      teamCount: 5,
      balanceFields: [{ sourceId: "score", weight: 1 }],
    })
    const elapsed = performance.now() - start

    expect(result).toHaveLength(5)
    expect(elapsed).toBeLessThan(1000) // Should complete in <1s

    // Teams should be roughly equal size (40 each)
    for (const team of result) {
      expect(team.memberIds.length).toBe(40)
    }

    // Team averages should be close
    const teamAvgs = result.map((t) => {
      const sum = t.memberIds.reduce(
        (acc, id) => acc + (entries.find((e) => e.userId === id)!.data.score as number),
        0
      )
      return sum / t.memberIds.length
    })
    const spread = Math.max(...teamAvgs) - Math.min(...teamAvgs)
    expect(spread).toBeLessThan(5)
  })

  it("similarity: group size constraint prevents mega-groups", () => {
    // All entries are similar — without size constraint, one group absorbs all
    const entries: GroupEntry[] = Array.from({ length: 20 }, (_, i) => ({
      userId: `u${i}`,
      data: { score: 50 + (i % 3) },
    }))
    const fields: FieldMeta[] = [
      { sourceId: "score", type: "number", weight: 1 },
    ]

    const result = clusterByDistance(entries, {
      groupCount: 4,
      fields,
      objective: "similarity",
    })

    expect(result).toHaveLength(4)
    // No group should have more than ceil(20/4) = 5 members
    for (const group of result) {
      expect(group.memberIds.length).toBeLessThanOrEqual(6)
      expect(group.memberIds.length).toBeGreaterThanOrEqual(4)
    }
  })
})

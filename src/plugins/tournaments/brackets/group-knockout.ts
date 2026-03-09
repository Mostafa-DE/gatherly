import type {
  BracketInput,
  BracketOutput,
  GeneratedRound,
  GeneratedStage,
  BracketEntry,
} from "./types"
import { snakeDraft } from "./seeding"
import { generateRoundRobin } from "./round-robin"
import { generateSingleElimination } from "./single-elimination"

/**
 * Generate a group + knockout tournament.
 *
 * Phase 1: Group stage (round-robin within each group)
 * Phase 2: Knockout (single elimination from top N per group)
 */
export function generateGroupKnockout(input: BracketInput): BracketOutput {
  const { entries, config } = input
  const n = entries.length
  const groupCount = config.groupCount ?? 4
  const advancePerGroup = config.advancePerGroup ?? 2

  if (n < groupCount * 2) {
    throw new Error(
      `Group knockout requires at least ${groupCount * 2} entries for ${groupCount} groups`
    )
  }

  // Sort by seed and snake-draft into groups
  const sorted = [...entries].sort((a, b) => a.seed - b.seed)
  const groups = snakeDraft(sorted, groupCount)

  // Generate round-robin for each group
  const groupStage = generateGroupStage(groups)

  // Placeholder knockout stage (generated after group stage completes)
  const knockoutStage: GeneratedStage = {
    stageType: "single_elimination",
    stageOrder: 2,
    config: {
      advancePerGroup,
      thirdPlaceMatch: config.thirdPlaceMatch ?? false,
    },
    rounds: [],
    edges: [],
  }

  return {
    stages: [groupStage, knockoutStage],
  }
}

/**
 * Generate group stage: round-robin within each group.
 */
function generateGroupStage(groups: BracketEntry[][]): GeneratedStage {
  const allRounds: GeneratedRound[] = []
  let globalMatchCounter = 0

  const groupMeta = groups.map((_, i) => ({
    name: `Group ${String.fromCharCode(65 + i)}`, // A, B, C, ...
    groupOrder: i + 1,
  }))

  for (let g = 0; g < groups.length; g++) {
    const groupEntries = groups[g]
    // Re-seed within group
    const reseeded = groupEntries.map((e, i) => ({ ...e, seed: i + 1 }))
    const rr = generateRoundRobin({ entries: reseeded, config: {} })

    // Merge rounds, offset match numbers
    for (const round of rr.stages[0].rounds) {
      const adjustedMatches = round.matches.map((m) => {
        globalMatchCounter++
        return {
          ...m,
          matchNumber: globalMatchCounter,
          groupIndex: g,
        }
      })

      // Find existing round or create new one
      let existingRound = allRounds.find(
        (r) => r.roundNumber === round.roundNumber && r.groupIndex === g
      )
      if (!existingRound) {
        existingRound = {
          roundNumber: round.roundNumber,
          groupIndex: g,
          matches: [],
        }
        allRounds.push(existingRound)
      }
      existingRound.matches.push(...adjustedMatches)
    }
  }

  return {
    stageType: "group",
    stageOrder: 1,
    config: { groupCount: groups.length },
    groups: groupMeta,
    rounds: allRounds,
    edges: [],
  }
}

/**
 * Generate knockout bracket from group stage results.
 * Called after group stage is complete.
 *
 * @param advancingEntries - entries advancing from groups, ordered by seed/ranking
 */
export function generateKnockoutFromGroups(
  advancingEntries: BracketEntry[],
  config: { thirdPlaceMatch?: boolean }
): BracketOutput {
  // Re-seed based on group placement
  const reseeded = advancingEntries.map((e, i) => ({
    ...e,
    seed: i + 1,
  }))

  return generateSingleElimination({
    entries: reseeded,
    config: { thirdPlaceMatch: config.thirdPlaceMatch },
  })
}

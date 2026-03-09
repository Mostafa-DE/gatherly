import type {
  BracketInput,
  BracketOutput,
  GeneratedMatch,
  GeneratedEdge,
  GeneratedRound,
} from "./types"
import { placeSeeds } from "./seeding"

/**
 * Generate a single elimination bracket.
 *
 * Standard seeding placement ensures top seeds meet late.
 * Byes are auto-detected from null entries in the padded bracket.
 */
export function generateSingleElimination(input: BracketInput): BracketOutput {
  const { entries, config } = input
  const n = entries.length

  if (n < 2) {
    throw new Error("Single elimination requires at least 2 entries")
  }

  const placed = placeSeeds(entries)
  const bracketSize = placed.length
  const totalRounds = Math.log2(bracketSize)

  const rounds: GeneratedRound[] = []
  const edges: GeneratedEdge[] = []
  let matchCounter = 0

  // Round 1: pair up placed entries
  const round1Matches: GeneratedMatch[] = []
  for (let i = 0; i < bracketSize; i += 2) {
    matchCounter++
    const entry1 = placed[i]
    const entry2 = placed[i + 1]
    const isBye = entry1 === null || entry2 === null

    round1Matches.push({
      matchNumber: matchCounter,
      roundNumber: 1,
      entries: [
        { entryId: entry1?.entryId ?? null, slot: 1 },
        { entryId: entry2?.entryId ?? null, slot: 2 },
      ],
      isBye,
    })
  }
  rounds.push({ roundNumber: 1, matches: round1Matches })

  // Subsequent rounds
  let prevRoundMatchCount = round1Matches.length
  let prevRoundFirstMatch = 1

  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = prevRoundMatchCount / 2
    const roundMatches: GeneratedMatch[] = []

    for (let i = 0; i < matchesInRound; i++) {
      matchCounter++
      roundMatches.push({
        matchNumber: matchCounter,
        roundNumber: round,
        entries: [
          { entryId: null, slot: 1 },
          { entryId: null, slot: 2 },
        ],
        isBye: false,
      })

      // Create edges from the two feeder matches
      const feederMatch1 = prevRoundFirstMatch + i * 2
      const feederMatch2 = prevRoundFirstMatch + i * 2 + 1

      edges.push({
        fromMatchNumber: feederMatch1,
        toMatchNumber: matchCounter,
        outcomeType: "winner",
        toSlot: 1,
      })
      edges.push({
        fromMatchNumber: feederMatch2,
        toMatchNumber: matchCounter,
        outcomeType: "winner",
        toSlot: 2,
      })
    }

    rounds.push({ roundNumber: round, matches: roundMatches })
    prevRoundFirstMatch += prevRoundMatchCount
    prevRoundMatchCount = matchesInRound
  }

  // Optional third place match
  if (config.thirdPlaceMatch && totalRounds >= 2) {
    matchCounter++
    const semifinalRound = rounds[rounds.length - 2]
    const semis = semifinalRound.matches

    rounds.push({
      roundNumber: totalRounds + 1,
      matches: [
        {
          matchNumber: matchCounter,
          roundNumber: totalRounds + 1,
          entries: [
            { entryId: null, slot: 1 },
            { entryId: null, slot: 2 },
          ],
          isBye: false,
        },
      ],
    })

    edges.push({
      fromMatchNumber: semis[0].matchNumber,
      toMatchNumber: matchCounter,
      outcomeType: "loser",
      toSlot: 1,
    })
    edges.push({
      fromMatchNumber: semis[1].matchNumber,
      toMatchNumber: matchCounter,
      outcomeType: "loser",
      toSlot: 2,
    })
  }

  return {
    stages: [
      {
        stageType: "single_elimination",
        stageOrder: 1,
        config: { thirdPlaceMatch: config.thirdPlaceMatch ?? false },
        rounds,
        edges,
      },
    ],
  }
}

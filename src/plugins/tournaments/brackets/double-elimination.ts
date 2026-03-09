import type {
  BracketInput,
  BracketOutput,
  GeneratedMatch,
  GeneratedEdge,
  GeneratedRound,
} from "./types"
import { placeSeeds } from "./seeding"

/**
 * Generate a double elimination bracket.
 *
 * Structure:
 * - Winners bracket (standard single elimination)
 * - Losers bracket (losers drop down, play each other)
 * - Grand final (winners bracket winner vs losers bracket winner)
 */
export function generateDoubleElimination(input: BracketInput): BracketOutput {
  const { entries } = input
  const n = entries.length

  if (n < 4) {
    throw new Error("Double elimination requires at least 4 entries")
  }

  const placed = placeSeeds(entries)
  const bracketSize = placed.length
  const wbRounds = Math.log2(bracketSize)

  const rounds: GeneratedRound[] = []
  const edges: GeneratedEdge[] = []
  let matchCounter = 0

  // =========================================================================
  // Winners Bracket
  // =========================================================================
  const wbMatchesByRound: GeneratedMatch[][] = []

  // WB Round 1
  const wbR1: GeneratedMatch[] = []
  for (let i = 0; i < bracketSize; i += 2) {
    matchCounter++
    const entry1 = placed[i]
    const entry2 = placed[i + 1]
    wbR1.push({
      matchNumber: matchCounter,
      roundNumber: 1,
      entries: [
        { entryId: entry1?.entryId ?? null, slot: 1 },
        { entryId: entry2?.entryId ?? null, slot: 2 },
      ],
      isBye: entry1 === null || entry2 === null,
    })
  }
  wbMatchesByRound.push(wbR1)
  rounds.push({ roundNumber: 1, matches: wbR1 })

  // WB Rounds 2..wbRounds
  for (let r = 2; r <= wbRounds; r++) {
    const prevMatches = wbMatchesByRound[r - 2]
    const matchesInRound = prevMatches.length / 2
    const roundMatches: GeneratedMatch[] = []

    for (let i = 0; i < matchesInRound; i++) {
      matchCounter++
      roundMatches.push({
        matchNumber: matchCounter,
        roundNumber: r,
        entries: [
          { entryId: null, slot: 1 },
          { entryId: null, slot: 2 },
        ],
        isBye: false,
      })

      edges.push({
        fromMatchNumber: prevMatches[i * 2].matchNumber,
        toMatchNumber: matchCounter,
        outcomeType: "winner",
        toSlot: 1,
      })
      edges.push({
        fromMatchNumber: prevMatches[i * 2 + 1].matchNumber,
        toMatchNumber: matchCounter,
        outcomeType: "winner",
        toSlot: 2,
      })
    }

    wbMatchesByRound.push(roundMatches)
    rounds.push({ roundNumber: r, matches: roundMatches })
  }

  // =========================================================================
  // Losers Bracket
  // =========================================================================
  // LB has (2 * wbRounds - 2) rounds
  // Odd LB rounds: losers from WB drop in
  // Even LB rounds: LB internal matches

  const lbRoundCount = 2 * (wbRounds - 1)
  let currentLbMatches: GeneratedMatch[] = []
  const lbRoundOffset = wbRounds // LB rounds numbered after WB

  for (let lbr = 1; lbr <= lbRoundCount; lbr++) {
    const roundNumber = lbRoundOffset + lbr
    const roundMatches: GeneratedMatch[] = []

    if (lbr === 1) {
      // First LB round: losers from WB R1 pair up
      const wbR1Matches = wbMatchesByRound[0]
      const matchesInRound = wbR1Matches.length / 2

      for (let i = 0; i < matchesInRound; i++) {
        matchCounter++
        roundMatches.push({
          matchNumber: matchCounter,
          roundNumber,
          entries: [
            { entryId: null, slot: 1 },
            { entryId: null, slot: 2 },
          ],
          isBye: false,
        })

        edges.push({
          fromMatchNumber: wbR1Matches[i * 2].matchNumber,
          toMatchNumber: matchCounter,
          outcomeType: "loser",
          toSlot: 1,
        })
        edges.push({
          fromMatchNumber: wbR1Matches[i * 2 + 1].matchNumber,
          toMatchNumber: matchCounter,
          outcomeType: "loser",
          toSlot: 2,
        })
      }
    } else if (lbr % 2 === 0) {
      // Even LB round: WB losers drop in vs LB survivors
      const wbRoundIdx = lbr / 2 // which WB round's losers drop
      const wbLosers = wbMatchesByRound[wbRoundIdx] ?? []
      const matchesInRound = currentLbMatches.length

      for (let i = 0; i < matchesInRound; i++) {
        matchCounter++
        roundMatches.push({
          matchNumber: matchCounter,
          roundNumber,
          entries: [
            { entryId: null, slot: 1 },
            { entryId: null, slot: 2 },
          ],
          isBye: false,
        })

        // LB survivor
        edges.push({
          fromMatchNumber: currentLbMatches[i].matchNumber,
          toMatchNumber: matchCounter,
          outcomeType: "winner",
          toSlot: 1,
        })

        // WB loser drops in
        if (wbLosers[i]) {
          edges.push({
            fromMatchNumber: wbLosers[i].matchNumber,
            toMatchNumber: matchCounter,
            outcomeType: "loser",
            toSlot: 2,
          })
        }
      }
    } else {
      // Odd LB round (after first): LB internal pairing
      const matchesInRound = currentLbMatches.length / 2

      for (let i = 0; i < matchesInRound; i++) {
        matchCounter++
        roundMatches.push({
          matchNumber: matchCounter,
          roundNumber,
          entries: [
            { entryId: null, slot: 1 },
            { entryId: null, slot: 2 },
          ],
          isBye: false,
        })

        edges.push({
          fromMatchNumber: currentLbMatches[i * 2].matchNumber,
          toMatchNumber: matchCounter,
          outcomeType: "winner",
          toSlot: 1,
        })
        edges.push({
          fromMatchNumber: currentLbMatches[i * 2 + 1].matchNumber,
          toMatchNumber: matchCounter,
          outcomeType: "winner",
          toSlot: 2,
        })
      }
    }

    rounds.push({ roundNumber, matches: roundMatches })
    currentLbMatches = roundMatches
  }

  // =========================================================================
  // Grand Final
  // =========================================================================
  const grandFinalRound = lbRoundOffset + lbRoundCount + 1
  matchCounter++
  const grandFinal: GeneratedMatch = {
    matchNumber: matchCounter,
    roundNumber: grandFinalRound,
    entries: [
      { entryId: null, slot: 1 },
      { entryId: null, slot: 2 },
    ],
    isBye: false,
  }
  rounds.push({ roundNumber: grandFinalRound, matches: [grandFinal] })

  // WB winner to grand final
  const wbFinal = wbMatchesByRound[wbRounds - 1][0]
  edges.push({
    fromMatchNumber: wbFinal.matchNumber,
    toMatchNumber: matchCounter,
    outcomeType: "winner",
    toSlot: 1,
  })

  // LB winner to grand final
  if (currentLbMatches.length > 0) {
    edges.push({
      fromMatchNumber: currentLbMatches[0].matchNumber,
      toMatchNumber: matchCounter,
      outcomeType: "winner",
      toSlot: 2,
    })
  }

  return {
    stages: [
      {
        stageType: "double_elimination",
        stageOrder: 1,
        config: {},
        rounds,
        edges,
      },
    ],
  }
}

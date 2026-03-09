import type {
  BracketInput,
  BracketOutput,
  GeneratedMatch,
  GeneratedRound,
} from "./types"

type SwissStanding = {
  entryId: string
  seed: number
  points: number
  wins: number
  losses: number
  draws: number
  opponentsPlayed: Set<string>
}

/**
 * Generate the first round of a Swiss tournament.
 *
 * Swiss rounds are generated one at a time. This generates only round 1.
 * Subsequent rounds are generated via generateSwissRound() after results.
 */
export function generateSwissFirstRound(input: BracketInput): BracketOutput {
  const { entries, config } = input
  const n = entries.length

  if (n < 4) {
    throw new Error("Swiss requires at least 4 entries")
  }

  const sorted = [...entries].sort((a, b) => a.seed - b.seed)
  const swissRounds = config.swissRounds ?? Math.ceil(Math.log2(n))

  const matches: GeneratedMatch[] = []
  let matchCounter = 0

  // Round 1: pair adjacent seeds (1v2, 3v4, etc.)
  const hasOdd = n % 2 !== 0

  for (let i = 0; i < n - 1; i += 2) {
    matchCounter++
    matches.push({
      matchNumber: matchCounter,
      roundNumber: 1,
      entries: [
        { entryId: sorted[i].entryId, slot: 1 },
        { entryId: sorted[i + 1].entryId, slot: 2 },
      ],
      isBye: false,
    })
  }

  // If odd number, last entry gets a bye
  if (hasOdd) {
    matchCounter++
    matches.push({
      matchNumber: matchCounter,
      roundNumber: 1,
      entries: [
        { entryId: sorted[n - 1].entryId, slot: 1 },
        { entryId: null, slot: 2 },
      ],
      isBye: true,
    })
  }

  return {
    stages: [
      {
        stageType: "swiss",
        stageOrder: 1,
        config: { swissRounds },
        rounds: [{ roundNumber: 1, matches }],
        edges: [],
      },
    ],
  }
}

/**
 * Generate the next Swiss round based on current standings.
 *
 * Pairing rules:
 * 1. Sort by points (descending), then seed (ascending) for tiebreak
 * 2. Pair players with same/similar point totals
 * 3. Avoid rematches when possible
 * 4. If odd number, lowest-ranked unpaired player gets bye
 */
export function generateSwissRound(
  standings: SwissStanding[],
  roundNumber: number
): GeneratedRound {
  // Sort: highest points first, then lowest seed (best rank) first
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return a.seed - b.seed
  })

  const n = sorted.length
  const paired = new Set<string>()
  const matches: GeneratedMatch[] = []
  let matchCounter = 0

  // If odd number, give bye to lowest-ranked player who hasn't had one
  if (n % 2 !== 0) {
    // Find the lowest-ranked player (from end) who hasn't had a bye already
    for (let i = n - 1; i >= 0; i--) {
      if (!sorted[i].opponentsPlayed.has("BYE")) {
        matchCounter++
        matches.push({
          matchNumber: matchCounter,
          roundNumber,
          entries: [
            { entryId: sorted[i].entryId, slot: 1 },
            { entryId: null, slot: 2 },
          ],
          isBye: true,
        })
        paired.add(sorted[i].entryId)
        break
      }
    }
  }

  // Pair remaining players
  for (let i = 0; i < n; i++) {
    if (paired.has(sorted[i].entryId)) continue

    // Find best opponent: closest in standings, not already paired, not a rematch
    let bestOpponent = -1

    // First pass: find someone who hasn't been played
    for (let j = i + 1; j < n; j++) {
      if (paired.has(sorted[j].entryId)) continue
      if (!sorted[i].opponentsPlayed.has(sorted[j].entryId)) {
        bestOpponent = j
        break
      }
    }

    // Fallback: allow rematch if no other option
    if (bestOpponent === -1) {
      for (let j = i + 1; j < n; j++) {
        if (!paired.has(sorted[j].entryId)) {
          bestOpponent = j
          break
        }
      }
    }

    if (bestOpponent === -1) continue

    matchCounter++
    matches.push({
      matchNumber: matchCounter,
      roundNumber,
      entries: [
        { entryId: sorted[i].entryId, slot: 1 },
        { entryId: sorted[bestOpponent].entryId, slot: 2 },
      ],
      isBye: false,
    })
    paired.add(sorted[i].entryId)
    paired.add(sorted[bestOpponent].entryId)
  }

  return { roundNumber, matches }
}

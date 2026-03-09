import type {
  BracketInput,
  BracketOutput,
  GeneratedMatch,
  GeneratedRound,
} from "./types"

/**
 * Generate a round-robin tournament.
 *
 * Uses the circle method (Berger tables) for scheduling.
 * Each entry plays every other entry exactly once.
 * If odd number of entries, a virtual BYE entry is added.
 */
export function generateRoundRobin(input: BracketInput): BracketOutput {
  const { entries } = input
  const n = entries.length

  if (n < 2) {
    throw new Error("Round robin requires at least 2 entries")
  }

  // Sort by seed
  const sorted = [...entries].sort((a, b) => a.seed - b.seed)

  // If odd, add a virtual BYE
  const hasVirtualBye = n % 2 !== 0
  const participants = [...sorted]
  const effectiveN = hasVirtualBye ? n + 1 : n

  const totalRounds = effectiveN - 1
  const matchesPerRound = effectiveN / 2

  const rounds: GeneratedRound[] = []
  let matchCounter = 0

  // Circle method: fix participant[0], rotate the rest
  // Indices: 0 is fixed, 1..effectiveN-1 rotate
  const indices = Array.from({ length: effectiveN }, (_, i) => i)

  for (let round = 1; round <= totalRounds; round++) {
    const roundMatches: GeneratedMatch[] = []

    for (let m = 0; m < matchesPerRound; m++) {
      const i1 = indices[m]
      const i2 = indices[effectiveN - 1 - m]

      // Skip matches involving the virtual BYE
      const entry1 = i1 < participants.length ? participants[i1] : null
      const entry2 = i2 < participants.length ? participants[i2] : null
      const isBye = entry1 === null || entry2 === null

      matchCounter++
      roundMatches.push({
        matchNumber: matchCounter,
        roundNumber: round,
        entries: [
          { entryId: entry1?.entryId ?? null, slot: 1 },
          { entryId: entry2?.entryId ?? null, slot: 2 },
        ],
        isBye,
      })
    }

    rounds.push({ roundNumber: round, matches: roundMatches })

    // Rotate: keep indices[0] fixed, shift rest
    const last = indices[effectiveN - 1]
    for (let i = effectiveN - 1; i > 1; i--) {
      indices[i] = indices[i - 1]
    }
    indices[1] = last
  }

  return {
    stages: [
      {
        stageType: "round_robin",
        stageOrder: 1,
        config: {},
        rounds,
        edges: [], // No progression edges in round robin
      },
    ],
  }
}

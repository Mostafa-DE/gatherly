import type {
  BracketInput,
  BracketOutput,
  GeneratedMatch,
} from "./types"

/**
 * Generate a free-for-all tournament.
 *
 * A single match where all entries compete simultaneously.
 * Results are ranked by placement (1st, 2nd, 3rd, etc.).
 */
export function generateFreeForAll(input: BracketInput): BracketOutput {
  const { entries } = input
  const n = entries.length

  if (n < 2) {
    throw new Error("Free-for-all requires at least 2 entries")
  }

  const sorted = [...entries].sort((a, b) => a.seed - b.seed)

  const match: GeneratedMatch = {
    matchNumber: 1,
    roundNumber: 1,
    entries: sorted.map((e, i) => ({
      entryId: e.entryId,
      slot: i + 1,
    })),
    isBye: false,
  }

  return {
    stages: [
      {
        stageType: "free_for_all",
        stageOrder: 1,
        config: {},
        rounds: [{ roundNumber: 1, matches: [match] }],
        edges: [],
      },
    ],
  }
}

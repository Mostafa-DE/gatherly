import type { TournamentFormat } from "../types"
import type { BracketInput, BracketOutput } from "./types"
import { generateSingleElimination } from "./single-elimination"
import { generateDoubleElimination } from "./double-elimination"
import { generateRoundRobin } from "./round-robin"
import { generateSwissFirstRound } from "./swiss"
import { generateGroupKnockout } from "./group-knockout"
import { generateFreeForAll } from "./free-for-all"

export type { BracketInput, BracketOutput } from "./types"
export type {
  GeneratedMatch,
  GeneratedEdge,
  GeneratedRound,
  GeneratedStage,
  BracketEntry,
} from "./types"

export { placeSeeds, padToPowerOfTwo, standardSeedPlacement, snakeDraft, shuffleSeeds } from "./seeding"
export { generateSingleElimination } from "./single-elimination"
export { generateDoubleElimination } from "./double-elimination"
export { generateRoundRobin } from "./round-robin"
export { generateSwissFirstRound, generateSwissRound } from "./swiss"
export { generateGroupKnockout, generateKnockoutFromGroups } from "./group-knockout"
export { generateFreeForAll } from "./free-for-all"

/**
 * Generate bracket structure for a given tournament format.
 */
export function generateBracket(
  format: TournamentFormat,
  input: BracketInput
): BracketOutput {
  switch (format) {
    case "single_elimination":
      return generateSingleElimination(input)
    case "double_elimination":
      return generateDoubleElimination(input)
    case "round_robin":
      return generateRoundRobin(input)
    case "swiss":
      return generateSwissFirstRound(input)
    case "group_knockout":
      return generateGroupKnockout(input)
    case "free_for_all":
      return generateFreeForAll(input)
  }
}

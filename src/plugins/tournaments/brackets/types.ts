import type { StageType, MatchEdgeOutcomeType } from "../types"

export type BracketEntry = {
  entryId: string
  seed: number
}

export type GeneratedMatch = {
  matchNumber: number
  roundNumber: number
  groupIndex?: number // for group stages
  entries: Array<{ entryId: string | null; slot: number }>
  isBye: boolean
}

export type GeneratedEdge = {
  fromMatchNumber: number
  toMatchNumber: number
  outcomeType: MatchEdgeOutcomeType
  outcomeRank?: number
  toSlot: number
}

export type GeneratedRound = {
  roundNumber: number
  groupIndex?: number
  matches: GeneratedMatch[]
}

export type GeneratedStage = {
  stageType: StageType
  stageOrder: number
  config: Record<string, unknown>
  groups?: Array<{ name: string; groupOrder: number }>
  rounds: GeneratedRound[]
  edges: GeneratedEdge[]
}

export type BracketInput = {
  entries: BracketEntry[]
  config: {
    thirdPlaceMatch?: boolean
    groupCount?: number
    advancePerGroup?: number
    swissRounds?: number
    bestOf?: number
  }
}

export type BracketOutput = {
  stages: GeneratedStage[]
}

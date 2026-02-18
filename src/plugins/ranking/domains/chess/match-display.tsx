import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

function formatScore(score: number): string {
  if (score === 0.5) return "\u00BD"
  return String(score)
}

export function ChessMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} formatScore={formatScore} />
}

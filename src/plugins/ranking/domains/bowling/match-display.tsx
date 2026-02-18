import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function BowlingMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

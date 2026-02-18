import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function DartsMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

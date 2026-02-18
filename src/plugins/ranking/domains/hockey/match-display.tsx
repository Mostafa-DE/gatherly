import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function HockeyMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

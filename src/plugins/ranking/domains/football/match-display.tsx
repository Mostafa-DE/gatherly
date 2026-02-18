import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function FootballMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

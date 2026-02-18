import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function FlagFootballMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

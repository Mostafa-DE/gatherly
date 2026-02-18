import type { MatchDisplayProps } from "../types"
import { SetScoreLayout } from "../shared-match-layouts"

export function TennisMatchDisplay(props: MatchDisplayProps) {
  return <SetScoreLayout {...props} />
}

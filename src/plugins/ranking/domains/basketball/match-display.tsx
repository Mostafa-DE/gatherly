import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function BasketballMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

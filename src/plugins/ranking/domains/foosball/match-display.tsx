import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function FoosballMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function DodgeballMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

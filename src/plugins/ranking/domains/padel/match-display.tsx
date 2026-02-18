import type { MatchDisplayProps } from "../types"
import { SetScoreLayout } from "../shared-match-layouts"

export function PadelMatchDisplay(props: MatchDisplayProps) {
  return <SetScoreLayout {...props} />
}

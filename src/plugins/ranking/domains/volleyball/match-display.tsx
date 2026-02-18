import type { MatchDisplayProps } from "../types"
import { SetScoreLayout } from "../shared-match-layouts"

export function VolleyballMatchDisplay(props: MatchDisplayProps) {
  return <SetScoreLayout {...props} />
}

import type { MatchDisplayProps } from "../types"
import { SetScoreLayout } from "../shared-match-layouts"

export function BadmintonMatchDisplay(props: MatchDisplayProps) {
  return <SetScoreLayout {...props} />
}

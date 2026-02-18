import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function KickballMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

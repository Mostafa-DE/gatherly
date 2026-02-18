import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function PoolMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} />
}

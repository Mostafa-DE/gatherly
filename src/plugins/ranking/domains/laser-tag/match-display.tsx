import type { MatchDisplayProps } from "../types"
import { SimpleScoreLayout } from "../shared-match-layouts"

export function LaserTagMatchDisplay(props: MatchDisplayProps) {
  return <SimpleScoreLayout {...props} nameSeparator=", " />
}

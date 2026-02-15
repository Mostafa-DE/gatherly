import { cn } from "@/lib/utils"
import type { MatchDisplayProps } from "../types"

type FoosballScore = { team1: number; team2: number }

export function FoosballMatchDisplay({
  scores,
  winner,
  team1Names,
  team2Names,
}: MatchDisplayProps) {
  const { team1, team2 } = (scores ?? { team1: 0, team2: 0 }) as FoosballScore

  const team1Label = team1Names.join(" & ")
  const team2Label = team2Names.join(" & ")

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "truncate max-w-[120px]",
          winner === "team1" ? "font-semibold text-primary" : "text-muted-foreground"
        )}
      >
        {team1Label}
      </span>

      <span className="font-mono text-xs tabular-nums shrink-0">
        <span className={cn(winner === "team1" && "font-semibold")}>
          {team1}
        </span>
        <span className="text-muted-foreground"> - </span>
        <span className={cn(winner === "team2" && "font-semibold")}>
          {team2}
        </span>
      </span>

      <span
        className={cn(
          "truncate max-w-[120px]",
          winner === "team2" ? "font-semibold text-primary" : "text-muted-foreground"
        )}
      >
        {team2Label}
      </span>
    </div>
  )
}

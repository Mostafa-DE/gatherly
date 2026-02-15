import { cn } from "@/lib/utils"
import type { MatchDisplayProps } from "../types"

type GameScore = [number, number]

export function PklBallMatchDisplay({
  scores,
  winner,
  team1Names,
  team2Names,
}: MatchDisplayProps) {
  const games = (scores as GameScore[]) ?? []

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

      <div className="flex items-center gap-1.5 shrink-0">
        {games.map((game, i) => (
          <span key={i} className="font-mono text-xs tabular-nums">
            <span className={cn(winner === "team1" && game[0] > game[1] && "font-semibold")}>
              {game[0]}
            </span>
            <span className="text-muted-foreground">-</span>
            <span className={cn(winner === "team2" && game[1] > game[0] && "font-semibold")}>
              {game[1]}
            </span>
          </span>
        ))}
      </div>

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

import { cn } from "@/lib/utils"
import type { MatchDisplayProps } from "./types"

function TeamRow({
  name,
  isWinner,
  isDraw,
  children,
}: {
  name: string
  isWinner: boolean
  isDraw: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 min-h-[28px]">
      <div
        className={cn(
          "w-1 self-stretch rounded-full shrink-0",
          isWinner ? "bg-primary" : "bg-transparent"
        )}
      />
      <span
        className={cn(
          "flex-1 min-w-0 truncate text-sm",
          isWinner && "font-semibold text-foreground",
          !isWinner && !isDraw && "text-muted-foreground",
          isDraw && "text-foreground"
        )}
      >
        {name}
      </span>
      {children}
    </div>
  )
}

type SimpleScoreLayoutProps = MatchDisplayProps & {
  formatScore?: (score: number) => string
  nameSeparator?: string
}

export function SimpleScoreLayout({
  scores,
  winner,
  team1Names,
  team2Names,
  formatScore = String,
  nameSeparator = " & ",
}: SimpleScoreLayoutProps) {
  const { team1, team2 } = (scores ?? { team1: 0, team2: 0 }) as {
    team1: number
    team2: number
  }
  const isDraw = winner === "draw"

  return (
    <div className="space-y-0.5">
      <TeamRow
        name={team1Names.join(nameSeparator)}
        isWinner={winner === "team1"}
        isDraw={isDraw}
      >
        <span
          className={cn(
            "font-mono text-base tabular-nums w-8 text-right shrink-0",
            winner === "team1"
              ? "font-bold text-foreground"
              : "text-muted-foreground"
          )}
        >
          {formatScore(team1)}
        </span>
      </TeamRow>
      <TeamRow
        name={team2Names.join(nameSeparator)}
        isWinner={winner === "team2"}
        isDraw={isDraw}
      >
        <span
          className={cn(
            "font-mono text-base tabular-nums w-8 text-right shrink-0",
            winner === "team2"
              ? "font-bold text-foreground"
              : "text-muted-foreground"
          )}
        >
          {formatScore(team2)}
        </span>
      </TeamRow>
    </div>
  )
}

type SetScoreLayoutProps = MatchDisplayProps & {
  nameSeparator?: string
}

export function SetScoreLayout({
  scores,
  winner,
  team1Names,
  team2Names,
  nameSeparator = " & ",
}: SetScoreLayoutProps) {
  const sets = (scores as [number, number][]) ?? []
  const isDraw = winner === "draw"

  return (
    <div className="space-y-0.5">
      <TeamRow
        name={team1Names.join(nameSeparator)}
        isWinner={winner === "team1"}
        isDraw={isDraw}
      >
        <div className="flex items-center gap-2 shrink-0">
          {sets.map((set, i) => (
            <span
              key={i}
              className={cn(
                "font-mono text-sm tabular-nums w-5 text-center",
                winner === "team1" && set[0] > set[1]
                  ? "font-bold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {set[0]}
            </span>
          ))}
        </div>
      </TeamRow>
      <TeamRow
        name={team2Names.join(nameSeparator)}
        isWinner={winner === "team2"}
        isDraw={isDraw}
      >
        <div className="flex items-center gap-2 shrink-0">
          {sets.map((set, i) => (
            <span
              key={i}
              className={cn(
                "font-mono text-sm tabular-nums w-5 text-center",
                winner === "team2" && set[1] > set[0]
                  ? "font-bold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {set[1]}
            </span>
          ))}
        </div>
      </TeamRow>
    </div>
  )
}

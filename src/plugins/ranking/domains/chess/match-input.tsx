import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MatchInputProps } from "../types"

type ChessScore = { team1: number; team2: number }

type Outcome = "team1" | "team2" | "draw"

const outcomes: { value: Outcome; label: string; scores: ChessScore }[] = [
  { value: "team1", label: "Player 1 wins (1-0)", scores: { team1: 1, team2: 0 } },
  { value: "team2", label: "Player 2 wins (0-1)", scores: { team1: 0, team2: 1 } },
  { value: "draw", label: "Draw (\u00BD-\u00BD)", scores: { team1: 0.5, team2: 0.5 } },
]

function getOutcome(scores: ChessScore): Outcome | null {
  if (scores.team1 === 1 && scores.team2 === 0) return "team1"
  if (scores.team1 === 0 && scores.team2 === 1) return "team2"
  if (scores.team1 === 0.5 && scores.team2 === 0.5) return "draw"
  return null
}

export function ChessMatchInput({
  scores,
  onScoresChange,
  validationError,
}: MatchInputProps) {
  const currentScores = (
    typeof scores === "object" && scores !== null
      ? scores
      : { team1: 0, team2: 0 }
  ) as ChessScore

  const selected = getOutcome(currentScores)

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Select the match result</p>
      <div className="flex flex-col gap-2">
        {outcomes.map((o) => (
          <Button
            key={o.value}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "justify-start",
              selected === o.value && "border-primary bg-primary/10 text-primary"
            )}
            onClick={() => onScoresChange(o.scores)}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}
    </div>
  )
}

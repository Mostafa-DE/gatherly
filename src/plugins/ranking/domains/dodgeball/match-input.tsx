import { Input } from "@/components/ui/input"
import type { MatchInputProps } from "../types"

type DodgeballScore = { team1: number; team2: number }

export function DodgeballMatchInput({
  scores,
  onScoresChange,
  validationError,
}: MatchInputProps) {
  const currentScores = (
    typeof scores === "object" && scores !== null
      ? scores
      : { team1: 0, team2: 0 }
  ) as DodgeballScore

  function updateScore(side: "team1" | "team2", value: number) {
    onScoresChange({ ...currentScores, [side]: value })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 justify-center">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">Team 1 Rounds</span>
          <Input
            type="number"
            min={0}
            value={currentScores.team1}
            onChange={(e) =>
              updateScore("team1", parseInt(e.target.value) || 0)
            }
            className="h-9 w-20 text-center font-mono bg-white dark:bg-input/30"
          />
        </div>

        <span className="text-sm text-muted-foreground mt-5">-</span>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-muted-foreground">Team 2 Rounds</span>
          <Input
            type="number"
            min={0}
            value={currentScores.team2}
            onChange={(e) =>
              updateScore("team2", parseInt(e.target.value) || 0)
            }
            className="h-9 w-20 text-center font-mono bg-white dark:bg-input/30"
          />
        </div>
      </div>

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}
    </div>
  )
}

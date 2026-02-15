import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, X } from "lucide-react"
import type { MatchInputProps } from "../types"

type GameScore = [number, number]

export function PingPongMatchInput({
  scores,
  onScoresChange,
  validationError,
}: MatchInputProps) {
  const currentScores = (Array.isArray(scores) ? scores : [[0, 0]]) as GameScore[]

  function updateGame(index: number, side: 0 | 1, value: number) {
    const updated = currentScores.map((g, i) =>
      i === index
        ? ([side === 0 ? value : g[0], side === 1 ? value : g[1]] as GameScore)
        : g
    )
    onScoresChange(updated)
  }

  function addGame() {
    if (currentScores.length >= 7) return
    onScoresChange([...currentScores, [0, 0]])
  }

  function removeGame(index: number) {
    if (currentScores.length <= 1) return
    onScoresChange(currentScores.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Enter the point score for each game (e.g. 11-8, 12-10, 11-9). First to 11, win by 2
      </p>
      <div className="space-y-2">
        {currentScores.map((game, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16 shrink-0">
              Game {i + 1}
            </span>
            <Input
              type="number"
              min={0}
              value={game[0]}
              onChange={(e) =>
                updateGame(i, 0, parseInt(e.target.value) || 0)
              }
              className="h-9 w-16 text-center font-mono bg-white dark:bg-input/30"
            />
            <span className="text-sm text-muted-foreground">-</span>
            <Input
              type="number"
              min={0}
              value={game[1]}
              onChange={(e) =>
                updateGame(i, 1, parseInt(e.target.value) || 0)
              }
              className="h-9 w-16 text-center font-mono bg-white dark:bg-input/30"
            />
            {currentScores.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => removeGame(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {currentScores.length < 7 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGame}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Game
        </Button>
      )}

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}
    </div>
  )
}

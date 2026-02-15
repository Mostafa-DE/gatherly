import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, X } from "lucide-react"
import type { MatchInputProps } from "../types"

type SetScore = [number, number]

export function TennisMatchInput({
  scores,
  onScoresChange,
  validationError,
}: MatchInputProps) {
  const currentScores = (Array.isArray(scores) ? scores : [[0, 0]]) as SetScore[]

  function updateSet(index: number, side: 0 | 1, value: number) {
    const updated = currentScores.map((s, i) =>
      i === index
        ? ([side === 0 ? value : s[0], side === 1 ? value : s[1]] as SetScore)
        : s
    )
    onScoresChange(updated)
  }

  function addSet() {
    if (currentScores.length >= 5) return
    onScoresChange([...currentScores, [0, 0]])
  }

  function removeSet(index: number) {
    if (currentScores.length <= 1) return
    onScoresChange(currentScores.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Enter the game score for each set (e.g. 6-3, 7-5, 7-6)
      </p>
      <div className="space-y-2">
        {currentScores.map((set, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-12 shrink-0">
              Set {i + 1}
            </span>
            <Input
              type="number"
              min={0}
              max={7}
              value={set[0]}
              onChange={(e) =>
                updateSet(i, 0, parseInt(e.target.value) || 0)
              }
              className="h-9 w-16 text-center font-mono bg-white dark:bg-input/30"
            />
            <span className="text-sm text-muted-foreground">-</span>
            <Input
              type="number"
              min={0}
              max={7}
              value={set[1]}
              onChange={(e) =>
                updateSet(i, 1, parseInt(e.target.value) || 0)
              }
              className="h-9 w-16 text-center font-mono bg-white dark:bg-input/30"
            />
            {currentScores.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => removeSet(i)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {currentScores.length < 5 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSet}
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Set
        </Button>
      )}

      {validationError && (
        <p className="text-xs text-destructive">{validationError}</p>
      )}
    </div>
  )
}

import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MatchData } from "./match-history"

type MatchCardProps = {
  match: MatchData
  team1Names: string[]
  team2Names: string[]
  MatchDisplay: React.ComponentType<{
    scores: unknown
    winner: "team1" | "team2" | "draw"
    team1Names: string[]
    team2Names: string[]
  }>
  isAdmin?: boolean
  isEditing?: boolean
  onCorrect?: () => void
}

export function MatchCard({
  match,
  team1Names,
  team2Names,
  MatchDisplay,
  isAdmin,
  isEditing,
  onCorrect,
}: MatchCardProps) {
  return (
    <div
      className={cn(
        "group rounded-xl border bg-card p-4 transition-all",
        isEditing
          ? "ring-2 ring-primary/30 border-primary/30"
          : "border-border/60 hover:border-border"
      )}
    >
      <MatchDisplay
        scores={match.scores}
        winner={match.winner as "team1" | "team2" | "draw"}
        team1Names={team1Names}
        team2Names={team2Names}
      />

      <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <time>
            {new Date(match.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </time>
          <span aria-hidden="true">&middot;</span>
          <span>{match.recordedByName}</span>
        </div>
        {isAdmin && onCorrect && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            onClick={onCorrect}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {match.notes && (
        <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
          {match.notes}
        </p>
      )}
    </div>
  )
}

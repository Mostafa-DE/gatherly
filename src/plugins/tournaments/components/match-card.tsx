import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { matchStatusLabels, matchStatusStyles } from "./constants"

type MatchEntry = {
  id: string
  matchId: string
  entryId: string
  slot: number
  result: string | null
  score: unknown
}

type ParticipantSummary = {
  id: string
  userId?: string | null
  participantName: string
  participantImage: string | null
  seed: number | null
  rankPosition?: number | null
  rankLevelName?: string | null
  rankLevelColor?: string | null
}

type MatchCardProps = {
  match: {
    id: string
    matchNumber: number
    status: string
    scores: unknown
    winnerEntryId: string | null
  }
  matchEntries: MatchEntry[]
  participantMap: Map<string, ParticipantSummary>
  currentUserId?: string | null
  isAdmin: boolean
  compact?: boolean
  onReportScore?: () => void
  onForfeit?: () => void
}

export function MatchCard({
  match,
  matchEntries,
  participantMap,
  currentUserId,
  isAdmin,
  compact,
  onReportScore,
  onForfeit,
}: MatchCardProps) {
  const sortedEntries = [...matchEntries].sort((a, b) => a.slot - b.slot)
  const isCompleted = match.status === "completed"
  const isBye = match.status === "bye"
  const isForfeit = match.status === "forfeit"
  const isPending = match.status === "pending"
  const isInProgress = match.status === "in_progress"

  const borderColor = isCompleted
    ? "border-[var(--color-status-success)]/30"
    : isInProgress
      ? "border-blue-400/30"
      : isForfeit
        ? "border-red-400/30"
        : "border-border/50"

  return (
    <div
      className={`rounded-lg border ${borderColor} bg-card/50 backdrop-blur-sm ${compact ? "p-2" : "p-3"}`}
    >
      {/* Match header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-mono">
          Match #{match.matchNumber}
        </span>
        <Badge
          variant="secondary"
          className={`border-0 text-[10px] ${matchStatusStyles[match.status] ?? ""}`}
        >
          {matchStatusLabels[match.status] ?? match.status}
        </Badge>
      </div>

      {/* Entries */}
      <div className="space-y-1">
        {sortedEntries.length === 0 && isPending && (
          <div className="text-xs text-muted-foreground text-center py-2">TBD</div>
        )}
        {sortedEntries.map((entry) => {
          const participant = participantMap.get(entry.entryId)
          const participantLabel =
            participant?.userId && currentUserId && participant.userId === currentUserId
              ? "You"
              : participant?.participantName ?? "TBD"
          const isWinner = match.winnerEntryId === entry.entryId
          const entryScore = entry.score as Record<string, unknown> | null

          return (
            <div
              key={entry.id}
              className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                isWinner && isCompleted
                  ? "bg-[var(--color-badge-success-bg)]"
                  : ""
              }`}
            >
              {participant?.rankPosition != null && (
                <span
                  className="inline-flex min-w-8 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold leading-none"
                  style={{
                    backgroundColor: participant.rankLevelColor
                      ? `${participant.rankLevelColor}20`
                      : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    color:
                      participant.rankLevelColor ?? "var(--color-primary)",
                  }}
                >
                  {participant.rankPosition}
                </span>
              )}
              <span className={`flex-1 truncate ${isWinner ? "font-medium" : ""}`}>
                {participantLabel}
              </span>
              {entryScore && typeof entryScore === "object" && "points" in entryScore && (
                <span className="font-mono text-xs font-medium">
                  {String(entryScore.points)}
                </span>
              )}
              {entry.result === "forfeit" && (
                <span className="text-[10px] text-red-500 font-medium">FF</span>
              )}
              {entry.result === "bye" && (
                <span className="text-[10px] text-muted-foreground">BYE</span>
              )}
            </div>
          )
        })}
        {isBye && sortedEntries.length === 1 && (
          <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-muted-foreground">
            <span className="w-5" />
            <span className="flex-1">BYE</span>
          </div>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && (isInProgress || isPending) && !isBye && (
        <div className="mt-2 flex gap-2 border-t border-border/30 pt-2">
          {onReportScore && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={onReportScore}
            >
              Report Score
            </Button>
          )}
          {onForfeit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={onForfeit}
            >
              Forfeit
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

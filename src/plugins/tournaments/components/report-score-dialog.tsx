import { useEffect, useRef, useState } from "react"
import { trpc } from "@/lib/trpc"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

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
  participantName: string
  participantImage: string | null
  seed: number | null
}

type ReportScoreDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  match: {
    id: string
    matchNumber: number
    status: string
    version: number
  }
  matchEntries: MatchEntry[]
  participantMap: Map<string, ParticipantSummary>
}

export function ReportScoreDialog({
  open,
  onOpenChange,
  tournamentId,
  match,
  matchEntries,
  participantMap,
}: ReportScoreDialogProps) {
  const utils = trpc.useUtils()
  const sortedEntries = [...matchEntries].sort((a, b) => a.slot - b.slot)

  const [scores, setScores] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const entry of sortedEntries) {
      initial[entry.entryId] = ""
    }
    return initial
  })
  const [winnerId, setWinnerId] = useState<string>("")
  const [error, setError] = useState("")

  const reportScore = trpc.plugin.tournaments.reportScore.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getBracket.invalidate({ tournamentId })
      utils.plugin.tournaments.getMatches.invalidate({ tournamentId })
      utils.plugin.tournaments.getStandings.invalidate({ tournamentId })
      utils.plugin.tournaments.getById.invalidate({ tournamentId })
      onOpenChange(false)
    },
    onError: (err) => setError(err.message),
  })

  function handleScoreChange(entryId: string, value: string) {
    setScores((prev) => ({ ...prev, [entryId]: value }))
    const updated = { ...scores, [entryId]: value }
    const entryScores = sortedEntries.map((e) => ({
      entryId: e.entryId,
      score: parseInt(updated[e.entryId] || "0", 10),
    }))
    const maxScore = Math.max(...entryScores.map((e) => e.score))
    const winners = entryScores.filter((e) => e.score === maxScore)
    if (winners.length === 1) {
      setWinnerId(winners[0].entryId)
    }
  }

  function handleSubmit() {
    setError("")
    if (!winnerId) {
      setError("Please select a winner")
      return
    }

    const scoreRecord: Record<string, unknown> = {}
    for (const entry of sortedEntries) {
      const participant = participantMap.get(entry.entryId)
      const key = participant?.participantName ?? entry.entryId
      scoreRecord[key] = {
        points: parseInt(scores[entry.entryId] || "0", 10),
      }
    }

    reportScore.mutate({
      tournamentId,
      matchId: match.id,
      expectedVersion: match.version,
      scores: scoreRecord,
      winnerEntryId: winnerId,
    })
  }

  const entry1 = sortedEntries[0]
  const entry2 = sortedEntries[1]
  const p1 = entry1 ? participantMap.get(entry1.entryId) : null
  const p2 = entry2 ? participantMap.get(entry2.entryId) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Match #{match.matchNumber}</DialogTitle>
          <DialogDescription>
            Pick the winner, optionally add scores
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Vertical matchup */}
        <div className="space-y-2">
          {entry1 && (
            <PlayerRow
              name={p1?.participantName ?? "Unknown"}
              image={p1?.participantImage ?? null}
              seed={p1?.seed ?? null}
              score={scores[entry1.entryId] ?? ""}
              isWinner={winnerId === entry1.entryId}
              hasSelection={winnerId !== ""}
              onSelect={() => setWinnerId(entry1.entryId)}
              onScoreChange={(v) => handleScoreChange(entry1.entryId, v)}
            />
          )}

          <div className="flex justify-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
              vs
            </span>
          </div>

          {entry2 && (
            <PlayerRow
              name={p2?.participantName ?? "Unknown"}
              image={p2?.participantImage ?? null}
              seed={p2?.seed ?? null}
              score={scores[entry2.entryId] ?? ""}
              isWinner={winnerId === entry2.entryId}
              hasSelection={winnerId !== ""}
              onSelect={() => setWinnerId(entry2.entryId)}
              onScoreChange={(v) => handleScoreChange(entry2.entryId, v)}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={reportScore.isPending || !winnerId}
          >
            {reportScore.isPending ? "Saving..." : "Confirm Result"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlayerRow({
  name,
  image,
  seed,
  score,
  isWinner,
  hasSelection,
  onSelect,
  onScoreChange,
}: {
  name: string
  image: string | null
  seed: number | null
  score: string
  isWinner: boolean
  hasSelection: boolean
  onSelect: () => void
  onScoreChange: (value: string) => void
}) {
  const scoreRef = useRef<HTMLInputElement>(null)
  const prevWinner = useRef(isWinner)

  // Sync browser focus to winner selection state
  useEffect(() => {
    if (isWinner && !prevWinner.current) {
      const timer = setTimeout(() => scoreRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
    prevWinner.current = isWinner
  }, [isWinner])

  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-4 rounded-xl border-2 px-4 py-4 transition-all duration-150",
        isWinner
          ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
          : hasSelection
            ? "border-transparent bg-muted/20 opacity-60 hover:opacity-80"
            : "border-transparent bg-muted/30 hover:border-border hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {/* Avatar */}
      <Avatar
        className={cn(
          "h-12 w-12 shrink-0 transition-all duration-150",
          isWinner &&
            "ring-2 ring-[var(--color-primary)]/40 ring-offset-2 ring-offset-background"
        )}
      >
        <AvatarImage src={image ?? undefined} />
        <AvatarFallback className="bg-muted text-base font-semibold text-muted-foreground">
          {name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Name + seed */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-base font-medium transition-colors duration-150",
            isWinner && "text-[var(--color-primary)]"
          )}
        >
          {name}
        </p>
        {seed != null && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            Seed #{seed}
          </p>
        )}
      </div>

      {/* Winner badge */}
      {isWinner && (
        <span className="shrink-0 rounded-full bg-[var(--color-primary)] px-2.5 py-1 text-xs font-semibold leading-none text-white">
          Winner
        </span>
      )}

      {/* Score input */}
      <div className="shrink-0">
        <Input
          ref={scoreRef}
          type="number"
          min="0"
          value={score}
          onChange={(e) => {
            e.stopPropagation()
            onScoreChange(e.target.value)
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-9 w-20 bg-popover text-center font-mono text-base tabular-nums"
          placeholder="–"
        />
      </div>
    </div>
  )
}

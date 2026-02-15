import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"
import { cn } from "@/lib/utils"

type Player = {
  userId: string
  name: string
  image?: string | null
}

type EditingMatch = {
  id: string
  matchFormat: string
  team1: unknown
  team2: unknown
  scores: unknown
  notes: string | null
}

type MatchRecordingDialogProps = {
  rankingDefinitionId: string
  domainId: string
  activityId?: string
  sessionId: string
  availablePlayers: Player[]
  open: boolean
  onOpenChange: (open: boolean) => void
  editingMatch?: EditingMatch | null
}

export function MatchRecordingDialog({
  rankingDefinitionId,
  domainId,
  sessionId,
  availablePlayers,
  open,
  onOpenChange,
  editingMatch,
}: MatchRecordingDialogProps) {
  const utils = trpc.useUtils()
  const domain = getDomain(domainId)
  const matchConfig = domain?.matchConfig

  const isCorrection = !!editingMatch

  const [matchFormat, setMatchFormat] = useState(
    editingMatch?.matchFormat ?? matchConfig?.defaultFormat ?? ""
  )
  const [team1, setTeam1] = useState<string[]>(
    (editingMatch?.team1 as string[]) ?? []
  )
  const [team2, setTeam2] = useState<string[]>(
    (editingMatch?.team2 as string[]) ?? []
  )
  const [scores, setScores] = useState<unknown>(editingMatch?.scores ?? null)
  const [notes, setNotes] = useState(editingMatch?.notes ?? "")
  const [error, setError] = useState("")

  const formatRule = matchConfig?.formatRules[matchFormat]
  const minPlayersPerTeam = formatRule?.playersPerTeam ?? formatRule?.minPlayersPerTeam ?? 1
  const maxPlayersPerTeam = formatRule?.playersPerTeam ?? formatRule?.maxPlayersPerTeam ?? 99

  // Live validation + preview
  const scoreValidation = useMemo(() => {
    if (!matchConfig || scores === null) return null
    return matchConfig.validateScores(scores)
  }, [matchConfig, scores])

  const previewResult = useMemo(() => {
    if (!matchConfig || !scoreValidation?.isValid) return null
    return matchConfig.resolveMatch(scores)
  }, [matchConfig, scores, scoreValidation])

  const invalidateQueries = () => {
    utils.plugin.ranking.getLeaderboard.invalidate({ rankingDefinitionId })
    if (sessionId) {
      utils.plugin.ranking.listMatchesBySession.invalidate({
        rankingDefinitionId,
        sessionId,
      })
    }
    utils.plugin.ranking.listMatchesByDefinition.invalidate({
      rankingDefinitionId,
    })
  }

  const recordMutation = trpc.plugin.ranking.recordMatch.useMutation({
    onSuccess: () => {
      invalidateQueries()
      onOpenChange(false)
      resetForm()
    },
    onError: (err) => setError(err.message),
  })

  const correctMutation = trpc.plugin.ranking.correctMatch.useMutation({
    onSuccess: () => {
      invalidateQueries()
      onOpenChange(false)
      resetForm()
    },
    onError: (err) => setError(err.message),
  })

  const isPending = recordMutation.isPending || correctMutation.isPending

  function resetForm() {
    setTeam1([])
    setTeam2([])
    setScores(null)
    setNotes("")
    setError("")
    setMatchFormat(matchConfig?.defaultFormat ?? "")
  }

  function handleSubmit() {
    setError("")

    if (team1.length < minPlayersPerTeam) {
      setError(`Team 1 needs at least ${minPlayersPerTeam} player(s)`)
      return
    }
    if (team1.length > maxPlayersPerTeam) {
      setError(`Team 1 can have at most ${maxPlayersPerTeam} player(s)`)
      return
    }
    if (team2.length < minPlayersPerTeam) {
      setError(`Team 2 needs at least ${minPlayersPerTeam} player(s)`)
      return
    }
    if (team2.length > maxPlayersPerTeam) {
      setError(`Team 2 can have at most ${maxPlayersPerTeam} player(s)`)
      return
    }

    if (matchConfig) {
      const validation = matchConfig.validateScores(scores)
      if (!validation.isValid) {
        setError(validation.error ?? "Invalid scores")
        return
      }
    }

    const matchData = {
      rankingDefinitionId,
      sessionId,
      matchFormat,
      team1,
      team2,
      scores,
      notes: notes.trim() || undefined,
    }

    if (isCorrection && editingMatch) {
      correctMutation.mutate({
        matchId: editingMatch.id,
        ...matchData,
      })
    } else {
      recordMutation.mutate(matchData)
    }
  }

  if (!matchConfig) return null

  const selectedPlayerIds = new Set([...team1, ...team2])
  const availableForSelection = availablePlayers.filter(
    (p) => !selectedPlayerIds.has(p.userId)
  )

  const MatchInput = matchConfig.MatchInput

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Correct Match" : "Record Match"}</DialogTitle>
          <DialogDescription>
            {isCorrection
              ? "Edit the match details and save to apply the correction"
              : "Enter the match score and the system will calculate results"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Format selector */}
          {matchConfig.supportedFormats.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select
                value={matchFormat}
                onValueChange={(val) => {
                  setMatchFormat(val)
                  setTeam1([])
                  setTeam2([])
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {matchConfig.supportedFormats.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Team selection */}
          <div className="grid grid-cols-2 gap-3">
            <TeamSelector
              label="Team 1"
              team={team1}
              setTeam={setTeam1}
              maxPlayers={maxPlayersPerTeam}
              availablePlayers={availableForSelection}
              allPlayers={availablePlayers}
            />
            <TeamSelector
              label="Team 2"
              team={team2}
              setTeam={setTeam2}
              maxPlayers={maxPlayersPerTeam}
              availablePlayers={availableForSelection}
              allPlayers={availablePlayers}
            />
          </div>

          {/* Score input */}
          <div className="space-y-1.5">
            <Label className="text-xs">Score</Label>
            <MatchInput
              scores={scores}
              onScoresChange={setScores}
              validationError={
                scoreValidation && !scoreValidation.isValid
                  ? scoreValidation.error
                  : undefined
              }
            />
          </div>

          {/* Winner preview */}
          {previewResult && team1.length >= minPlayersPerTeam && team2.length >= minPlayersPerTeam && (
            <div className={cn(
              "rounded-lg border p-3 text-center text-sm font-medium",
              previewResult.winner === "draw"
                ? "border-border bg-muted/50 text-muted-foreground"
                : "border-primary/20 bg-primary/5 text-primary"
            )}>
              {previewResult.winner === "draw"
                ? "Draw"
                : `Winner: ${
                    previewResult.winner === "team1"
                      ? team1.map((id) => availablePlayers.find((p) => p.userId === id)?.name).join(" & ")
                      : team2.map((id) => availablePlayers.find((p) => p.userId === id)?.name).join(" & ")
                  }`}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="match-notes" className="text-xs">
              Notes (optional)
            </Label>
            <Input
              id="match-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tournament round 1"
              maxLength={500}
              className="bg-white dark:bg-input/30"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? isCorrection ? "Saving..." : "Recording..."
              : isCorrection ? "Save Correction" : "Record Match"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeamSelector({
  label,
  team,
  setTeam,
  maxPlayers,
  availablePlayers,
  allPlayers,
}: {
  label: string
  team: string[]
  setTeam: (team: string[]) => void
  maxPlayers: number
  availablePlayers: Player[]
  allPlayers: Player[]
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="space-y-1.5">
        {team.map((userId) => {
          const player = allPlayers.find((p) => p.userId === userId)
          return (
            <div
              key={userId}
              className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={player?.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {player?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs truncate flex-1">
                {player?.name ?? userId}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setTeam(team.filter((id) => id !== userId))
                }
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
        {team.length < maxPlayers && (
          <Select
            value=""
            onValueChange={(val) => {
              if (val) setTeam([...team, val])
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select player" />
            </SelectTrigger>
            <SelectContent>
              {availablePlayers.map((p) => (
                <SelectItem key={p.userId} value={p.userId}>
                  <span className="text-xs">{p.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

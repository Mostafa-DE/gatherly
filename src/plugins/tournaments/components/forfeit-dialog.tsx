import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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

type ForfeitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  match: {
    id: string
    matchNumber: number
    status: string
  }
  matchEntries: MatchEntry[]
  participantMap: Map<string, ParticipantSummary>
}

export function ForfeitDialog({
  open,
  onOpenChange,
  tournamentId,
  match,
  matchEntries,
  participantMap,
}: ForfeitDialogProps) {
  const utils = trpc.useUtils()
  const [forfeitEntryId, setForfeitEntryId] = useState("")
  const [error, setError] = useState("")

  const forfeitMatch = trpc.plugin.tournaments.forfeitMatch.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getBracket.invalidate({ tournamentId })
      utils.plugin.tournaments.getMatches.invalidate({ tournamentId })
      utils.plugin.tournaments.getStandings.invalidate({ tournamentId })
      utils.plugin.tournaments.getById.invalidate({ tournamentId })
      onOpenChange(false)
    },
    onError: (err) => setError(err.message),
  })

  function handleSubmit() {
    setError("")
    if (!forfeitEntryId) {
      setError("Please select who is forfeiting")
      return
    }
    forfeitMatch.mutate({
      tournamentId,
      matchId: match.id,
      forfeitEntryId,
    })
  }

  const sortedEntries = [...matchEntries].sort((a, b) => a.slot - b.slot)

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Forfeit Match #{match.matchNumber}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Select which participant is forfeiting this match. The other
            participant will advance.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2 py-2">
          <Label>Forfeiting Participant</Label>
          <Select value={forfeitEntryId} onValueChange={setForfeitEntryId}>
            <SelectTrigger className="bg-popover">
              <SelectValue placeholder="Select participant..." />
            </SelectTrigger>
            <SelectContent>
              {sortedEntries.map((entry) => {
                const participant = participantMap.get(entry.entryId)
                return (
                  <SelectItem key={entry.entryId} value={entry.entryId}>
                    {participant?.participantName ?? "Unknown"}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={forfeitMatch.isPending || !forfeitEntryId}
          >
            {forfeitMatch.isPending ? "Processing..." : "Confirm Forfeit"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

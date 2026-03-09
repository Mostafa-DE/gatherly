import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ChevronRight } from "lucide-react"
import type { TournamentStatus } from "../types"

type AdvancementControlsProps = {
  tournamentId: string
  format: string
  status: TournamentStatus
}

export function AdvancementControls({
  tournamentId,
  format,
  status,
}: AdvancementControlsProps) {
  const utils = trpc.useUtils()
  const [showSwissConfirm, setShowSwissConfirm] = useState(false)
  const [showGroupConfirm, setShowGroupConfirm] = useState(false)
  const [error, setError] = useState("")

  const advanceSwiss = trpc.plugin.tournaments.advanceSwissRound.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getBracket.invalidate({ tournamentId })
      utils.plugin.tournaments.getMatches.invalidate({ tournamentId })
      utils.plugin.tournaments.getStandings.invalidate({ tournamentId })
      setShowSwissConfirm(false)
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  const advanceGroup = trpc.plugin.tournaments.advanceGroupStage.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getBracket.invalidate({ tournamentId })
      utils.plugin.tournaments.getMatches.invalidate({ tournamentId })
      utils.plugin.tournaments.getStandings.invalidate({ tournamentId })
      setShowGroupConfirm(false)
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  if (status !== "in_progress") return null

  const showSwiss = format === "swiss"
  const showGroup = format === "group_knockout"

  if (!showSwiss && !showGroup) return null

  return (
    <>
      {showSwiss && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSwissConfirm(true)}
        >
          <ChevronRight className="h-3.5 w-3.5 mr-1" />
          Generate Next Round
        </Button>
      )}

      {showGroup && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGroupConfirm(true)}
        >
          <ChevronRight className="h-3.5 w-3.5 mr-1" />
          Generate Knockout Bracket
        </Button>
      )}

      {/* Swiss advancement confirmation */}
      <AlertDialog open={showSwissConfirm} onOpenChange={setShowSwissConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Next Swiss Round</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate the next round of Swiss pairings based on current
              standings. Make sure all matches in the current round are completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => advanceSwiss.mutate({ tournamentId })}
              disabled={advanceSwiss.isPending}
            >
              {advanceSwiss.isPending ? "Generating..." : "Generate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group→Knockout advancement confirmation */}
      <AlertDialog open={showGroupConfirm} onOpenChange={setShowGroupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate Knockout Bracket</AlertDialogTitle>
            <AlertDialogDescription>
              This will advance the top participants from each group into a
              single-elimination knockout bracket. Make sure all group stage
              matches are completed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => advanceGroup.mutate({ tournamentId })}
              disabled={advanceGroup.isPending}
            >
              {advanceGroup.isPending ? "Generating..." : "Generate Knockout"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

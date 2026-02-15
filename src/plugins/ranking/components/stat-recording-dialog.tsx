import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getDomain } from "@/plugins/ranking/domains"

type StatRecordingDialogProps = {
  rankingDefinitionId: string
  domainId: string
  userId: string
  userName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StatRecordingDialog({
  rankingDefinitionId,
  domainId,
  userId,
  userName,
  open,
  onOpenChange,
}: StatRecordingDialogProps) {
  const utils = trpc.useUtils()
  const domain = getDomain(domainId)
  const statFields = domain?.statFields ?? []

  const [stats, setStats] = useState<Record<string, number>>(() =>
    Object.fromEntries(statFields.map((f) => [f.id, 0]))
  )
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  const recordMutation = trpc.plugin.ranking.recordStats.useMutation({
    onSuccess: () => {
      utils.plugin.ranking.getMemberRank.invalidate({
        rankingDefinitionId,
        userId,
      })
      utils.plugin.ranking.getLeaderboard.invalidate({ rankingDefinitionId })
      utils.plugin.ranking.getMemberRanksByUser.invalidate({ userId })
      onOpenChange(false)
      resetForm()
    },
    onError: (err) => setError(err.message),
  })

  function resetForm() {
    setStats(Object.fromEntries(statFields.map((f) => [f.id, 0])))
    setNotes("")
    setError("")
  }

  function handleSubmit() {
    setError("")
    recordMutation.mutate({
      rankingDefinitionId,
      userId,
      stats,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Stats</DialogTitle>
          <DialogDescription>
            Record session stats for {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {statFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={`stat-${field.id}`} className="text-xs">
                  {field.label}
                </Label>
                <Input
                  id={`stat-${field.id}`}
                  type="number"
                  min={0}
                  value={stats[field.id] ?? 0}
                  onChange={(e) =>
                    setStats((prev) => ({
                      ...prev,
                      [field.id]: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="h-9 bg-white dark:bg-input/30 font-mono"
                />
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stat-notes" className="text-xs">
              Notes (optional)
            </Label>
            <Input
              id="stat-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Tournament match"
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
            disabled={recordMutation.isPending}
          >
            {recordMutation.isPending ? "Recording..." : "Record Stats"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

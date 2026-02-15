import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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

type Level = {
  id: string
  name: string
  color: string | null
  order: number
}

type AssignLevelDialogProps = {
  rankingDefinitionId: string
  userId: string
  userName: string
  currentLevelId: string | null
  levels: Level[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

const UNRANKED_VALUE = "__unranked__"

export function AssignLevelDialog({
  rankingDefinitionId,
  userId,
  userName,
  currentLevelId,
  levels,
  open,
  onOpenChange,
}: AssignLevelDialogProps) {
  const utils = trpc.useUtils()
  const [selectedLevelId, setSelectedLevelId] = useState(
    currentLevelId ?? UNRANKED_VALUE
  )
  const [error, setError] = useState("")

  const assignMutation = trpc.plugin.ranking.assignLevel.useMutation({
    onSuccess: () => {
      utils.plugin.ranking.getLeaderboard.invalidate({ rankingDefinitionId })
      utils.plugin.ranking.getMemberRank.invalidate({
        rankingDefinitionId,
        userId,
      })
      utils.plugin.ranking.getMemberRanksByUser.invalidate({ userId })
      onOpenChange(false)
    },
    onError: (err) => setError(err.message),
  })

  function handleSubmit() {
    setError("")
    assignMutation.mutate({
      rankingDefinitionId,
      userId,
      levelId: selectedLevelId === UNRANKED_VALUE ? null : selectedLevelId,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign Level</DialogTitle>
          <DialogDescription>
            Set the ranking level for {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Level</Label>
            <Select
              value={selectedLevelId}
              onValueChange={setSelectedLevelId}
            >
              <SelectTrigger className="bg-white dark:bg-input/30">
                <SelectValue placeholder="Select level..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNRANKED_VALUE}>
                  <span className="text-muted-foreground italic">
                    Unranked
                  </span>
                </SelectItem>
                {levels.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    <div className="flex items-center gap-2">
                      {level.color && (
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: level.color }}
                        />
                      )}
                      {level.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending ? "Assigning..." : "Assign Level"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

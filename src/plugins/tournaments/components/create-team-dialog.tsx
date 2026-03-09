import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Check, X } from "lucide-react"

type CreateTeamDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  activityId: string
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  tournamentId,
  activityId,
}: CreateTeamDialogProps) {
  const utils = trpc.useUtils()
  const [teamName, setTeamName] = useState("")
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [error, setError] = useState("")

  const { data: members, isLoading: membersLoading } = trpc.activityMembership.members.useQuery(
    { activityId, limit: 1000, offset: 0 },
    { enabled: open }
  )

  const { data: existingTeams, isLoading: teamsLoading } = trpc.plugin.tournaments.listTeams.useQuery(
    { tournamentId },
    { enabled: open }
  )

  // Collect all userIds already on a team in this tournament
  const takenUserIds = new Set(
    existingTeams?.flatMap((t: { members: Array<{ userId: string }> }) =>
      t.members.map((m) => m.userId)
    ) ?? []
  )

  const availableMembers = members?.filter(
    (item: { member: { userId: string } }) => !takenUserIds.has(item.member.userId)
  )

  const isLoading = membersLoading || teamsLoading

  const createTeam = trpc.plugin.tournaments.createTeam.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
      onOpenChange(false)
      setTeamName("")
      setSelectedUserIds([])
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  function toggleMember(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  function handleSubmit() {
    setError("")
    if (!teamName.trim()) {
      setError("Team name is required")
      return
    }
    if (selectedUserIds.length === 0) {
      setError("Select at least one member")
      return
    }
    // First selected becomes captain, rest are members
    const [captainUserId, ...memberUserIds] = selectedUserIds
    createTeam.mutate({
      tournamentId,
      name: teamName.trim(),
      captainUserId,
      memberUserIds: memberUserIds.length > 0 ? memberUserIds : undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Ahmad & Omar"
              className="bg-popover"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Members</Label>
              {selectedUserIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {selectedUserIds.length} selected
                </Badge>
              )}
            </div>
            {isLoading ? (
              <Skeleton className="h-20 rounded-lg" />
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-border/50 p-2">
                {availableMembers?.map(
                  ({ member, user }: { member: { userId: string }; user: { id: string; name: string; image: string | null } }) => {
                    const isSelected = selectedUserIds.includes(member.userId)
                    return (
                      <div
                        key={user.id}
                        className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleMember(member.userId)}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={user.image ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-sm font-medium truncate flex-1">{user.name}</p>
                        {isSelected && (
                          <Check className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </div>
                    )
                  }
                )}
              </div>
            )}
          </div>

          {/* Selected members summary */}
          {selectedUserIds.length > 0 && members && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUserIds.map((userId) => {
                const m = members.find(
                  (item: { member: { userId: string } }) => item.member.userId === userId
                )
                if (!m) return null
                return (
                  <Badge
                    key={userId}
                    variant="secondary"
                    className="gap-1 pr-1 text-xs"
                  >
                    {m.user.name}
                    <button
                      type="button"
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleMember(userId)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createTeam.isPending}>
            {createTeam.isPending ? "Creating..." : "Create Team"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

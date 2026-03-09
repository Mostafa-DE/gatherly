import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserMinus, UserPlus, Check } from "lucide-react"

type TeamCardProps = {
  team: {
    id: string
    name: string
    captainUserId: string
    members: Array<{
      id: string
      userId: string
      role: string
      name: string
      image: string | null
    }>
  }
  tournamentId: string
  activityId: string
  isAdmin: boolean
  canModify: boolean
}

export function TeamCard({ team, tournamentId, activityId, isAdmin, canModify }: TeamCardProps) {
  const utils = trpc.useUtils()
  const [showAddMember, setShowAddMember] = useState(false)

  const { data: whoami } = trpc.user.whoami.useQuery()
  const myUserId = whoami?.user?.id
  const isOnTeam = team.members.some((m) => m.userId === myUserId)
  const isCaptain = team.captainUserId === myUserId

  const joinTeam = trpc.plugin.tournaments.joinTeam.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
    },
  })

  const leaveTeam = trpc.plugin.tournaments.leaveTeam.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
    },
  })

  const removeMember = trpc.plugin.tournaments.removeTeamMember.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
    },
  })

  const registerTeam = trpc.plugin.tournaments.registerTeam.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
      utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
    },
  })

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-medium">{team.name}</p>
          <p className="text-xs text-muted-foreground">
            {team.members.length} member{team.members.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && canModify && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddMember(true)}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Add Member
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  registerTeam.mutate({ tournamentId, teamId: team.id })
                }
                disabled={registerTeam.isPending}
              >
                {registerTeam.isPending ? "Registering..." : "Register Team"}
              </Button>
            </>
          )}
          {!isAdmin && canModify && !isOnTeam && (
            <Button
              size="sm"
              onClick={() => joinTeam.mutate({ tournamentId, teamId: team.id })}
              disabled={joinTeam.isPending}
            >
              {joinTeam.isPending ? "Joining..." : "Join Team"}
            </Button>
          )}
          {!isAdmin && isOnTeam && !isCaptain && canModify && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                leaveTeam.mutate({ tournamentId, teamId: team.id })
              }
              disabled={leaveTeam.isPending}
            >
              {leaveTeam.isPending ? "Leaving..." : "Leave Team"}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {team.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5"
          >
            <Avatar className="h-7 w-7">
              <AvatarImage src={member.image ?? undefined} />
              <AvatarFallback className="text-xs">
                {member.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{member.name}</p>
            </div>
            {isAdmin && canModify && member.role !== "captain" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  removeMember.mutate({
                    tournamentId,
                    teamId: team.id,
                    userId: member.userId,
                  })
                }
              >
                <UserMinus className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add member dialog */}
      {isAdmin && (
        <AddTeamMemberDialog
          open={showAddMember}
          onOpenChange={setShowAddMember}
          tournamentId={tournamentId}
          activityId={activityId}
          teamId={team.id}
        />
      )}
    </div>
  )
}

function AddTeamMemberDialog({
  open,
  onOpenChange,
  tournamentId,
  activityId,
  teamId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  activityId: string
  teamId: string
}) {
  const utils = trpc.useUtils()

  const { data: members, isLoading: membersLoading } = trpc.activityMembership.members.useQuery(
    { activityId, limit: 1000, offset: 0 },
    { enabled: open }
  )

  const { data: allTeams, isLoading: teamsLoading } = trpc.plugin.tournaments.listTeams.useQuery(
    { tournamentId },
    { enabled: open }
  )

  const addMember = trpc.plugin.tournaments.adminAddTeamMember.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
      onOpenChange(false)
    },
  })

  // Filter out users already on ANY team in this tournament
  const takenUserIds = new Set(
    allTeams?.flatMap((t: { members: Array<{ userId: string }> }) =>
      t.members.map((m) => m.userId)
    ) ?? []
  )

  const isLoading = membersLoading || teamsLoading

  const availableMembers = members?.filter(
    (item: { member: { userId: string } }) =>
      !takenUserIds.has(item.member.userId)
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>

        {addMember.error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {addMember.error.message}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
        ) : availableMembers && availableMembers.length > 0 ? (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {availableMembers.map(
              ({ member, user }: { member: { userId: string }; user: { id: string; name: string; image: string | null } }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                  onClick={() =>
                    addMember.mutate({ tournamentId, teamId, userId: member.userId })
                  }
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium truncate flex-1">{user.name}</p>
                  <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )
            )}
          </div>
        ) : (
          <p className="py-4 text-sm text-muted-foreground text-center">
            No available members to add.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

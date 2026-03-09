import { useEffect, useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MoreVertical, UserPlus, Users, LogOut } from "lucide-react"
import { entryStatusLabels, entryStatusStyles } from "./constants"
import { TeamCard } from "./team-card"
import { CreateTeamDialog } from "./create-team-dialog"
import type { TournamentStatus } from "../types"

type ParticipantsTabProps = {
  tournamentId: string
  activityId: string
  participantType: string
  status: TournamentStatus
  isAdmin: boolean
}

export function ParticipantsTab({
  tournamentId,
  activityId,
  participantType,
  status,
  isAdmin,
}: ParticipantsTabProps) {
  if (participantType === "team") {
    return (
      <TeamParticipants
        tournamentId={tournamentId}
        activityId={activityId}
        status={status}
        isAdmin={isAdmin}
      />
    )
  }

  return (
    <IndividualParticipants
      tournamentId={tournamentId}
      activityId={activityId}
      status={status}
      isAdmin={isAdmin}
    />
  )
}

function IndividualParticipants({
  tournamentId,
  activityId,
  status,
  isAdmin,
}: Omit<ParticipantsTabProps, "participantType">) {
  const utils = trpc.useUtils()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const canRegister = status === "registration" || status === "draft"

  const { data: participants, isLoading } =
    trpc.plugin.tournaments.getParticipants.useQuery({
      tournamentId,
      limit: 200,
    })

  const { data: whoami } = trpc.user.whoami.useQuery()
  const myUserId = whoami?.user?.id

  const myEntry = participants?.find(
    (p: { userId: string | null }) => p.userId === myUserId
  )

  const registerSelf = trpc.plugin.tournaments.registerSelf.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
    },
  })

  const withdrawSelf = trpc.plugin.tournaments.withdrawSelf.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
    },
  })

  const removeParticipant = trpc.plugin.tournaments.adminRemoveParticipant.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
      utils.plugin.tournaments.getById.invalidate({ tournamentId })
      utils.plugin.tournaments.previewBracket.invalidate({ tournamentId })
    },
  })

  const disqualify = trpc.plugin.tournaments.disqualifyParticipant.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
      utils.plugin.tournaments.getById.invalidate({ tournamentId })
      utils.plugin.tournaments.getBracket.invalidate({ tournamentId })
      utils.plugin.tournaments.getMatches.invalidate({ tournamentId })
      utils.plugin.tournaments.getStandings.invalidate({ tournamentId })
    },
  })

  const canRemoveBeforeStart =
    status === "draft" || status === "registration" || status === "check_in"

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {participants?.length ?? 0} participant{(participants?.length ?? 0) !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          {!isAdmin && canRegister && !myEntry && (
            <Button
              size="sm"
              onClick={() => registerSelf.mutate({ tournamentId })}
              disabled={registerSelf.isPending}
            >
              {registerSelf.isPending ? "Registering..." : "Register"}
            </Button>
          )}
          {!isAdmin && myEntry && myEntry.status === "registered" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => withdrawSelf.mutate({ tournamentId })}
              disabled={withdrawSelf.isPending}
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              {withdrawSelf.isPending ? "Withdrawing..." : "Withdraw"}
            </Button>
          )}
          {isAdmin && canRegister && (
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Participant
            </Button>
          )}
        </div>
      </div>

      {participants && participants.length > 0 ? (
        <div className="space-y-1.5">
          {participants.map(
            (p: {
              id: string
              userId: string | null
              status: string
              seed: number | null
              participantName: string
              participantImage: string | null
            }) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5"
              >
                {p.seed && (
                  <span className="w-6 text-center font-mono text-xs font-bold text-muted-foreground">
                    #{p.seed}
                  </span>
                )}
                <Avatar className="h-8 w-8">
                  <AvatarImage src={p.participantImage ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {p.participantName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.participantName}</p>
                </div>
                <Badge
                  variant="secondary"
                  className={`border-0 text-xs shrink-0 ${entryStatusStyles[p.status] ?? ""}`}
                >
                  {entryStatusLabels[p.status] ?? p.status}
                </Badge>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canRemoveBeforeStart &&
                        (p.status === "registered" || p.status === "checked_in") && (
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            removeParticipant.mutate({ tournamentId, entryId: p.id })
                          }
                        >
                          Remove Participant
                        </DropdownMenuItem>
                      )}
                      {!canRemoveBeforeStart &&
                        (p.status === "active" ||
                          p.status === "registered" ||
                          p.status === "checked_in") && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              disqualify.mutate({ tournamentId, entryId: p.id })
                            }
                          >
                            Disqualify
                          </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No Participants</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canRegister
              ? "Add participants to get started."
              : "No one has registered yet."}
          </p>
        </div>
      )}

      {isAdmin && (
        <AddParticipantDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          tournamentId={tournamentId}
          activityId={activityId}
          existingUserIds={
            participants?.map((p: { userId: string | null }) => p.userId).filter(Boolean) as
              | string[]
              | undefined
          }
        />
      )}
    </div>
  )
}

function AddParticipantDialog({
  open,
  onOpenChange,
  tournamentId,
  activityId,
  existingUserIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  tournamentId: string
  activityId: string
  existingUserIds?: string[]
}) {
  const utils = trpc.useUtils()

  const { data: members, isLoading } = trpc.activityMembership.members.useQuery(
    { activityId, limit: 1000, offset: 0 },
    { enabled: open }
  )

  const adminRegister = trpc.plugin.tournaments.adminRegister.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
    },
  })

  const existingSet = new Set(existingUserIds ?? [])
  const availableMembers =
    members?.filter(
      ({ member }: { member: { userId: string } }) => !existingSet.has(member.userId)
    ) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Participant</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : availableMembers.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground text-center">
            All activity members are already registered.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {availableMembers.map(
              ({ member, user }: { member: { userId: string }; user: { id: string; name: string; image: string | null; email: string | null } }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                  onClick={() =>
                    adminRegister.mutate({ tournamentId, userId: member.userId })
                  }
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <UserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              )
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TeamParticipants({
  tournamentId,
  activityId,
  status,
  isAdmin,
}: Omit<ParticipantsTabProps, "participantType">) {
  const utils = trpc.useUtils()
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [selectedSmartGroupRunId, setSelectedSmartGroupRunId] = useState("")
  const canModify = status === "registration" || status === "draft"

  const { data: teams, isLoading } =
    trpc.plugin.tournaments.listTeams.useQuery({ tournamentId })

  const { data: participants } =
    trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId, limit: 200 })

  const registerAllTeams = trpc.plugin.tournaments.registerAllTeams.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
      utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
    },
  })

  const { data: smartGroupConfig } =
    trpc.plugin.smartGroups.getConfigByActivity.useQuery(
      { activityId },
      { enabled: isAdmin && canModify && (teams?.length ?? 0) === 0 }
    )

  const { data: smartGroupRuns } =
    trpc.plugin.smartGroups.getRunsByActivity.useQuery(
      {
        configId: smartGroupConfig?.id ?? "",
        limit: 20,
        offset: 0,
      },
      {
        enabled:
          isAdmin && canModify && (teams?.length ?? 0) === 0 && !!smartGroupConfig?.id,
      }
    )

  const createTeamsFromSmartGroups =
    trpc.plugin.tournaments.createTeamsFromSmartGroupRun.useMutation({
      onSuccess: () => {
        utils.plugin.tournaments.listTeams.invalidate({ tournamentId })
      },
    })

  const registeredTeamIds = new Set(
    participants?.map((p: { teamId: string | null }) => p.teamId).filter(Boolean) ?? []
  )
  const unregisteredTeamCount = teams?.filter(
    (t: { id: string }) => !registeredTeamIds.has(t.id)
  ).length ?? 0
  useEffect(() => {
    const nextConfirmedRuns =
      smartGroupRuns?.filter((run) => run.status === "confirmed" && run.scope === "activity") ?? []

    if (nextConfirmedRuns.length === 0) {
      setSelectedSmartGroupRunId("")
      return
    }

    const stillValid = nextConfirmedRuns.some((run) => run.id === selectedSmartGroupRunId)
    if (!stillValid) {
      setSelectedSmartGroupRunId(nextConfirmedRuns[0].id)
    }
  }, [smartGroupRuns, selectedSmartGroupRunId])

  const confirmedSmartGroupRuns =
    smartGroupRuns?.filter((run) => run.status === "confirmed" && run.scope === "activity") ?? []

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {teams?.length ?? 0} team{(teams?.length ?? 0) !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          {isAdmin && canModify && (teams?.length ?? 0) === 0 && confirmedSmartGroupRuns.length > 0 && (
            <>
              <Select
                value={selectedSmartGroupRunId}
                onValueChange={setSelectedSmartGroupRunId}
              >
                <SelectTrigger className="h-9 w-[220px] bg-background text-xs">
                  <SelectValue placeholder="Select smart group run" />
                </SelectTrigger>
                <SelectContent>
                  {confirmedSmartGroupRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {formatSmartGroupRunLabel(run)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  createTeamsFromSmartGroups.mutate({
                    tournamentId,
                    smartGroupRunId: selectedSmartGroupRunId,
                  })
                }
                disabled={!selectedSmartGroupRunId || createTeamsFromSmartGroups.isPending}
              >
                {createTeamsFromSmartGroups.isPending
                  ? "Creating Teams..."
                  : "Create Teams From Smart Groups"}
              </Button>
            </>
          )}
          {isAdmin && canModify && unregisteredTeamCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => registerAllTeams.mutate({ tournamentId })}
              disabled={registerAllTeams.isPending}
            >
              {registerAllTeams.isPending
                ? "Registering..."
                : `Register All Teams (${unregisteredTeamCount})`}
            </Button>
          )}
          {isAdmin && canModify && (
            <Button size="sm" onClick={() => setShowCreateTeam(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          )}
        </div>
      </div>

      {teams && teams.length > 0 ? (
        <div className="space-y-3">
          {teams.map(
            (team: {
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
            }) => (
              <TeamCard
                key={team.id}
                team={team}
                tournamentId={tournamentId}
                activityId={activityId}
                isAdmin={isAdmin}
                canModify={canModify}
              />
            )
          )}
        </div>
      ) : (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No Teams</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a team to get started.
          </p>
        </div>
      )}

      {isAdmin && (
        <CreateTeamDialog
          open={showCreateTeam}
          onOpenChange={setShowCreateTeam}
          tournamentId={tournamentId}
          activityId={activityId}
        />
      )}
    </div>
  )
}

function formatSmartGroupRunLabel(run: {
  groupCount: number
  entryCount: number
  createdAt: Date
}) {
  return `${run.groupCount} groups | ${run.entryCount} members | ${new Date(run.createdAt).toLocaleDateString()}`
}

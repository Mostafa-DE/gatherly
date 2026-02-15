import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Trophy,
  MoreVertical,
  Medal,
  ClipboardList,
  UserPlus,
} from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"
import { StatRecordingDialog } from "./stat-recording-dialog"
import { AssignLevelDialog } from "./assign-level-dialog"
import { MatchHistory } from "./match-history"

type RankingManagementProps = {
  activityId: string
}

export function RankingManagement({
  activityId,
}: RankingManagementProps) {
  const { data: definition, isLoading } =
    trpc.plugin.ranking.getByActivity.useQuery({ activityId })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  if (!definition) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{definition.name}</h3>
          <p className="text-xs text-muted-foreground">
            Domain: {getDomain(definition.domainId)?.name ?? definition.domainId}
          </p>
        </div>
      </div>

      {/* Levels preview */}
      <div className="flex flex-wrap gap-1.5">
        {definition.levels.map((level) => (
          <Badge
            key={level.id}
            variant="outline"
            className="text-xs"
            style={{
              borderColor: level.color ?? undefined,
              color: level.color ?? undefined,
            }}
          >
            {level.name}
          </Badge>
        ))}
      </div>

      {/* Leaderboard */}
      <LeaderboardSection
        activityId={activityId}
        rankingDefinitionId={definition.id}
        domainId={definition.domainId}
        levels={definition.levels}
      />
    </div>
  )
}

type Level = {
  id: string
  name: string
  color: string | null
  order: number
}

function LeaderboardSection({
  activityId,
  rankingDefinitionId,
  domainId,
  levels,
}: {
  activityId: string
  rankingDefinitionId: string
  domainId: string
  levels: Level[]
}) {
  const { data: leaderboard, isLoading } =
    trpc.plugin.ranking.getLeaderboard.useQuery({
      rankingDefinitionId,
      includeFormerMembers: false,
    })

  const domain = getDomain(domainId)
  const statFields = domain?.statFields ?? []

  const [statDialog, setStatDialog] = useState<{
    userId: string
    userName: string
  } | null>(null)

  const [levelDialog, setLevelDialog] = useState<{
    userId: string
    userName: string
    currentLevelId: string | null
  } | null>(null)

  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)

  const hasMatchConfig = !!domain?.matchConfig

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    )
  }

  const rankedUserIds = new Set(leaderboard?.map((e) => e.userId) ?? [])

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {leaderboard?.length ?? 0} ranked member{(leaderboard?.length ?? 0) !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddMemberDialog(true)}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            Rank Member
          </Button>
        </div>
      </div>

      {!leaderboard || leaderboard.length === 0 ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Trophy className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No Ranked Members</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Click &quot;Rank Member&quot; to assign levels to activity members.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {leaderboard.map((entry, i) => {
            const stats = (entry.stats as Record<string, number>) ?? {}
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5"
              >
                {/* Position */}
                <span className="w-5 text-center text-xs font-bold text-muted-foreground font-mono">
                  {i + 1}
                </span>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {entry.userName}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {statFields.map((field) => (
                      <span
                        key={field.id}
                        className="text-[11px] text-muted-foreground"
                      >
                        {field.label}:{" "}
                        <span className="font-mono font-medium">
                          {stats[field.id] ?? 0}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Level badge */}
                {entry.levelName ? (
                  <Badge
                    className="border-0 text-xs font-semibold shrink-0"
                    style={{
                      backgroundColor: entry.levelColor
                        ? `${entry.levelColor}20`
                        : undefined,
                      color: entry.levelColor ?? undefined,
                    }}
                  >
                    {entry.levelName}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground italic shrink-0">
                    Unranked
                  </span>
                )}

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() =>
                        setLevelDialog({
                          userId: entry.userId,
                          userName: entry.userName,
                          currentLevelId: entry.currentLevelId,
                        })
                      }
                    >
                      <Medal className="mr-2 h-3.5 w-3.5" />
                      Assign Level
                    </DropdownMenuItem>
                    {!domain?.matchConfig && (
                      <DropdownMenuItem
                        onClick={() =>
                          setStatDialog({
                            userId: entry.userId,
                            userName: entry.userName,
                          })
                        }
                      >
                        <ClipboardList className="mr-2 h-3.5 w-3.5" />
                        Record Stats
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )
          })}
        </div>
      )}

      {statDialog && (
        <StatRecordingDialog
          rankingDefinitionId={rankingDefinitionId}
          domainId={domainId}
          userId={statDialog.userId}
          userName={statDialog.userName}
          open={!!statDialog}
          onOpenChange={(open) => !open && setStatDialog(null)}
        />
      )}

      {levelDialog && (
        <AssignLevelDialog
          rankingDefinitionId={rankingDefinitionId}
          userId={levelDialog.userId}
          userName={levelDialog.userName}
          currentLevelId={levelDialog.currentLevelId}
          levels={levels}
          open={!!levelDialog}
          onOpenChange={(open) => !open && setLevelDialog(null)}
        />
      )}

      {/* Match History */}
      {hasMatchConfig && (
        <div className="space-y-2 pt-2">
          <p className="text-sm font-medium">Recent Matches</p>
          <MatchHistory
            rankingDefinitionId={rankingDefinitionId}
            domainId={domainId}
            playerNames={Object.fromEntries(
              leaderboard?.map((e) => [e.userId, e.userName]) ?? []
            )}
          />
        </div>
      )}

      {showAddMemberDialog && (
        <AddMemberToRankingDialog
          activityId={activityId}
          rankingDefinitionId={rankingDefinitionId}
          levels={levels}
          rankedUserIds={rankedUserIds}
          open={showAddMemberDialog}
          onOpenChange={setShowAddMemberDialog}
        />
      )}

    </>
  )
}

function AddMemberToRankingDialog({
  activityId,
  rankingDefinitionId,
  levels,
  rankedUserIds,
  open,
  onOpenChange,
}: {
  activityId: string
  rankingDefinitionId: string
  levels: Level[]
  rankedUserIds: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: members, isLoading } = trpc.activityMembership.members.useQuery(
    { activityId },
    { enabled: open }
  )

  const [selectedUser, setSelectedUser] = useState<{
    userId: string
    userName: string
  } | null>(null)

  const unrankedMembers = members?.filter(
    ({ member: m }) => !rankedUserIds.has(m.userId)
  ) ?? []

  return (
    <>
      <Dialog open={open && !selectedUser} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Rank Member
            </DialogTitle>
            <DialogDescription>
              Select an activity member to assign a ranking level
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-2.5 w-32 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : unrankedMembers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              All activity members are already ranked
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1 py-2">
              {unrankedMembers.map(({ member: m, user: u }) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setSelectedUser({ userId: m.userId, userName: u.name })
                  }}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={u.image ?? undefined} alt={u.name} />
                    <AvatarFallback className="text-xs">
                      {u.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Medal className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedUser && (
        <AssignLevelDialog
          rankingDefinitionId={rankingDefinitionId}
          userId={selectedUser.userId}
          userName={selectedUser.userName}
          currentLevelId={null}
          levels={levels}
          open={!!selectedUser}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setSelectedUser(null)
              onOpenChange(false)
            }
          }}
        />
      )}
    </>
  )
}

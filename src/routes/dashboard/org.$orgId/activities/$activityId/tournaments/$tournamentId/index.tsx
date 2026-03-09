import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { ArrowLeft, Settings } from "lucide-react"
import { ShareDialog } from "@/components/share-dialog"
import { buildTournamentUrl } from "@/lib/share-urls"
import {
  formatLabels,
  statusStyles,
  statusLabels,
  visibilityLabels,
  participantTypeLabels,
} from "@/plugins/tournaments/components/constants"
import { EditTournamentDialog } from "@/plugins/tournaments/components/tournament-overview"
import { ParticipantsTab } from "@/plugins/tournaments/components/participants-tab"
import { SeedingTab } from "@/plugins/tournaments/components/seeding-tab"
import { BracketTab } from "@/plugins/tournaments/components/bracket-tab"
import { MatchesTab } from "@/plugins/tournaments/components/matches-tab"
import { StandingsTab } from "@/plugins/tournaments/components/standings-tab"
import { AdvancementControls } from "@/plugins/tournaments/components/advancement-controls"
import type { TournamentStatus, TournamentConfig } from "@/plugins/tournaments/types"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/activities/$activityId/tournaments/$tournamentId/"
)({
  component: TournamentDetailPage,
})

const statusTransitionButtons: Record<
  string,
  Array<{ targetStatus: TournamentStatus; label: string; destructive?: boolean }>
> = {
  draft: [
    { targetStatus: "registration", label: "Open Registration" },
    { targetStatus: "in_progress", label: "Start Tournament" },
  ],
  registration: [{ targetStatus: "in_progress", label: "Start Tournament" }],
  in_progress: [
    { targetStatus: "cancelled", label: "Cancel", destructive: true },
  ],
}

function TournamentDetailPage() {
  const { orgId, activityId, tournamentId } = Route.useParams()
  const utils = trpc.useUtils()
  const [confirmAction, setConfirmAction] = useState<{
    status: TournamentStatus
    label: string
  } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [statusError, setStatusError] = useState("")

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: activity } = trpc.activity.getById.useQuery({ activityId })

  const { data: tournament, isLoading: tournamentLoading } =
    trpc.plugin.tournaments.getById.useQuery({ tournamentId })

  const updateStatus = trpc.plugin.tournaments.updateStatus.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getById.invalidate({ tournamentId })
      utils.plugin.tournaments.listByActivity.invalidate()
      utils.plugin.tournaments.getBracket.invalidate({ tournamentId })
      setConfirmAction(null)
      setStatusError("")
    },
    onError: (err) => {
      setStatusError(err.message)
      setConfirmAction(null)
    },
  })

  if (whoamiLoading || tournamentLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 py-6 px-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-5 w-full max-w-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <h2 className="text-xl font-semibold mb-2">Tournament Not Found</h2>
        <Button asChild>
          <Link
            to="/dashboard/org/$orgId/activities/$activityId/tournaments"
            params={{ orgId, activityId }}
          >
            Back to Tournaments
          </Link>
        </Button>
      </div>
    )
  }

  const status = tournament.status as TournamentStatus
  const config = (tournament.config ?? {}) as TournamentConfig
  const format = tournament.format as string
  const actions = statusTransitionButtons[status] ?? []
  const showBracket = status === "in_progress" || status === "completed"
  const showSeeding =
    status === "draft" || status === "registration" || status === "check_in"
  const showStandings =
    format === "round_robin" ||
    format === "swiss" ||
    format === "group_knockout" ||
    format === "free_for_all"
  const canEdit =
    isAdmin && (status === "draft" || status === "registration")
  const defaultTab = showBracket
    ? "bracket"
    : isAdmin && showSeeding
      ? "seeding"
      : "participants"

  // Compact info chips
  const infoChips: string[] = [
    participantTypeLabels[tournament.participantType as string] ??
      (tournament.participantType as string),
    config.maxCapacity ? `${config.maxCapacity} max` : "Unlimited",
    visibilityLabels[tournament.visibility as string] ??
      (tournament.visibility as string),
  ]
  if (config.points) {
    infoChips.push(
      `W${config.points.win} D${config.points.draw} L${config.points.loss} B${config.points.bye}`
    )
  }
  if (config.groupCount) infoChips.push(`${config.groupCount} groups`)
  if (config.advancePerGroup)
    infoChips.push(`Top ${config.advancePerGroup} advance`)
  if (config.swissRounds)
    infoChips.push(`${config.swissRounds} Swiss rounds`)
  if (config.bestOf && config.bestOf > 1)
    infoChips.push(`Best of ${config.bestOf}`)
  if (config.thirdPlaceMatch) infoChips.push("3rd place match")
  if (tournament.participantType === "team") {
    const parts: string[] = []
    if (config.minTeamSize) parts.push(`min ${config.minTeamSize}`)
    if (config.maxTeamSize) parts.push(`max ${config.maxTeamSize}`)
    if (parts.length > 0) infoChips.push(`Team: ${parts.join(", ")}`)
  }

  return (
    <div className="mx-auto max-w-5xl py-6 px-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link
            to="/dashboard/org/$orgId/activities/$activityId/tournaments"
            params={{ orgId, activityId }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-bold tracking-tight truncate max-w-[40%]">
          {tournament.name}
        </h1>
        <Badge
          variant="secondary"
          className={`border-0 text-xs shrink-0 ${statusStyles[status] ?? ""}`}
        >
          {statusLabels[status] ?? status}
        </Badge>
        <Badge variant="outline" className="text-xs shrink-0">
          {formatLabels[format] ?? format}
        </Badge>

        {/* Admin actions — right side */}
        {isAdmin && (
          <div className="flex items-center gap-2 ml-auto shrink-0">
            {whoami?.activeOrganization?.ownerUsername &&
              whoami.activeOrganization.userSlug &&
              activity?.slug &&
              tournament.visibility === "public" && (
                <ShareDialog
                  url={buildTournamentUrl(
                    whoami.activeOrganization.ownerUsername,
                    whoami.activeOrganization.userSlug,
                    activity.slug,
                    tournamentId
                  )}
                  title={tournament.name}
                  type="session"
                  groupName={whoami.activeOrganization.name}
                  username={whoami.activeOrganization.ownerUsername}
                />
              )}
            <AdvancementControls
              tournamentId={tournamentId}
              format={format}
              status={status}
            />
            {actions.map((action) => (
              <Button
                key={action.targetStatus}
                variant={action.destructive ? "destructive" : "default"}
                size="sm"
                onClick={() =>
                  setConfirmAction({
                    status: action.targetStatus,
                    label: action.label,
                  })
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {statusError && (
        <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {statusError}
        </div>
      )}

      {/* Info strip */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {infoChips.map((chip, i) => (
          <span
            key={i}
            className="rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
          >
            {chip}
          </span>
        ))}
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto text-muted-foreground hover:text-foreground"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {showBracket && (
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
          )}
          {showBracket && (
            <TabsTrigger value="matches">Matches</TabsTrigger>
          )}
          {showStandings && showBracket && (
            <TabsTrigger value="standings">Standings</TabsTrigger>
          )}
          {isAdmin && showSeeding && (
            <TabsTrigger value="seeding">Seeding</TabsTrigger>
          )}
          <TabsTrigger value="participants">Participants</TabsTrigger>
        </TabsList>

        {isAdmin && showSeeding && (
          <TabsContent value="seeding" className="mt-4">
            <SeedingTab
              tournamentId={tournamentId}
              activityId={activityId}
              tournament={tournament}
              isAdmin={isAdmin}
            />
          </TabsContent>
        )}

        {showBracket && (
          <TabsContent value="bracket" className="mt-4">
            <BracketTab
              activityId={activityId}
              tournamentId={tournamentId}
              format={format}
              participantType={tournament.participantType as string}
              currentUserId={whoami?.user?.id}
              isAdmin={isAdmin}
            />
          </TabsContent>
        )}

        {showBracket && (
          <TabsContent value="matches" className="mt-4">
            <MatchesTab tournamentId={tournamentId} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {showStandings && showBracket && (
          <TabsContent value="standings" className="mt-4">
            <StandingsTab tournamentId={tournamentId} />
          </TabsContent>
        )}

        <TabsContent value="participants" className="mt-4">
          <ParticipantsTab
            tournamentId={tournamentId}
            activityId={activityId}
            participantType={tournament.participantType as string}
            status={status}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>

      {/* Edit settings dialog */}
      {canEdit && (
        <EditTournamentDialog
          tournament={tournament}
          open={showSettings}
          onOpenChange={setShowSettings}
        />
      )}

      {/* Status transition confirmation */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.status === "in_progress"
                ? "This will generate the bracket and start the tournament. Participants will be locked in."
                : confirmAction?.status === "cancelled"
                  ? "This will cancel the tournament. This action cannot be undone."
                  : `Change the tournament status to "${statusLabels[confirmAction?.status ?? ""] ?? confirmAction?.status}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction?.status === "cancelled"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={() => {
                if (confirmAction) {
                  updateStatus.mutate({
                    tournamentId,
                    status: confirmAction.status,
                  })
                }
              }}
            >
              {updateStatus.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

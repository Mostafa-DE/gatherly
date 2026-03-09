import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { ArrowLeft, Plus, Swords, Trash2 } from "lucide-react"
import {
  formatLabels,
  statusStyles,
  statusLabels,
} from "@/plugins/tournaments/components/constants"
import type { TournamentStatus } from "@/plugins/tournaments/types"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/activities/$activityId/tournaments/"
)({
  component: TournamentListPage,
})

const filterTabs: Array<{ value: TournamentStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "registration", label: "Registration" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

function TournamentListPage() {
  const { orgId, activityId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()
  const [statusFilter, setStatusFilter] = useState<TournamentStatus | "all">("all")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: tournaments, isLoading: tournamentsLoading } =
    trpc.plugin.tournaments.listByActivity.useQuery({
      activityId,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 100,
    })

  const deleteDraft = trpc.plugin.tournaments.deleteDraft.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.listByActivity.invalidate({ activityId })
      setDeleteId(null)
    },
  })

  if (whoamiLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const deleteTournament = tournaments?.find(
    (t: { id: string }) => t.id === deleteId
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link
              to="/dashboard/org/$orgId/activities/$activityId"
              params={{ orgId, activityId }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
          </div>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link
              to="/dashboard/org/$orgId/activities/$activityId/tournaments/create"
              params={{ orgId, activityId }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Link>
          </Button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tournament list */}
      {tournamentsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : tournaments && tournaments.length > 0 ? (
        <div className="space-y-3">
          {tournaments.map((t: {
            id: string
            name: string
            format: string
            status: string
            participantType: string
            startsAt: Date | null
            createdAt: Date
          }) => (
            <div
              key={t.id}
              className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-colors hover:bg-card/80 cursor-pointer"
              onClick={() =>
                navigate({
                  to: "/dashboard/org/$orgId/activities/$activityId/tournaments/$tournamentId",
                  params: { orgId, activityId, tournamentId: t.id },
                })
              }
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Swords className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{t.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatLabels[t.format] ?? t.format}
                  {t.participantType === "team" ? " · Teams" : ""}
                  {t.startsAt
                    ? ` · ${new Date(t.startsAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <Badge
                variant="secondary"
                className={`border-0 text-xs shrink-0 ${statusStyles[t.status] ?? ""}`}
              >
                {statusLabels[t.status] ?? t.status}
              </Badge>
              {isAdmin && t.status === "draft" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteId(t.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 p-12 text-center backdrop-blur-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Swords className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium">No Tournaments</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {statusFilter !== "all"
              ? `No ${statusLabels[statusFilter]?.toLowerCase()} tournaments found.`
              : "Create your first tournament to get started."}
          </p>
          {isAdmin && statusFilter === "all" && (
            <Button className="mt-4" asChild>
              <Link
                to="/dashboard/org/$orgId/activities/$activityId/tournaments/create"
                params={{ orgId, activityId }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Tournament
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTournament?.name}&quot;? This
              action cannot be undone. Only draft tournaments can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) deleteDraft.mutate({ tournamentId: deleteId })
              }}
            >
              {deleteDraft.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

import { Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Swords } from "lucide-react"
import { formatLabels, statusStyles, statusLabels } from "./constants"
import type { TournamentStatus } from "../types"

type TournamentsSectionProps = {
  activityId: string
  orgId: string
  activity: {
    enabledPlugins: unknown
  }
}

export function TournamentsSection({ activityId, orgId, activity }: TournamentsSectionProps) {
  const enabledPlugins = (activity.enabledPlugins ?? {}) as Record<string, boolean>
  if (enabledPlugins["tournaments"] !== true) return null

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Swords className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Tournaments</h2>
            <p className="text-sm text-muted-foreground">
              Brackets, seeding, and competitive play
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link
            to="/dashboard/org/$orgId/activities/$activityId/tournaments"
            params={{ orgId, activityId }}
          >
            Manage
          </Link>
        </Button>
      </div>

      <TournamentsSummary activityId={activityId} />
    </div>
  )
}

function TournamentsSummary({ activityId }: { activityId: string }) {
  const { data: tournaments, isLoading } =
    trpc.plugin.tournaments.listByActivity.useQuery({ activityId, limit: 5 })

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    )
  }

  if (!tournaments || tournaments.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm text-muted-foreground">
          No tournaments yet. Create one from the tournaments page.
        </p>
      </div>
    )
  }

  const active = tournaments.filter(
    (t: { status: string }) => t.status === "in_progress" || t.status === "registration" || t.status === "check_in"
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""}</span>
        {active.length > 0 && (
          <span className="text-[var(--color-status-success)]">
            {active.length} active
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {tournaments.slice(0, 3).map((t: {
          id: string
          name: string
          status: string
          format: string
        }) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{t.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatLabels[t.format] ?? t.format}
              </p>
            </div>
            <Badge
              variant="secondary"
              className={`border-0 text-xs shrink-0 ${statusStyles[t.status as TournamentStatus] ?? ""}`}
            >
              {statusLabels[t.status as TournamentStatus] ?? t.status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

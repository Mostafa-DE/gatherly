import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { useSession } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Swords } from "lucide-react"
import {
  formatLabels,
  statusStyles,
  statusLabels,
} from "@/plugins/tournaments/components/constants"

export const Route = createFileRoute(
  "/$username/$groupSlug/activities/$activitySlug/tournaments/"
)({
  component: PublicTournamentListPage,
})

function PublicTournamentListPage() {
  const { username, groupSlug, activitySlug } = Route.useParams()
  const { data: session, isPending: sessionPending } = useSession()
  const isLoggedIn = !sessionPending && !!session?.user

  const { data: org, isLoading: orgLoading } =
    trpc.organization.getPublicInfo.useQuery({ username, groupSlug })

  const { data: activity, isLoading: activityLoading } =
    trpc.activity.getPublicBySlug.useQuery(
      { organizationId: org?.id ?? "", slug: activitySlug },
      { enabled: !!org?.id }
    )

  const { data: tournaments, isLoading: tournamentsLoading } =
    trpc.plugin.tournaments.publicListByActivity.useQuery(
      { activityId: activity?.id ?? "" },
      { enabled: !!activity?.id }
    )

  const isLoading = orgLoading || activityLoading || tournamentsLoading

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link
            to="/$username/$groupSlug"
            params={{ username, groupSlug }}
            className="hover:text-foreground"
          >
            {org?.name ?? username}
          </Link>
          <span>/</span>
          <Link
            to="/$username/$groupSlug/activities/$activitySlug"
            params={{ username, groupSlug, activitySlug }}
            className="hover:text-foreground"
          >
            {activity?.name ?? activitySlug}
          </Link>
          <span>/</span>
          <span className="text-foreground">Tournaments</span>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <Swords className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Tournaments</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : tournaments && tournaments.length > 0 ? (
          <div className="space-y-3">
            {(
              tournaments as Array<{
                id: string
                name: string
                format: string
                status: string
                startsAt: Date | null
              }>
            ).map((t) => (
              <Link
                key={t.id}
                to="/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId"
                params={{
                  username,
                  groupSlug,
                  activitySlug,
                  tournamentId: t.id,
                }}
                className="group flex items-center gap-4 rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-colors hover:bg-card/80"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Swords className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatLabels[t.format] ?? t.format}
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
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/50 p-12 text-center backdrop-blur-sm">
            <Swords className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No public tournaments available.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { useSession } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Swords } from "lucide-react"
import { MatchCard } from "@/plugins/tournaments/components/match-card"

export const Route = createFileRoute(
  "/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId/matches/$matchId"
)({
  component: PublicMatchDetailPage,
})

function PublicMatchDetailPage() {
  const { username, groupSlug, activitySlug, tournamentId, matchId } =
    Route.useParams()
  const { data: session, isPending: sessionPending } = useSession()
  const isLoggedIn = !sessionPending && !!session?.user

  const { data: org, isLoading: orgLoading } =
    trpc.organization.getPublicInfo.useQuery({ username, groupSlug })

  const { data: activity, isLoading: activityLoading } =
    trpc.activity.getPublicBySlug.useQuery(
      { organizationId: org?.id ?? "", slug: activitySlug },
      { enabled: !!org?.id }
    )

  const { data: matchData, isLoading: matchLoading } =
    trpc.plugin.tournaments.publicGetMatch.useQuery(
      { activityId: activity?.id ?? "", tournamentId, matchId },
      { enabled: !!activity?.id }
    )

  const participantMap = useMemo(() => {
    const map = new Map<
      string,
      { id: string; participantName: string; participantImage: string | null; seed: number | null }
    >()
    if (matchData?.entries) {
      for (const e of matchData.entries as Array<{
        id: string
        participantName: string
        participantImage: string | null
        seed: number | null
      }>) {
        map.set(e.id, e)
      }
    }
    return map
  }, [matchData?.entries])

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Back link */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId"
              params={{ username, groupSlug, activitySlug, tournamentId }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tournament
            </Link>
          </Button>
        </div>

        {orgLoading || activityLoading || matchLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : !matchData ? (
          <div className="py-16 text-center">
            <Swords className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Match Not Found</h2>
            <p className="text-muted-foreground">
              This match doesn&apos;t exist or isn&apos;t publicly visible.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Context info */}
            <div className="space-y-1">
              <h1 className="text-xl font-bold">
                Match #{(matchData.match as { matchNumber: number }).matchNumber}
              </h1>
              <div className="text-sm text-muted-foreground">
                {matchData.stage && (
                  <span>
                    {(matchData.stage as { stageType: string }).stageType.replace("_", " ")}
                  </span>
                )}
                {matchData.round && (
                  <span> · Round {(matchData.round as { roundNumber: number }).roundNumber}</span>
                )}
                {matchData.group && (
                  <span> · {(matchData.group as { name: string }).name}</span>
                )}
              </div>
            </div>

            {/* Match card (large) */}
            <MatchCard
              match={matchData.match as {
                id: string
                matchNumber: number
                status: string
                scores: unknown
                winnerEntryId: string | null
              }}
              matchEntries={
                (matchData.matchEntries as Array<{
                  id: string
                  matchId: string
                  entryId: string
                  slot: number
                  result: string | null
                  score: unknown
                }>) ?? []
              }
              participantMap={participantMap}
              isAdmin={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}

import { useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { useSession } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Swords, UserPlus, Users, ChevronRight } from "lucide-react"
import {
  formatLabels,
  statusStyles,
  statusLabels,
  participantTypeLabels,
} from "@/plugins/tournaments/components/constants"
import { BracketTree } from "@/plugins/tournaments/components/bracket-tree"
import { MatchCard } from "@/plugins/tournaments/components/match-card"

export const Route = createFileRoute(
  "/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId/"
)({
  component: PublicTournamentDetailPage,
})

function PublicTournamentDetailPage() {
  const { username, groupSlug, activitySlug, tournamentId } = Route.useParams()
  const { data: session, isPending: sessionPending } = useSession()
  const isLoggedIn = !sessionPending && !!session?.user

  const { data: org, isLoading: orgLoading } =
    trpc.organization.getPublicInfo.useQuery({ username, groupSlug })

  const { data: activity, isLoading: activityLoading } =
    trpc.activity.getPublicBySlug.useQuery(
      { organizationId: org?.id ?? "", slug: activitySlug },
      { enabled: !!org?.id }
    )

  const { data: tournament, isLoading: tournamentLoading } =
    trpc.plugin.tournaments.publicGetById.useQuery(
      { activityId: activity?.id ?? "", tournamentId },
      { enabled: !!activity?.id }
    )

  const { data: bracket, isLoading: bracketLoading } =
    trpc.plugin.tournaments.publicGetBracket.useQuery(
      { activityId: activity?.id ?? "", tournamentId },
      { enabled: !!activity?.id && !!tournament }
    )

  const { data: standings, isLoading: standingsLoading } =
    trpc.plugin.tournaments.publicGetStandings.useQuery(
      { activityId: activity?.id ?? "", tournamentId },
      { enabled: !!activity?.id && !!tournament }
    )

  // Check membership (only if logged in)
  const { data: myOrgs } = trpc.user.myOrgs.useQuery(undefined, {
    enabled: !!session?.user,
  })
  const isOrgMember = myOrgs?.some((m) => m.organization.id === org?.id)

  // Build participant map from public bracket entries
  const participantMap = useMemo(() => {
    const map = new Map<
      string,
      { id: string; userId: string | null; participantName: string; participantImage: string | null; seed: number | null }
    >()
    if (bracket?.entries) {
      for (const e of bracket.entries as Array<{
        id: string
        userId: string | null
        participantName: string
        participantImage: string | null
        seed: number | null
      }>) {
        map.set(e.id, e)
      }
    }
    return map
  }, [bracket?.entries])

  const participantCount = participantMap.size

  if (orgLoading || activityLoading || tournamentLoading) {
    return (
      <div className="min-h-screen bg-background">
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Skeleton className="h-6 w-48 mb-6" />
          <Skeleton className="h-10 w-80 mb-3" />
          <Skeleton className="h-5 w-64 mb-8" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background">
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <Swords className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Tournament Not Found</h2>
          <p className="text-muted-foreground">
            This tournament doesn&apos;t exist or isn&apos;t publicly visible.
          </p>
        </div>
      </div>
    )
  }

  const t = tournament as {
    id: string
    name: string
    format: string
    status: string
    startsAt: Date | null
    participantType: string
  }

  const format = t.format
  const isElimination =
    format === "single_elimination" || format === "double_elimination"
  const showStandings =
    format === "round_robin" ||
    format === "swiss" ||
    format === "group_knockout" ||
    format === "free_for_all"

  const rounds = (bracket?.rounds ?? []) as Array<{ id: string; roundNumber: number; groupId: string | null; stageId: string }>
  const matches = (bracket?.matches ?? []) as Array<{ id: string; roundId: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null }>
  const matchEntries = (bracket?.matchEntries ?? []) as Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>
  const edges = (bracket?.edges ?? []) as Array<{ id: string; fromMatchId: string; toMatchId: string; outcomeType: string; toSlot: number }>
  const groups = (bracket?.groups ?? []) as Array<{ id: string; name: string; groupOrder: number; stageId: string }>

  const standingsData = standings as {
    stage: unknown
    groups: Array<{ id: string; name: string }>
    standings: Array<{
      id: string
      entryId: string
      rank: number
      wins: number
      losses: number
      draws: number
      points: number
    }>
    entries: Array<{
      id: string
      participantName: string
      participantImage: string | null
      seed: number | null
    }>
  } | null

  const showJoinCta = !sessionPending && !isOrgMember

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />

      <div className="mx-auto max-w-5xl px-4 pt-10 pb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-5">
          <Link
            to="/$username/$groupSlug"
            params={{ username, groupSlug }}
            className="hover:text-foreground transition-colors"
          >
            {org?.name ?? username}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <Link
            to="/$username/$groupSlug/activities/$activitySlug"
            params={{ username, groupSlug, activitySlug }}
            className="hover:text-foreground transition-colors"
          >
            {activity?.name ?? activitySlug}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="text-foreground font-medium truncate">Tournament</span>
        </nav>

        {/* Tournament title block */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-3">
                {t.name}
              </h1>
              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge
                  variant="secondary"
                  className={`border-0 text-xs ${statusStyles[t.status] ?? ""}`}
                >
                  {statusLabels[t.status] ?? t.status}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {formatLabels[format] ?? format}
                </Badge>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-sm text-muted-foreground">
                  {participantTypeLabels[t.participantType] ?? t.participantType}
                </span>
                {participantCount > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span className="font-mono font-medium">{participantCount}</span>
                      participants
                    </span>
                  </>
                )}
              </div>
              {org && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Hosted by{" "}
                  <Link
                    to="/$username/$groupSlug"
                    params={{ username, groupSlug }}
                    className="font-medium text-primary hover:underline"
                  >
                    {org.name}
                  </Link>
                </p>
              )}
            </div>

            {showJoinCta && (
              <Button size="sm" className="shrink-0 mt-1" asChild>
                <Link
                  to="/$username/$groupSlug"
                  params={{ username, groupSlug }}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Join {org?.name ?? "Group"}
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bracket">
          <TabsList>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            {showStandings && (
              <TabsTrigger value="standings">Standings</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="bracket" className="mt-6">
            {bracketLoading ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : matches.length > 0 ? (
              isElimination ? (
                <BracketTree
                  rounds={rounds}
                  matches={matches}
                  matchEntries={matchEntries}
                  edges={edges}
                  participantMap={participantMap}
                  currentUserId={session?.user?.id}
                  isAdmin={false}
                  format={format}
                  onReportScore={() => {}}
                  onForfeit={() => {}}
                />
              ) : (
                <PublicRoundView
                  rounds={rounds}
                  matches={matches}
                  matchEntries={matchEntries}
                  groups={groups}
                  participantMap={participantMap}
                  currentUserId={session?.user?.id}
                  username={username}
                  groupSlug={groupSlug}
                  activitySlug={activitySlug}
                  tournamentId={tournamentId}
                />
              )
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No bracket data available yet.
              </div>
            )}
          </TabsContent>

          <TabsContent value="matches" className="mt-6">
            {bracketLoading ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : matches.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matches.map((match) => (
                  <Link
                    key={match.id}
                    to="/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId/matches/$matchId"
                    params={{
                      username,
                      groupSlug,
                      activitySlug,
                      tournamentId,
                      matchId: match.id,
                    }}
                  >
                    <MatchCard
                      match={match}
                      matchEntries={matchEntries.filter(
                        (me) => me.matchId === match.id
                      )}
                      participantMap={participantMap}
                      currentUserId={session?.user?.id}
                      isAdmin={false}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No matches yet.
              </div>
            )}
          </TabsContent>

          {showStandings && (
            <TabsContent value="standings" className="mt-6">
              {standingsLoading ? (
                <Skeleton className="h-48 rounded-xl" />
              ) : standingsData && standingsData.standings.length > 0 ? (
                <PublicStandingsTable
                  standings={standingsData.standings}
                  entries={standingsData.entries}
                />
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No standings data available.
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

function PublicRoundView({
  rounds,
  matches,
  matchEntries,
  groups,
  participantMap,
  currentUserId,
  username,
  groupSlug,
  activitySlug,
  tournamentId,
}: {
  rounds: Array<{ id: string; roundNumber: number; groupId: string | null; stageId: string }>
  matches: Array<{ id: string; roundId: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null }>
  matchEntries: Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>
  groups: Array<{ id: string; name: string; groupOrder: number; stageId: string }>
  participantMap: Map<string, { id: string; userId: string | null; participantName: string; participantImage: string | null; seed: number | null }>
  currentUserId?: string | null
  username: string
  groupSlug: string
  activitySlug: string
  tournamentId: string
}) {
  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber)

  return (
    <div className="space-y-6">
      {sortedRounds.map((round) => {
        const roundMatches = matches
          .filter((m) => m.roundId === round.id)
          .sort((a, b) => a.matchNumber - b.matchNumber)
        const group = round.groupId
          ? groups.find((g) => g.id === round.groupId)
          : null

        return (
          <div key={round.id} className="space-y-3">
            <h3 className="text-sm font-semibold">
              Round {round.roundNumber}
              {group && <span className="text-muted-foreground ml-2">{group.name}</span>}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roundMatches.map((match) => (
                <Link
                  key={match.id}
                  to="/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId/matches/$matchId"
                  params={{
                    username,
                    groupSlug,
                    activitySlug,
                    tournamentId,
                    matchId: match.id,
                  }}
                >
                  <MatchCard
                    match={match}
                    matchEntries={matchEntries.filter(
                      (me) => me.matchId === match.id
                    )}
                    participantMap={participantMap}
                    currentUserId={currentUserId}
                    isAdmin={false}
                  />
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PublicStandingsTable({
  standings,
  entries,
}: {
  standings: Array<{
    id: string
    entryId: string
    rank: number
    wins: number
    losses: number
    draws: number
    points: number
  }>
  entries: Array<{
    id: string
    participantName: string
    participantImage: string | null
  }>
}) {
  const entryMap = new Map(entries.map((e) => [e.id, e]))

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 text-xs text-muted-foreground">
            <th className="px-3 py-2.5 text-left font-medium w-10">#</th>
            <th className="px-3 py-2.5 text-left font-medium">Participant</th>
            <th className="px-3 py-2.5 text-center font-medium font-mono w-12">W</th>
            <th className="px-3 py-2.5 text-center font-medium font-mono w-12">L</th>
            <th className="px-3 py-2.5 text-center font-medium font-mono w-12">D</th>
            <th className="px-3 py-2.5 text-center font-medium font-mono w-14">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => {
            const entry = entryMap.get(row.entryId)
            return (
              <tr
                key={row.id}
                className="border-b border-border/30 last:border-0"
              >
                <td className="px-3 py-2.5 font-mono text-xs font-bold text-muted-foreground">
                  {row.rank}
                </td>
                <td className="px-3 py-2.5 font-medium truncate">
                  {entry?.participantName ?? "Unknown"}
                </td>
                <td className="px-3 py-2.5 text-center font-mono">{row.wins}</td>
                <td className="px-3 py-2.5 text-center font-mono">{row.losses}</td>
                <td className="px-3 py-2.5 text-center font-mono">{row.draws}</td>
                <td className="px-3 py-2.5 text-center font-mono font-medium">
                  {row.points}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

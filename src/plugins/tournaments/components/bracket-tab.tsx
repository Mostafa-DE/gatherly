import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { MatchCard } from "./match-card"
import { ReportScoreDialog } from "./report-score-dialog"
import { ForfeitDialog } from "./forfeit-dialog"
import { BracketTree } from "./bracket-tree"

type BracketTabProps = {
  activityId: string
  tournamentId: string
  format: string
  participantType: string
  currentUserId?: string | null
  isAdmin: boolean
}

type RankingSummary = {
  position: number
  levelName: string | null
  levelColor: string | null
}

export function BracketTab({
  activityId,
  tournamentId,
  format,
  participantType,
  currentUserId,
  isAdmin,
}: BracketTabProps) {
  const [reportMatch, setReportMatch] = useState<string | null>(null)
  const [forfeitMatch, setForfeitMatch] = useState<string | null>(null)

  const { data: bracket, isLoading: bracketLoading } =
    trpc.plugin.tournaments.getBracket.useQuery({ tournamentId })

  const { data: participants, isLoading: participantsLoading } =
    trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId, limit: 200 })

  const { data: rankingDefinition, isLoading: rankingDefinitionLoading } =
    trpc.plugin.ranking.getByActivity.useQuery(
      { activityId },
      { enabled: participantType === "individual" }
    )

  const { data: leaderboard, isLoading: leaderboardLoading } =
    trpc.plugin.ranking.getLeaderboard.useQuery(
      {
        rankingDefinitionId: rankingDefinition?.id ?? "",
        includeFormerMembers: false,
      },
      {
        enabled:
          participantType === "individual" && !!rankingDefinition?.id,
      }
    )

  const rankingMap = useMemo(() => {
    const map = new Map<string, RankingSummary>()
    if (!leaderboard) return map

    leaderboard.forEach((entry, index) => {
      map.set(entry.userId, {
        position: index + 1,
        levelName: entry.levelName,
        levelColor: entry.levelColor,
      })
    })

    return map
  }, [leaderboard])

  const participantMap = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string
        userId: string | null
        participantName: string
        participantImage: string | null
        seed: number | null
        rankPosition: number | null
        rankLevelName: string | null
        rankLevelColor: string | null
      }
    >()
    if (participants) {
      for (const p of participants as Array<{
        id: string
        userId: string | null
        participantName: string
        participantImage: string | null
        seed: number | null
      }>) {
        const rank = p.userId ? rankingMap.get(p.userId) : undefined
        map.set(p.id, {
          ...p,
          rankPosition: rank?.position ?? null,
          rankLevelName: rank?.levelName ?? null,
          rankLevelColor: rank?.levelColor ?? null,
        })
      }
    }
    return map
  }, [participants, rankingMap])

  if (
    bracketLoading ||
    participantsLoading ||
    rankingDefinitionLoading ||
    leaderboardLoading
  ) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (!bracket || bracket.matches.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No bracket data available.
        </p>
      </div>
    )
  }

  const isElimination =
    format === "single_elimination" || format === "double_elimination"

  const stages = (bracket.stages ?? []) as Array<{ id: string; stageType: string; stageOrder: number; status: string }>
  const allRounds = bracket.rounds as Array<{ id: string; roundNumber: number; groupId: string | null; stageId: string }>
  const allMatches = bracket.matches as Array<{ id: string; roundId: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null; version: number }>
  const allMatchEntries = bracket.matchEntries as Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>
  const allEdges = bracket.edges as Array<{ id: string; fromMatchId: string; toMatchId: string; outcomeType: string; toSlot: number }>
  const allGroups = bracket.groups as Array<{ id: string; name: string; groupOrder: number }>

  // For group_knockout: split data by stage
  const groupStage = format === "group_knockout" ? stages.find((s) => s.stageType === "group") : null
  const knockoutStage = format === "group_knockout" ? stages.find((s) => s.stageType === "single_elimination") : null

  const groupRoundIds = groupStage ? new Set(allRounds.filter((r) => r.stageId === groupStage.id).map((r) => r.id)) : null
  const knockoutRoundIds = knockoutStage ? new Set(allRounds.filter((r) => r.stageId === knockoutStage.id).map((r) => r.id)) : null

  const knockoutRounds = knockoutRoundIds ? allRounds.filter((r) => knockoutRoundIds.has(r.id)) : []
  const knockoutMatchIds = knockoutRoundIds ? new Set(allMatches.filter((m) => knockoutRoundIds.has(m.roundId)).map((m) => m.id)) : new Set<string>()

  const selectedMatch = reportMatch
    ? allMatches.find((m) => m.id === reportMatch)
    : null

  const selectedForfeitMatch = forfeitMatch
    ? allMatches.find((m) => m.id === forfeitMatch)
    : null

  return (
    <div className="space-y-6">
      {format === "group_knockout" ? (
        <>
          {/* Group stage: round-by-round */}
          {groupStage && (
            <RoundByRoundView
              rounds={allRounds.filter((r) => groupRoundIds?.has(r.id))}
              matches={allMatches.filter((m) => groupRoundIds?.has(m.roundId))}
              matchEntries={allMatchEntries.filter((me) => {
                const match = allMatches.find((m) => m.id === me.matchId)
                return match && groupRoundIds?.has(match.roundId)
              })}
              groups={allGroups}
              participantMap={participantMap}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReportScore={(matchId) => setReportMatch(matchId)}
              onForfeit={(matchId) => setForfeitMatch(matchId)}
              stageLabel="Group Stage"
            />
          )}

          {/* Knockout stage: bracket tree */}
          {knockoutStage && knockoutRounds.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Knockout Stage
              </h2>
              <BracketTree
                rounds={knockoutRounds}
                matches={allMatches.filter((m) => knockoutRoundIds?.has(m.roundId))}
                matchEntries={allMatchEntries.filter((me) => knockoutMatchIds.has(me.matchId))}
                edges={allEdges.filter((e) => knockoutMatchIds.has(e.fromMatchId) || knockoutMatchIds.has(e.toMatchId))}
                participantMap={participantMap}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                format="single_elimination"
                onReportScore={(matchId) => setReportMatch(matchId)}
                onForfeit={(matchId) => setForfeitMatch(matchId)}
              />
            </div>
          )}
        </>
      ) : isElimination ? (
        <BracketTree
          rounds={allRounds}
          matches={allMatches}
          matchEntries={allMatchEntries}
          edges={allEdges}
          participantMap={participantMap}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          format={format}
          onReportScore={(matchId) => setReportMatch(matchId)}
          onForfeit={(matchId) => setForfeitMatch(matchId)}
        />
      ) : (
        <RoundByRoundView
          rounds={allRounds}
          matches={allMatches}
          matchEntries={allMatchEntries}
          groups={allGroups}
          participantMap={participantMap}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onReportScore={(matchId) => setReportMatch(matchId)}
          onForfeit={(matchId) => setForfeitMatch(matchId)}
        />
      )}

      {/* Report score dialog */}
      {selectedMatch && (
        <ReportScoreDialog
          open={!!reportMatch}
          onOpenChange={(open) => !open && setReportMatch(null)}
          tournamentId={tournamentId}
          match={selectedMatch}
          matchEntries={
            (bracket.matchEntries as Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>).filter(
              (me) => me.matchId === selectedMatch.id
            )
          }
          participantMap={participantMap}
        />
      )}

      {/* Forfeit dialog */}
      {selectedForfeitMatch && (
        <ForfeitDialog
          open={!!forfeitMatch}
          onOpenChange={(open) => !open && setForfeitMatch(null)}
          tournamentId={tournamentId}
          match={selectedForfeitMatch}
          matchEntries={
            (bracket.matchEntries as Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>).filter(
              (me) => me.matchId === selectedForfeitMatch.id
            )
          }
          participantMap={participantMap}
        />
      )}
    </div>
  )
}

// Round-by-round view for non-elimination formats (round robin, swiss, group, ffa)
function RoundByRoundView({
  rounds,
  matches,
  matchEntries,
  groups,
  participantMap,
  currentUserId,
  isAdmin,
  onReportScore,
  onForfeit,
  stageLabel,
}: {
  rounds: Array<{ id: string; roundNumber: number; groupId: string | null; stageId: string }>
  matches: Array<{ id: string; roundId: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null }>
  matchEntries: Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>
  groups: Array<{ id: string; name: string; groupOrder: number }>
  participantMap: Map<string, {
    id: string
    userId: string | null
    participantName: string
    participantImage: string | null
    seed: number | null
    rankPosition: number | null
    rankLevelName: string | null
    rankLevelColor: string | null
  }>
  currentUserId?: string | null
  isAdmin: boolean
  onReportScore: (matchId: string) => void
  onForfeit: (matchId: string) => void
  stageLabel?: string
}) {
  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber)

  return (
    <div className="space-y-6">
      {stageLabel && (
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {stageLabel}
        </h2>
      )}
      {sortedRounds.map((round) => {
        const roundMatches = matches
          .filter((m) => m.roundId === round.id)
          .sort((a, b) => a.matchNumber - b.matchNumber)
        const group = round.groupId
          ? groups.find((g) => g.id === round.groupId)
          : null

        return (
          <div key={round.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">
                Round {round.roundNumber}
              </h3>
              {group && (
                <span className="text-xs text-muted-foreground">
                  {group.name}
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roundMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  matchEntries={matchEntries.filter(
                    (me) => me.matchId === match.id
                  )}
                  participantMap={participantMap}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onReportScore={() => onReportScore(match.id)}
                  onForfeit={() => onForfeit(match.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

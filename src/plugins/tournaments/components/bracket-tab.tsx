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

  const selectedMatch = reportMatch
    ? (bracket.matches as Array<{ id: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null; version: number }>).find(
        (m) => m.id === reportMatch
      )
    : null

  const selectedForfeitMatch = forfeitMatch
    ? (bracket.matches as Array<{ id: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null }>).find(
        (m) => m.id === forfeitMatch
      )
    : null

  return (
    <div className="space-y-6">
      {isElimination ? (
        <BracketTree
          rounds={bracket.rounds as Array<{ id: string; roundNumber: number; groupId: string | null }>}
          matches={bracket.matches as Array<{ id: string; roundId: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null }>}
          matchEntries={bracket.matchEntries as Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>}
          edges={bracket.edges as Array<{ id: string; fromMatchId: string; toMatchId: string; outcomeType: string; toSlot: number }>}
          participantMap={participantMap}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          format={format}
          onReportScore={(matchId) => setReportMatch(matchId)}
          onForfeit={(matchId) => setForfeitMatch(matchId)}
        />
      ) : (
        <RoundByRoundView
          rounds={bracket.rounds as Array<{ id: string; roundNumber: number; groupId: string | null; stageId: string }>}
          matches={bracket.matches as Array<{ id: string; roundId: string; matchNumber: number; status: string; scores: unknown; winnerEntryId: string | null }>}
          matchEntries={bracket.matchEntries as Array<{ id: string; matchId: string; entryId: string; slot: number; result: string | null; score: unknown }>}
          groups={bracket.groups as Array<{ id: string; name: string; groupOrder: number }>}
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

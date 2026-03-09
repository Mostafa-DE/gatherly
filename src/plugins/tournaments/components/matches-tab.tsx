import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { MatchCard } from "./match-card"
import { ReportScoreDialog } from "./report-score-dialog"
import { ForfeitDialog } from "./forfeit-dialog"
import { MATCH_STATUSES } from "../types"
import { matchStatusLabels } from "./constants"

type MatchesTabProps = {
  tournamentId: string
  isAdmin: boolean
}

export function MatchesTab({ tournamentId, isAdmin }: MatchesTabProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [reportMatchId, setReportMatchId] = useState<string | null>(null)
  const [forfeitMatchId, setForfeitMatchId] = useState<string | null>(null)

  const { data: bracket, isLoading: bracketLoading } =
    trpc.plugin.tournaments.getBracket.useQuery({ tournamentId })

  const { data: participants, isLoading: participantsLoading } =
    trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId, limit: 200 })

  const { data: matchRows, isLoading: matchesLoading } =
    trpc.plugin.tournaments.getMatches.useQuery({
      tournamentId,
      status: statusFilter === "all" ? undefined : (statusFilter as (typeof MATCH_STATUSES)[number]),
      limit: 200,
    })

  const participantMap = useMemo(() => {
    const map = new Map<
      string,
      { id: string; participantName: string; participantImage: string | null; seed: number | null }
    >()
    if (participants) {
      for (const p of participants as Array<{
        id: string
        participantName: string
        participantImage: string | null
        seed: number | null
      }>) {
        map.set(p.id, p)
      }
    }
    return map
  }, [participants])

  const matchEntries = (bracket?.matchEntries ?? []) as Array<{
    id: string
    matchId: string
    entryId: string
    slot: number
    result: string | null
    score: unknown
  }>

  const isLoading = bracketLoading || participantsLoading || matchesLoading

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const matches = (matchRows ?? []) as Array<{
    id: string
    matchNumber: number
    status: string
    scores: unknown
    winnerEntryId: string | null
    roundId: string
    version: number
  }>

  const reportMatch = reportMatchId
    ? matches.find((m) => m.id === reportMatchId)
    : null

  const forfeitMatch = forfeitMatchId
    ? matches.find((m) => m.id === forfeitMatchId)
    : null

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-popover">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {MATCH_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {matchStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {matches.length} match{matches.length !== 1 ? "es" : ""}
        </span>
      </div>

      {/* Match list */}
      {matches.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              matchEntries={matchEntries.filter(
                (me) => me.matchId === match.id
              )}
              participantMap={participantMap}
              isAdmin={isAdmin}
              onReportScore={() => setReportMatchId(match.id)}
              onForfeit={() => setForfeitMatchId(match.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">No matches found.</p>
        </div>
      )}

      {/* Report score dialog */}
      {reportMatch && (
        <ReportScoreDialog
          open={!!reportMatchId}
          onOpenChange={(open) => !open && setReportMatchId(null)}
          tournamentId={tournamentId}
          match={reportMatch}
          matchEntries={matchEntries.filter(
            (me) => me.matchId === reportMatch.id
          )}
          participantMap={participantMap}
        />
      )}

      {/* Forfeit dialog */}
      {forfeitMatch && (
        <ForfeitDialog
          open={!!forfeitMatchId}
          onOpenChange={(open) => !open && setForfeitMatchId(null)}
          tournamentId={tournamentId}
          match={forfeitMatch}
          matchEntries={matchEntries.filter(
            (me) => me.matchId === forfeitMatch.id
          )}
          participantMap={participantMap}
        />
      )}
    </div>
  )
}

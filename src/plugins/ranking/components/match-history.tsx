import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { getDomain } from "@/plugins/ranking/domains"
import { MatchCard } from "./match-card"

export type MatchData = {
  id: string
  matchFormat: string
  team1: unknown
  team2: unknown
  scores: unknown
  winner: unknown
  derivedStats: unknown
  notes: string | null
  createdAt: string | Date
  recordedByName: string
}

type MatchHistoryProps = {
  rankingDefinitionId: string
  domainId: string
  sessionId?: string
  playerNames: Record<string, string>
  isAdmin?: boolean
  editingMatchId?: string
  onCorrectMatch?: (match: MatchData) => void
}

export function MatchHistory({
  rankingDefinitionId,
  domainId,
  sessionId,
  playerNames,
  isAdmin,
  editingMatchId,
  onCorrectMatch,
}: MatchHistoryProps) {
  const domain = getDomain(domainId)
  const MatchDisplay = domain?.matchConfig?.MatchDisplay

  const { data: matches, isLoading } = sessionId
    ? trpc.plugin.ranking.listMatchesBySession.useQuery({
        rankingDefinitionId,
        sessionId,
      })
    : trpc.plugin.ranking.listMatchesByDefinition.useQuery({
        rankingDefinitionId,
        limit: 20,
      })

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!matches || matches.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        No matches recorded yet
      </p>
    )
  }

  if (!MatchDisplay) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Match display not available for this domain
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {matches.map((match) => {
        const team1Ids = match.team1 as string[]
        const team2Ids = match.team2 as string[]
        const team1Names = team1Ids.map((id) => playerNames[id] ?? "Unknown")
        const team2Names = team2Ids.map((id) => playerNames[id] ?? "Unknown")

        return (
          <MatchCard
            key={match.id}
            match={match as MatchData}
            team1Names={team1Names}
            team2Names={team2Names}
            MatchDisplay={MatchDisplay}
            isAdmin={isAdmin}
            isEditing={editingMatchId === match.id}
            onCorrect={
              onCorrectMatch
                ? () => onCorrectMatch(match as MatchData)
                : undefined
            }
          />
        )
      })}
    </div>
  )
}

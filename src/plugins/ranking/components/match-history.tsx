import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil } from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"

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
  onCorrectMatch?: (match: MatchData) => void
}

export function MatchHistory({
  rankingDefinitionId,
  domainId,
  sessionId,
  playerNames,
  isAdmin,
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
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
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
    <div className="space-y-1.5">
      {matches.map((match) => {
        const team1Ids = match.team1 as string[]
        const team2Ids = match.team2 as string[]
        const team1Names = team1Ids.map((id) => playerNames[id] ?? "Unknown")
        const team2Names = team2Ids.map((id) => playerNames[id] ?? "Unknown")

        return (
          <div
            key={match.id}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-3 py-2"
          >
            <MatchDisplay
              scores={match.scores}
              winner={match.winner as "team1" | "team2" | "draw"}
              team1Names={team1Names}
              team2Names={team2Names}
            />
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <span className="text-[10px] text-muted-foreground">
                {new Date(match.createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
              {isAdmin && onCorrectMatch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => onCorrectMatch(match as MatchData)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

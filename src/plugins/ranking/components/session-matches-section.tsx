import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Swords } from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"
import { MatchRecordingDialog } from "./match-recording-dialog"
import { MatchHistory, type MatchData } from "./match-history"

type SessionMatchesSectionProps = {
  activityId: string
  sessionId: string
  isAdmin: boolean
  participants: Array<{
    userId: string
    name: string | null
    image: string | null
  }>
}

export function SessionMatchesSection({
  activityId,
  sessionId,
  isAdmin,
  participants,
}: SessionMatchesSectionProps) {
  const [showRecordDialog, setShowRecordDialog] = useState(false)
  const [correctingMatch, setCorrectingMatch] = useState<MatchData | null>(null)

  const { data: definition, isLoading } =
    trpc.plugin.ranking.getByActivity.useQuery({ activityId })

  const { data: matches } =
    trpc.plugin.ranking.listMatchesBySession.useQuery(
      {
        rankingDefinitionId: definition?.id ?? "",
        sessionId,
      },
      { enabled: !!definition?.id }
    )

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    )
  }

  if (!definition) return null

  const domain = getDomain(definition.domainId)
  if (!domain?.matchConfig) return null

  const matchCount = matches?.length ?? 0

  const availablePlayers = participants.map((p) => ({
    userId: p.userId,
    name: p.name ?? "Unknown",
    image: p.image,
  }))

  const playerNames = Object.fromEntries(
    participants.map((p) => [p.userId, p.name ?? "Unknown"])
  )

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Matches</h3>
          {matchCount > 0 && (
            <Badge variant="secondary" className="text-xs tabular-nums">
              {matchCount}
            </Badge>
          )}
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRecordDialog(true)}
          >
            <Swords className="h-3.5 w-3.5 mr-1.5" />
            Record Match
          </Button>
        )}
      </div>

      {definition.id && (
        <MatchHistory
          rankingDefinitionId={definition.id}
          domainId={definition.domainId}
          sessionId={sessionId}
          playerNames={playerNames}
          isAdmin={isAdmin}
          onCorrectMatch={(match) => setCorrectingMatch(match)}
        />
      )}

      {(showRecordDialog || correctingMatch) && (
        <MatchRecordingDialog
          rankingDefinitionId={definition.id}
          domainId={definition.domainId}
          activityId={activityId}
          sessionId={sessionId}
          availablePlayers={availablePlayers}
          open={showRecordDialog || !!correctingMatch}
          onOpenChange={(open) => {
            if (!open) {
              setShowRecordDialog(false)
              setCorrectingMatch(null)
            }
          }}
          editingMatch={correctingMatch}
        />
      )}
    </div>
  )
}

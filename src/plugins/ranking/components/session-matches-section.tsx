import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Swords } from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"
import { MatchInlineForm } from "./match-inline-form"
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
  const [formMode, setFormMode] = useState<"hidden" | "create" | "correct">("hidden")
  const [editingMatch, setEditingMatch] = useState<MatchData | null>(null)

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

  const showForm = formMode !== "hidden"

  function closeForm() {
    setFormMode("hidden")
    setEditingMatch(null)
  }

  function handleCorrectMatch(match: MatchData) {
    setEditingMatch(match)
    setFormMode("correct")
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <Swords className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Matches</h3>
          {matchCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              ({matchCount})
            </span>
          )}
        </div>
        {isAdmin && !showForm && (
          <Button
            size="sm"
            onClick={() => setFormMode("create")}
            className="h-8 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Record
          </Button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {showForm && (
          <MatchInlineForm
            key={editingMatch?.id ?? "new"}
            rankingDefinitionId={definition.id}
            domainId={definition.domainId}
            sessionId={sessionId}
            availablePlayers={availablePlayers}
            editingMatch={editingMatch}
            onClose={closeForm}
            onSuccess={closeForm}
          />
        )}

        {definition.id && (
          <MatchHistory
            rankingDefinitionId={definition.id}
            domainId={definition.domainId}
            sessionId={sessionId}
            playerNames={playerNames}
            isAdmin={isAdmin}
            editingMatchId={editingMatch?.id}
            onCorrectMatch={handleCorrectMatch}
          />
        )}
      </div>
    </div>
  )
}

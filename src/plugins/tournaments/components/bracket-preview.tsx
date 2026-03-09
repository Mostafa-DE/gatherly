import { trpc } from "@/lib/trpc"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Trophy, AlertCircle } from "lucide-react"
import type { PreviewMatch, PreviewStage, PreviewParticipant } from "../data-access/preview"

type RankingSummary = {
  position: number
  levelName: string | null
  levelColor: string | null
  stats: Record<string, number>
}

type BracketPreviewProps = {
  tournamentId: string
  rankingMap?: Map<string, RankingSummary>
}

export function BracketPreview({ tournamentId, rankingMap }: BracketPreviewProps) {
  const { data, isLoading, error } = trpc.plugin.tournaments.previewBracket.useQuery(
    { tournamentId },
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error.message}
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>{data.totalEntries} participants</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Trophy className="h-4 w-4" />
          <span>{data.totalRounds} rounds</span>
        </div>
        {data.byeCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {data.byeCount} {data.byeCount === 1 ? "bye" : "byes"}
          </Badge>
        )}
      </div>

      {/* Stages */}
      {data.stages.map((stage, stageIndex) => (
        <PreviewStageSection
          key={stageIndex}
          stage={stage}
          showStageLabel={data.stages.length > 1}
          rankingMap={rankingMap}
        />
      ))}
    </div>
  )
}

function PreviewStageSection({
  stage,
  showStageLabel,
  rankingMap,
}: {
  stage: PreviewStage
  showStageLabel: boolean
  rankingMap?: Map<string, RankingSummary>
}) {
  const stageLabel = formatStageType(stage.stageType)

  return (
    <div className="space-y-4">
      {showStageLabel && (
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {stageLabel}
        </h4>
      )}

      {stage.rounds
        .filter((round) => round.roundNumber === 1)
        .map((round, roundIndex) => {
          const group = round.groupIndex !== undefined && stage.groups
            ? stage.groups.find((g) => g.groupOrder === round.groupIndex)
            : null

          return (
            <div key={roundIndex} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Round 1</h3>
                {group && (
                  <span className="text-xs text-muted-foreground">
                    {group.name}
                  </span>
                )}
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {round.matches.map((match) => (
                  <PreviewMatchCard key={match.matchNumber} match={match} rankingMap={rankingMap} />
                ))}
              </div>
            </div>
          )
        })}
    </div>
  )
}

function PreviewMatchCard({
  match,
  rankingMap,
}: {
  match: PreviewMatch
  rankingMap?: Map<string, RankingSummary>
}) {
  const p1 = match.participants.find((p) => p.slot === 1)
  const p2 = match.participants.find((p) => p.slot === 2)

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground">
          Match {match.matchNumber}
        </span>
        {match.isBye && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            BYE
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">
        <ParticipantSlot participant={p1} rankingMap={rankingMap} />
        <div className="text-[10px] text-center text-muted-foreground">vs</div>
        <ParticipantSlot participant={p2} rankingMap={rankingMap} />
      </div>
    </div>
  )
}

function ParticipantSlot({
  participant,
  rankingMap,
}: {
  participant: PreviewParticipant | undefined
  rankingMap?: Map<string, RankingSummary>
}) {
  if (!participant || !participant.entryId) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
        <span className="text-xs text-muted-foreground italic">TBD</span>
      </div>
    )
  }

  const rank = participant.userId && rankingMap
    ? rankingMap.get(participant.userId)
    : undefined

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2.5 py-1.5">
      {participant.seed != null && (
        <span className="text-[10px] font-mono font-bold text-muted-foreground shrink-0">
          #{participant.seed}
        </span>
      )}
      <span className="text-xs font-medium truncate flex-1">{participant.name ?? "Unknown"}</span>
      {rank?.levelName && (
        <Badge
          className="border-0 text-[10px] px-1.5 py-0 shrink-0"
          style={{
            backgroundColor: rank.levelColor ? `${rank.levelColor}20` : undefined,
            color: rank.levelColor ?? undefined,
          }}
        >
          {rank.levelName}
        </Badge>
      )}
    </div>
  )
}

function formatStageType(stageType: string): string {
  return stageType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

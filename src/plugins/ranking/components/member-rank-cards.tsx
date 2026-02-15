import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Trophy, BarChart3 } from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"

type MemberRankCardsProps = {
  userId: string
}

export function MemberRankCards({ userId }: MemberRankCardsProps) {
  const { data: ranks, isLoading } =
    trpc.plugin.ranking.getMemberRanksByUser.useQuery({ userId })

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-1">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-lg" />
        </div>
      </div>
    )
  }

  if (!ranks || ranks.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Rankings</h2>
          <p className="text-sm text-muted-foreground">
            Rank and stats across activities
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {ranks.map((rank) => (
          <RankCard key={rank.id} rank={rank} />
        ))}
      </div>
    </div>
  )
}

type RankData = {
  id: string
  definitionName: string
  domainId: string
  activityId: string
  stats: unknown
  levelName: string | null
  levelColor: string | null
  levelOrder: number | null
  lastActivityAt: Date | null
}

function RankCard({ rank }: { rank: RankData }) {
  const domain = getDomain(rank.domainId)
  const stats = (rank.stats as Record<string, number>) ?? {}
  const statFields = domain?.statFields ?? []

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{rank.definitionName}</span>
          {domain && (
            <span className="text-xs text-muted-foreground">
              {domain.name}
            </span>
          )}
        </div>
        {rank.levelName && (
          <Badge
            className="border-0 text-xs font-semibold"
            style={{
              backgroundColor: rank.levelColor
                ? `${rank.levelColor}20`
                : undefined,
              color: rank.levelColor ?? undefined,
            }}
          >
            {rank.levelName}
          </Badge>
        )}
        {!rank.levelName && (
          <span className="text-xs text-muted-foreground italic">
            Unranked
          </span>
        )}
      </div>

      {statFields.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {statFields.map((field) => (
            <div key={field.id} className="flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {field.label}:
              </span>
              <span className="text-xs font-medium font-mono">
                {stats[field.id] ?? 0}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

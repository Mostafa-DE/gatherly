import { useMemo, useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ArrowUp, ArrowDown, Shuffle, Save, Eye } from "lucide-react"
import { getDomain } from "@/plugins/ranking/domains"
import { BracketPreview } from "./bracket-preview"

type SeedEntry = {
  entryId: string
  userId: string | null
  seed: number
  participantName: string
  participantImage: string | null
}

type SeedingTabProps = {
  tournamentId: string
  activityId: string
  tournament: {
    version: number
    participantType: string
  }
  isAdmin: boolean
}

type RankingSummary = {
  position: number
  levelName: string | null
  levelColor: string | null
  stats: Record<string, number>
}

export function SeedingTab({
  tournamentId,
  activityId,
  tournament,
  isAdmin,
}: SeedingTabProps) {
  const utils = trpc.useUtils()
  // Local overrides — only set when user manually reorders seeds
  const [localSeeds, setLocalSeeds] = useState<SeedEntry[] | null>(null)
  const [error, setError] = useState("")
  const [includeStats, setIncludeStats] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { data: participants, isLoading } =
    trpc.plugin.tournaments.getParticipants.useQuery({
      tournamentId,
      limit: 200,
    })

  const { data: rankingDefinition } =
    trpc.plugin.ranking.getByActivity.useQuery(
      { activityId },
      { enabled: tournament.participantType === "individual" }
    )

  const { data: leaderboard } =
    trpc.plugin.ranking.getLeaderboard.useQuery(
      {
        rankingDefinitionId: rankingDefinition?.id ?? "",
        includeFormerMembers: false,
      },
      {
        enabled:
          tournament.participantType === "individual" && !!rankingDefinition?.id,
      }
    )

  // Derive seeds from server data — no useEffect, no state sync
  const serverSeeds = useMemo<SeedEntry[]>(() => {
    if (!participants) return []
    const seeds: SeedEntry[] = participants.map(
      (p: {
        id: string
        userId: string | null
        seed: number | null
        participantName: string
        participantImage: string | null
      }, index: number) => ({
        entryId: p.id,
        userId: p.userId,
        seed: p.seed ?? index + 1,
        participantName: p.participantName,
        participantImage: p.participantImage,
      })
    )
    seeds.sort((a, b) => a.seed - b.seed)
    return seeds
  }, [participants])

  // Display seeds: local overrides take priority over server data
  const displaySeeds = localSeeds ?? serverSeeds
  const isDirty = localSeeds !== null
  const allSeeded = displaySeeds.length >= 2 && displaySeeds.every((s) => s.seed != null)

  const invalidateAll = () => {
    utils.plugin.tournaments.getParticipants.invalidate({ tournamentId })
    utils.plugin.tournaments.getById.invalidate({ tournamentId })
    utils.plugin.tournaments.previewBracket.invalidate({ tournamentId })
  }

  const setSeeds = trpc.plugin.tournaments.setSeeds.useMutation({
    onSuccess: () => {
      invalidateAll()
      setLocalSeeds(null)
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  const randomizeSeeds = trpc.plugin.tournaments.randomizeSeeds.useMutation({
    onSuccess: () => {
      invalidateAll()
      setLocalSeeds(null)
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  const seedFromRanking = trpc.plugin.tournaments.seedFromRanking.useMutation({
    onSuccess: () => {
      invalidateAll()
      setLocalSeeds(null)
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  const rankingMap = new Map<string, RankingSummary>()
  if (leaderboard) {
    for (let index = 0; index < leaderboard.length; index++) {
      const entry = leaderboard[index]
      rankingMap.set(entry.userId, {
        position: index + 1,
        levelName: entry.levelName,
        levelColor: entry.levelColor,
        stats: ((entry.stats as Record<string, unknown> | null) ?? {}) as Record<string, number>,
      })
    }
  }

  const rankingDomain = rankingDefinition ? getDomain(rankingDefinition.domainId) : null
  const primaryStatField = rankingDomain?.statFields?.[0] ?? null

  function moveEntry(index: number, direction: "up" | "down") {
    const seeds = [...displaySeeds]
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= seeds.length) return
    const temp = seeds[index]
    seeds[index] = seeds[newIndex]
    seeds[newIndex] = temp
    setLocalSeeds(seeds.map((s, i) => ({ ...s, seed: i + 1 })))
  }

  function setEntrySeed(entryId: string, nextSeed: number) {
    const seeds = [...displaySeeds]
    const currentIndex = seeds.findIndex((entry) => entry.entryId === entryId)
    if (currentIndex === -1) return
    const [moved] = seeds.splice(currentIndex, 1)
    seeds.splice(nextSeed - 1, 0, moved)
    setLocalSeeds(seeds.map((entry, index) => ({ ...entry, seed: index + 1 })))
  }

  function handleSave() {
    if (!localSeeds) return
    setError("")
    setSeeds.mutate({
      tournamentId,
      expectedVersion: tournament.version,
      seeds: localSeeds.map((s) => ({ entryId: s.entryId, seed: s.seed })),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  if (!participants || participants.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {tournament.participantType === "team"
            ? "No registered teams to seed. Go to the Participants tab and click \"Register All Teams\" first."
            : "No participants to seed. Add participants first."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Action buttons */}
      {isAdmin && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {tournament.participantType === "individual" && rankingDefinition && (
              <>
                <Button
                  size="sm"
                  onClick={() =>
                    seedFromRanking.mutate({
                      tournamentId,
                      rankingDefinitionId: rankingDefinition.id,
                      includeStats,
                    })
                  }
                  disabled={seedFromRanking.isPending}
                >
                  {seedFromRanking.isPending ? "Applying Ranking..." : "Seed From Ranking"}
                </Button>
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="include-stats"
                    checked={includeStats}
                    onCheckedChange={setIncludeStats}
                  />
                  <Label htmlFor="include-stats" className="text-xs cursor-pointer">
                    Include stats
                  </Label>
                </div>
              </>
            )}
            {isDirty && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={setSeeds.isPending}
              >
                <Save className="h-3.5 w-3.5 mr-2" />
                {setSeeds.isPending ? "Saving..." : "Save Seeds"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => randomizeSeeds.mutate({ tournamentId })}
              disabled={randomizeSeeds.isPending}
            >
              <Shuffle className="h-3.5 w-3.5 mr-2" />
              {randomizeSeeds.isPending ? "Randomizing..." : "Randomize"}
            </Button>
            {allSeeded && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="h-3.5 w-3.5 mr-2" />
                {showPreview ? "Hide Preview" : "Preview Bracket"}
              </Button>
            )}
            {tournament.participantType === "individual" && !rankingDefinition && (
              <span className="text-xs text-muted-foreground">
                No activity ranking is configured yet.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Bracket Preview */}
      {showPreview && allSeeded && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4">
          <BracketPreview tournamentId={tournamentId} rankingMap={rankingMap} />
        </div>
      )}

      {/* Seed list */}
      <div className="space-y-1.5">
        {displaySeeds.map((entry, index) => (
          <div
            key={entry.entryId}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2.5"
          >
            <div className="w-20 shrink-0">
              {isAdmin ? (
                <Select
                  value={String(entry.seed)}
                  onValueChange={(value) => setEntrySeed(entry.entryId, Number(value))}
                >
                  <SelectTrigger className="h-8 bg-background font-mono text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {displaySeeds.map((seedOption) => (
                      <SelectItem
                        key={seedOption.entryId}
                        value={String(seedOption.seed)}
                        className="font-mono"
                      >
                        #{seedOption.seed}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="block text-center font-mono text-sm font-bold text-muted-foreground">
                  #{entry.seed}
                </span>
              )}
            </div>
            <Avatar className="h-8 w-8">
              <AvatarImage src={entry.participantImage ?? undefined} />
              <AvatarFallback className="text-xs">
                {entry.participantName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.participantName}</p>
              {tournament.participantType === "individual" && (
                <p className="truncate text-xs text-muted-foreground">
                  {formatRankingMetadata(
                    rankingDefinition?.name,
                    rankingMap.get(entry.userId ?? "")
                      ? {
                          position: rankingMap.get(entry.userId ?? "")!.position,
                          statLabel: primaryStatField?.label ?? null,
                          statValue:
                            primaryStatField && entry.userId
                              ? rankingMap.get(entry.userId)?.stats[primaryStatField.id] ?? 0
                              : null,
                        }
                      : null
                  )}
                </p>
              )}
            </div>
            {tournament.participantType === "individual" && (
              <div className="shrink-0">
                {renderRankBadge(rankingMap.get(entry.userId ?? ""))}
              </div>
            )}
            {isAdmin && (
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveEntry(index, "up")}
                  disabled={index === 0}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => moveEntry(index, "down")}
                  disabled={index === displaySeeds.length - 1}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}

function formatRankingMetadata(
  rankingName: string | undefined,
  rank: {
    position: number
    statLabel: string | null
    statValue: number | null
  } | null
) {
  if (!rankingName) return "No ranking configured"
  if (!rank) return `${rankingName} - Unranked`

  const parts = [`${rankingName}`, `Rank #${rank.position}`]
  if (rank.statLabel && rank.statValue !== null) {
    parts.push(`${rank.statLabel}: ${rank.statValue}`)
  }

  return parts.join(" | ")
}

function renderRankBadge(rank: RankingSummary | undefined) {
  if (!rank?.levelName) {
    return <span className="text-xs text-muted-foreground italic">Unranked</span>
  }

  return (
    <Badge
      className="border-0 text-xs font-semibold"
      style={{
        backgroundColor: rank.levelColor ? `${rank.levelColor}20` : undefined,
        color: rank.levelColor ?? undefined,
      }}
    >
      {rank.levelName}
    </Badge>
  )
}

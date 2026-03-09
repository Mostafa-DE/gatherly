import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type StandingsTabProps = {
  tournamentId: string
}

export function StandingsTab({ tournamentId }: StandingsTabProps) {
  const [selectedStageId, setSelectedStageId] = useState<string>("")
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")

  const { data: bracket, isLoading: bracketLoading } =
    trpc.plugin.tournaments.getBracket.useQuery({ tournamentId })

  const { data: participants, isLoading: participantsLoading } =
    trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId, limit: 200 })

  const stages = (bracket?.stages ?? []) as Array<{
    id: string
    stageOrder: number
    stageType: string
    status: string
  }>
  const groups = (bracket?.groups ?? []) as Array<{
    id: string
    stageId: string
    name: string
    groupOrder: number
  }>

  // Auto-select first stage
  const activeStageId = selectedStageId || stages[0]?.id || ""
  const stageGroups = groups.filter((g) => g.stageId === activeStageId)

  const { data: standings, isLoading: standingsLoading } =
    trpc.plugin.tournaments.getStandings.useQuery(
      {
        tournamentId,
        stageId: activeStageId || undefined,
        groupId: selectedGroupId || undefined,
      },
      { enabled: !!activeStageId }
    )

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

  const isLoading = bracketLoading || participantsLoading || standingsLoading

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    )
  }

  const standingRows = (standings ?? []) as Array<{
    id: string
    entryId: string
    rank: number
    wins: number
    losses: number
    draws: number
    points: number
    tiebreakers: unknown
    groupId: string | null
  }>

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        {stages.length > 1 && (
          <Select
            value={activeStageId}
            onValueChange={(v) => {
              setSelectedStageId(v)
              setSelectedGroupId("")
            }}
          >
            <SelectTrigger className="w-40 bg-popover">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Stage {s.stageOrder} ({s.stageType})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {stageGroups.length > 0 && (
          <Select
            value={selectedGroupId || "all"}
            onValueChange={(v) => setSelectedGroupId(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-40 bg-popover">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {stageGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Standings table */}
      {standingRows.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left font-medium w-10">#</th>
                <th className="px-3 py-2.5 text-left font-medium">Participant</th>
                <th className="px-3 py-2.5 text-center font-medium font-mono w-12">W</th>
                <th className="px-3 py-2.5 text-center font-medium font-mono w-12">L</th>
                <th className="px-3 py-2.5 text-center font-medium font-mono w-12">D</th>
                <th className="px-3 py-2.5 text-center font-medium font-mono w-14">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standingRows.map((row) => {
                const participant = participantMap.get(row.entryId)
                return (
                  <tr
                    key={row.id}
                    className="border-b border-border/30 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-muted-foreground">
                      {row.rank}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage
                            src={participant?.participantImage ?? undefined}
                          />
                          <AvatarFallback className="text-[10px]">
                            {(
                              participant?.participantName ?? "?"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium truncate">
                          {participant?.participantName ?? "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      {row.wins}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      {row.losses}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">
                      {row.draws}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-medium">
                      {row.points}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No standings data available.
          </p>
        </div>
      )}
    </div>
  )
}

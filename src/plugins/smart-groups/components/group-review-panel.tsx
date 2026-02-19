import { useState, useMemo, useEffect, useCallback } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { AlertTriangle, Check, ChevronDown, GripVertical, RefreshCw } from "lucide-react"
import type { SmartGroupProposal, SmartGroupEntry, SmartGroupRun } from "@/db/types"
import type { Criteria } from "../schemas"
import type { GroupEntry } from "../algorithm"
import {
  computeBalanceMetrics,
  computeClusterMetrics,
  type GroupMetrics,
  type BalanceMetrics,
  type ClusterMetrics,
} from "../metrics"

type GroupReviewPanelProps = {
  run: SmartGroupRun
  proposals: SmartGroupProposal[]
  entries: SmartGroupEntry[]
  isAdmin: boolean
  onRegenerate?: () => void
  warnings?: string[]
}

type UserInfo = {
  userId: string
  userName: string | null
  userImage: string | null
}

export function GroupReviewPanel({
  run,
  proposals,
  entries,
  isAdmin,
  onRegenerate,
  warnings,
}: GroupReviewPanelProps) {
  const utils = trpc.useUtils()
  const isConfirmed = run.status === "confirmed"
  const canDrag = isAdmin && !isConfirmed

  // Build user info map from entries
  const userInfoMap = useMemo(() => {
    const map = new Map<string, UserInfo>()
    for (const entry of entries) {
      const snapshot = entry.dataSnapshot as Record<string, unknown> | null
      map.set(entry.userId, {
        userId: entry.userId,
        userName: (snapshot as Record<string, unknown> & { _userName?: string })?._userName ?? null,
        userImage: null,
      })
    }
    return map
  }, [entries])

  // Build proposalVersions map for optimistic updates
  const proposalMap = useMemo(
    () => new Map(proposals.map((p) => [p.id, p])),
    [proposals]
  )

  const confirmRun = trpc.plugin.smartGroups.confirmRun.useMutation({
    onSuccess: () => {
      utils.plugin.smartGroups.getRunBySession.invalidate()
      utils.plugin.smartGroups.getRunDetails.invalidate()
      utils.plugin.smartGroups.getRunsByActivity.invalidate()
    },
  })

  const criteriaSnapshot = run.criteriaSnapshot as Criteria | null

  // =========================================================================
  // Lifted member assignments state
  // =========================================================================

  // Map<proposalId, memberUserIds[]>
  const [memberAssignments, setMemberAssignments] = useState<Map<string, string[]>>(() => {
    const map = new Map<string, string[]>()
    for (const p of proposals) {
      const ids = (p.modifiedMemberIds ?? p.memberIds) as string[]
      map.set(p.id, [...ids])
    }
    return map
  })

  // Resync from server props when proposals change
  useEffect(() => {
    const map = new Map<string, string[]>()
    for (const p of proposals) {
      const ids = (p.modifiedMemberIds ?? p.memberIds) as string[]
      map.set(p.id, [...ids])
    }
    setMemberAssignments(map)
  }, [proposals])

  // =========================================================================
  // Compute metrics from current assignments
  // =========================================================================

  const groupEntries: GroupEntry[] = useMemo(
    () =>
      entries.map((e) => ({
        userId: e.userId,
        data: (e.dataSnapshot as Record<string, unknown>) ?? {},
      })),
    [entries]
  )

  const currentGroups = useMemo(
    () =>
      proposals.map((p) => ({
        groupName: p.groupName,
        memberIds: memberAssignments.get(p.id) ?? [],
      })),
    [proposals, memberAssignments]
  )

  const metrics: GroupMetrics = useMemo(() => {
    if (!criteriaSnapshot) return null
    if (criteriaSnapshot.mode === "split") return null

    if (criteriaSnapshot.mode === "balanced") {
      return computeBalanceMetrics(currentGroups, groupEntries, criteriaSnapshot)
    }

    return computeClusterMetrics(currentGroups, groupEntries, criteriaSnapshot)
  }, [criteriaSnapshot, currentGroups, groupEntries])

  // Compute excluded members (entries not in any proposal)
  const excludedMembers = useMemo(() => {
    const allProposalMemberIds = new Set<string>()
    for (const p of proposals) {
      const ids = (p.modifiedMemberIds ?? p.memberIds) as string[]
      for (const id of ids) allProposalMemberIds.add(id)
    }
    return entries
      .filter((e) => !allProposalMemberIds.has(e.userId))
      .map((e) => {
        const snapshot = e.dataSnapshot as Record<string, unknown> | null
        return {
          userId: e.userId,
          userName: (snapshot as Record<string, unknown> & { _userName?: string })?._userName ?? null,
        }
      })
  }, [entries, proposals])

  // Extract criteria field sourceIds for display on member cards
  const criteriaFieldIds = useMemo(() => {
    if (!criteriaSnapshot) return []
    const ids: string[] = []
    if (criteriaSnapshot.mode === "balanced") {
      for (const f of criteriaSnapshot.balanceFields) ids.push(f.sourceId)
      if (criteriaSnapshot.partitionFields) {
        for (const f of criteriaSnapshot.partitionFields) ids.push(f)
      }
    } else {
      for (const f of criteriaSnapshot.fields) ids.push(f.sourceId)
    }
    return ids
  }, [criteriaSnapshot])

  // Build per-user data snapshot map for member card stats
  const userDataMap = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    for (const entry of entries) {
      const snapshot = entry.dataSnapshot as Record<string, unknown> | null
      if (snapshot) map.set(entry.userId, snapshot)
    }
    return map
  }, [entries])

  // Per-group metric lookup
  const perGroupMetricMap = useMemo(() => {
    if (!metrics) return null
    const map = new Map<string, (typeof metrics.perGroup)[number]>()
    for (const pg of metrics.perGroup) {
      map.set(pg.groupName, pg)
    }
    return map
  }, [metrics])

  // =========================================================================
  // Drag and drop
  // =========================================================================

  const [activeDragUserId, setActiveDragUserId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const updateProposal = trpc.plugin.smartGroups.updateProposal.useMutation({
    onSuccess: () => {
      utils.plugin.smartGroups.getRunBySession.invalidate()
      utils.plugin.smartGroups.getRunDetails.invalidate()
    },
  })

  function handleDragStart(event: DragStartEvent) {
    const userId = event.active.data.current?.userId as string | undefined
    setActiveDragUserId(userId ?? null)
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragUserId(null)

      const { active, over } = event
      if (!over) return

      const sourceProposalId = active.data.current?.sourceProposalId as string
      const userId = active.data.current?.userId as string
      const targetProposalId = (over.id as string).replace("group-", "")

      if (sourceProposalId === targetProposalId) return

      // Guard: don't empty a group
      const sourceMembers = memberAssignments.get(sourceProposalId)
      if (!sourceMembers || sourceMembers.length <= 1) return

      const targetMembers = memberAssignments.get(targetProposalId)
      if (!targetMembers) return

      // Atomic move: remove from source, add to target
      const newSource = sourceMembers.filter((id) => id !== userId)
      const newTarget = [...targetMembers, userId]

      setMemberAssignments((prev) => {
        const next = new Map(prev)
        next.set(sourceProposalId, newSource)
        next.set(targetProposalId, newTarget)
        return next
      })

      // Fire both mutations concurrently
      const sourceProposal = proposalMap.get(sourceProposalId)
      const targetProposal = proposalMap.get(targetProposalId)
      if (sourceProposal && targetProposal) {
        updateProposal.mutate({
          proposalId: sourceProposalId,
          modifiedMemberIds: newSource,
          expectedVersion: sourceProposal.version,
        })
        updateProposal.mutate({
          proposalId: targetProposalId,
          modifiedMemberIds: newTarget,
          expectedVersion: targetProposal.version,
        })
      }
    },
    [memberAssignments, proposalMap, updateProposal]
  )

  function handleDragCancel() {
    setActiveDragUserId(null)
  }

  // =========================================================================
  // Render
  // =========================================================================

  const activeDragInfo = activeDragUserId ? userInfoMap.get(activeDragUserId) : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {run.groupCount} groups from {run.entryCount} members
          </span>
          <Badge
            variant={isConfirmed ? "default" : "outline"}
            className="text-xs"
          >
            {isConfirmed ? "Confirmed" : "Draft"}
          </Badge>
        </div>
      </div>

      {/* Skipped field warnings */}
      {warnings && warnings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {warnings.map((warning) => (
            <div
              key={warning}
              className="flex items-center gap-1.5 rounded-md bg-[var(--color-badge-warning-bg)] px-2.5 py-1"
            >
              <AlertTriangle className="h-3 w-3 text-[var(--color-status-warning)] shrink-0" />
              <span className="text-xs text-[var(--color-status-warning)]">{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Excluded members section */}
      {excludedMembers.length > 0 && (
        <ExcludedMembersSection members={excludedMembers} />
      )}

      {/* Metrics Summary Bar */}
      {metrics && <MetricsSummaryBar metrics={metrics} />}

      {/* Group Cards */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const memberIds = memberAssignments.get(proposal.id) ?? []
            const isModified = proposal.modifiedMemberIds !== null ||
              memberIds.join(",") !== ((proposal.memberIds as string[]).join(","))

            return (
              <DroppableProposalCard
                key={proposal.id}
                proposalId={proposal.id}
                groupName={proposal.groupName}
                memberIds={memberIds}
                isModified={isModified}
                userInfoMap={userInfoMap}
                canDrag={canDrag}
                activeDragUserId={activeDragUserId}
                metrics={metrics}
                perGroupMetric={perGroupMetricMap?.get(proposal.groupName) ?? null}
                criteriaFieldIds={criteriaFieldIds}
                userDataMap={userDataMap}
              />
            )
          })}
        </div>

        <DragOverlay>
          {activeDragInfo && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-background p-3 shadow-lg ring-2 ring-primary/20">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={activeDragInfo.userImage ?? undefined} />
                <AvatarFallback className="text-xs">
                  {(activeDragInfo.userName ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">
                {activeDragInfo.userName ?? activeDragInfo.userId.slice(0, 8)}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Actions */}
      {isAdmin && !isConfirmed && (
        <div className="flex items-center gap-2 border-t border-border/50 pt-4">
          <Button
            onClick={() =>
              confirmRun.mutate({ runId: run.id, expectedVersion: run.version })
            }
            disabled={confirmRun.isPending}
          >
            <Check className="h-4 w-4 mr-2" />
            {confirmRun.isPending ? "Confirming..." : "Confirm Groups"}
          </Button>
          {onRegenerate && (
            <Button variant="outline" onClick={onRegenerate}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          )}
        </div>
      )}

      {confirmRun.error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {confirmRun.error.message}
        </div>
      )}

      {updateProposal.error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {updateProposal.error.message}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Metrics Summary Bar
// =============================================================================

function MetricsSummaryBar({ metrics }: { metrics: GroupMetrics }) {
  if (!metrics) return null

  const isBalance = metrics.mode === "balanced"
  const percent = isBalance
    ? (metrics as BalanceMetrics).balancePercent
    : (metrics as ClusterMetrics).qualityPercent

  const label = isBalance
    ? "Balance"
    : metrics.mode === "similarity"
      ? "Cohesion"
      : "Diversity"

  const colorClass =
    percent >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
      : percent >= 50
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"

  return (
    <div className="rounded-lg border border-border/50 bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <Badge className={`tabular-nums ${colorClass}`}>
          {percent}%
        </Badge>
      </div>

      {isBalance && Object.keys((metrics as BalanceMetrics).perFieldBalance).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries((metrics as BalanceMetrics).perFieldBalance).map(
            ([sourceId, fieldPercent]) => {
              const fieldColorClass =
                fieldPercent >= 80
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : fieldPercent >= 50
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              return (
                <div key={sourceId} className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">{humanizeSourceId(sourceId)}</span>
                  <Badge className={`tabular-nums text-xs ${fieldColorClass}`}>
                    {fieldPercent}%
                  </Badge>
                </div>
              )
            }
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Excluded Members Section
// =============================================================================

function ExcludedMembersSection({
  members,
}: {
  members: Array<{ userId: string; userName: string | null }>
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">
          {members.length} {members.length === 1 ? "member was" : "members were"} excluded due to missing data.
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-amber-500/20 pt-2">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-xs">
                  {(m.userName ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">
                {m.userName ?? m.userId.slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Droppable Proposal Card
// =============================================================================

function DroppableProposalCard({
  proposalId,
  groupName,
  memberIds,
  isModified,
  userInfoMap,
  canDrag,
  activeDragUserId,
  metrics,
  perGroupMetric,
  criteriaFieldIds,
  userDataMap,
}: {
  proposalId: string
  groupName: string
  memberIds: string[]
  isModified: boolean
  userInfoMap: Map<string, UserInfo>
  canDrag: boolean
  activeDragUserId: string | null
  metrics: GroupMetrics
  perGroupMetric: BalanceMetrics["perGroup"][number] | ClusterMetrics["perGroup"][number] | null
  criteriaFieldIds: string[]
  userDataMap: Map<string, Record<string, unknown>>
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${proposalId}`,
  })

  const isDropTarget = isOver && activeDragUserId !== null

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-4 transition-colors ${
        isDropTarget
          ? "border-primary bg-[var(--color-primary-highlight)]"
          : "border-border/50 bg-background/50"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <h4 className="font-medium">{groupName}</h4>
        <Badge variant="secondary" className="tabular-nums">
          {memberIds.length}
        </Badge>
        {isModified && (
          <Badge variant="outline" className="text-xs">
            Modified
          </Badge>
        )}
      </div>

      {/* Per-group metrics row */}
      <PerGroupBadge metrics={metrics} perGroupMetric={perGroupMetric} />

      {/* Member grid */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {memberIds.map((userId) => (
          <DraggableMemberCard
            key={userId}
            userId={userId}
            proposalId={proposalId}
            userInfoMap={userInfoMap}
            canDrag={canDrag}
            isDragging={activeDragUserId === userId}
            criteriaFieldIds={criteriaFieldIds}
            userDataMap={userDataMap}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Per-Group Metric Badge
// =============================================================================

function PerGroupBadge({
  metrics,
  perGroupMetric,
}: {
  metrics: GroupMetrics
  perGroupMetric: BalanceMetrics["perGroup"][number] | ClusterMetrics["perGroup"][number] | null
}) {
  if (!metrics || !perGroupMetric) return null

  if (metrics.mode === "balanced") {
    const balanceMetric = perGroupMetric as BalanceMetrics["perGroup"][number]
    const fieldEntries = Object.entries(balanceMetric.fieldAverages)
    return (
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {fieldEntries.map(([sourceId, avg]) => (
          <span
            key={sourceId}
            className="text-sm tabular-nums text-muted-foreground"
          >
            Avg {humanizeSourceId(sourceId)}:{" "}
            <span className="font-medium text-foreground">
              {Number.isInteger(avg) ? avg : avg.toFixed(1)}
            </span>
          </span>
        ))}
      </div>
    )
  }

  const clusterMetric = perGroupMetric as ClusterMetrics["perGroup"][number]
  const label = metrics.mode === "similarity" ? "Cohesion" : "Diversity"
  const percent =
    metrics.mode === "similarity"
      ? Math.round(100 * (1 - clusterMetric.avgIntraDistance))
      : Math.round(100 * clusterMetric.avgIntraDistance)

  return (
    <div className="mt-1.5">
      <span className="text-sm tabular-nums text-muted-foreground">
        {label}:{" "}
        <span className="font-medium text-foreground">{percent}%</span>
      </span>
    </div>
  )
}

// =============================================================================
// Draggable Member Card
// =============================================================================

function DraggableMemberCard({
  userId,
  proposalId,
  userInfoMap,
  canDrag,
  isDragging,
  criteriaFieldIds,
  userDataMap,
}: {
  userId: string
  proposalId: string
  userInfoMap: Map<string, UserInfo>
  canDrag: boolean
  isDragging: boolean
  criteriaFieldIds: string[]
  userDataMap: Map<string, Record<string, unknown>>
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `member-${userId}`,
    data: { userId, sourceProposalId: proposalId },
    disabled: !canDrag,
  })

  const info = userInfoMap.get(userId)
  const data = userDataMap.get(userId)

  // Build stat pills from criteria fields + always include ranking:level if present
  const statPills = useMemo(() => {
    if (!data) return []
    const fieldIds = [...criteriaFieldIds]
    if (!fieldIds.includes("ranking:level") && data["ranking:level"] != null) {
      fieldIds.unshift("ranking:level")
    }
    const pills: Array<{ label: string; value: string }> = []
    for (const sourceId of fieldIds) {
      const val = data[sourceId]
      if (val == null || val === "") continue
      pills.push({
        label: abbreviateLabel(humanizeSourceId(sourceId)),
        value: formatStatValue(val),
      })
    }
    return pills
  }, [data, criteriaFieldIds])

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 ${
        isDragging ? "opacity-30" : ""
      } ${canDrag ? "cursor-grab touch-none hover:bg-muted/60 active:cursor-grabbing" : ""}`}
      {...attributes}
      {...(canDrag ? listeners : {})}
    >
      {canDrag && (
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      )}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={info?.userImage ?? undefined} />
        <AvatarFallback className="text-xs">
          {(info?.userName ?? "?").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {info?.userName ?? userId.slice(0, 8)}
        </span>
        {statPills.length > 0 && (
          <span className="block truncate text-xs text-muted-foreground">
            {statPills.map((p, i) => (
              <span key={p.label}>
                {i > 0 && <span className="mx-1">&middot;</span>}
                {p.label === p.value ? p.value : `${p.value} ${p.label}`}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a sourceId like "ranking:stat:matches_played" or "activity:skill_level"
 * into a human-readable label like "Matches Played" or "Skill Level".
 */
function humanizeSourceId(sourceId: string): string {
  // For ranking:level, return "Level" directly
  if (sourceId === "ranking:level") return "Level"
  // Take the last segment after the last colon
  const parts = sourceId.split(":")
  const raw = parts[parts.length - 1]
  // Convert snake_case / kebab-case to Title Case
  return raw
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Abbreviate common stat labels for compact display on member cards. */
const ABBREVIATIONS: Record<string, string> = {
  "Matches Played": "MP",
  "Match Wins": "MW",
  "Match Losses": "ML",
  "Set Wins": "SW",
  "Set Losses": "SL",
  "Wins": "W",
  "Losses": "L",
  "Draws": "D",
  "Goals": "G",
  "Assists": "A",
  "Points": "Pts",
  "Rating": "Rtg",
  "Games Played": "GP",
  "Games Won": "GW",
  "Games Lost": "GL",
}

function abbreviateLabel(label: string): string {
  return ABBREVIATIONS[label] ?? label
}

/** Format a data snapshot value into a compact display string. */
function formatStatValue(val: unknown): string {
  if (typeof val === "number") return String(val)
  if (typeof val === "string") return val
  if (Array.isArray(val)) return val.join(", ")
  return String(val)
}

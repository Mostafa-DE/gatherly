import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { AlertTriangle, Check, Pencil, RefreshCw } from "lucide-react"
import type { SmartGroupProposal, SmartGroupEntry, SmartGroupRun } from "@/db/types"
import type { Criteria } from "../schemas"

type GroupReviewPanelProps = {
  run: SmartGroupRun
  proposals: SmartGroupProposal[]
  entries: SmartGroupEntry[]
  isAdmin: boolean
  onRegenerate?: () => void
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
}: GroupReviewPanelProps) {
  const utils = trpc.useUtils()
  const isConfirmed = run.status === "confirmed"

  // Build user info map from entries
  const userInfoMap = new Map<string, UserInfo>()
  const entryMap = new Map(entries.map((entry) => [entry.userId, entry]))
  for (const entry of entries) {
    const snapshot = entry.dataSnapshot as Record<string, unknown> | null
    userInfoMap.set(entry.userId, {
      userId: entry.userId,
      userName: (snapshot as Record<string, unknown> & { _userName?: string })?._userName ?? null,
      userImage: null,
    })
  }

  const confirmRun = trpc.plugin.smartGroups.confirmRun.useMutation({
    onSuccess: () => {
      utils.plugin.smartGroups.getRunBySession.invalidate()
      utils.plugin.smartGroups.getRunDetails.invalidate()
      utils.plugin.smartGroups.getRunsByActivity.invalidate()
    },
  })

  const criteriaSnapshot = run.criteriaSnapshot as Criteria | null
  const isBalanced = criteriaSnapshot?.mode === "balanced"
  const balanceField = isBalanced ? criteriaSnapshot.balanceField : null

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

      {/* Excluded members warning */}
      {run.excludedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {run.excludedCount} {run.excludedCount === 1 ? "member was" : "members were"} excluded due to missing data for the selected fields.
          </span>
        </div>
      )}

      {/* Group Cards */}
      <div className="space-y-3">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            entries={entries}
            entryMap={entryMap}
            userInfoMap={userInfoMap}
            isAdmin={isAdmin && !isConfirmed}
            balanceField={balanceField}
          />
        ))}
      </div>

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
    </div>
  )
}

// =============================================================================
// Proposal Card
// =============================================================================

function ProposalCard({
  proposal,
  entries,
  entryMap,
  userInfoMap,
  isAdmin,
  balanceField,
}: {
  proposal: SmartGroupProposal
  entries: SmartGroupEntry[]
  entryMap: Map<string, SmartGroupEntry>
  userInfoMap: Map<string, UserInfo>
  isAdmin: boolean
  balanceField: string | null
}) {
  const effectiveIds = (proposal.modifiedMemberIds ?? proposal.memberIds) as string[]
  const isModified = proposal.modifiedMemberIds !== null

  // Compute average rating for balanced mode
  const avgRating = balanceField
    ? computeGroupAverage(effectiveIds, entryMap, balanceField)
    : null

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">{proposal.groupName}</h4>
          <Badge variant="secondary" className="text-xs tabular-nums">
            {effectiveIds.length}
          </Badge>
          {isModified && (
            <Badge variant="outline" className="text-xs">
              Modified
            </Badge>
          )}
          {avgRating !== null && (
            <span className="text-xs tabular-nums text-muted-foreground">
              avg: {avgRating.toFixed(1)}
            </span>
          )}
        </div>
        {isAdmin && (
          <EditMembersPopover
            proposal={proposal}
            entries={entries}
            effectiveIds={effectiveIds}
            userInfoMap={userInfoMap}
          />
        )}
      </div>

      {/* Member list */}
      <div className="flex flex-wrap gap-2">
        {effectiveIds.map((userId) => {
          const info = userInfoMap.get(userId)
          return (
            <div
              key={userId}
              className="flex items-center gap-1.5 rounded-full bg-muted/50 py-1 px-2.5 text-xs"
            >
              <Avatar className="h-4 w-4">
                <AvatarImage src={info?.userImage ?? undefined} />
                <AvatarFallback className="text-[8px]">
                  {(info?.userName ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-20 truncate">
                {info?.userName ?? userId.slice(0, 8)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Edit Members Popover
// =============================================================================

function EditMembersPopover({
  proposal,
  entries,
  effectiveIds,
  userInfoMap,
}: {
  proposal: SmartGroupProposal
  entries: SmartGroupEntry[]
  effectiveIds: string[]
  userInfoMap: Map<string, UserInfo>
}) {
  const utils = trpc.useUtils()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set(effectiveIds))

  const updateProposal = trpc.plugin.smartGroups.updateProposal.useMutation({
    onSuccess: () => {
      utils.plugin.smartGroups.getRunBySession.invalidate()
      utils.plugin.smartGroups.getRunDetails.invalidate()
      setOpen(false)
    },
  })

  function handleSave() {
    updateProposal.mutate({
      proposalId: proposal.id,
      modifiedMemberIds: [...selected],
      expectedVersion: proposal.version,
    })
  }

  // All entry user IDs for this run
  const allUserIds = entries.map((e) => e.userId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          <Pencil className="h-3 w-3 mr-1" />
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <p className="mb-2 text-xs font-medium">
          Select members for &quot;{proposal.groupName}&quot;
        </p>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {allUserIds.map((userId) => {
            const info = userInfoMap.get(userId)
            const checked = selected.has(userId)
            return (
              <label
                key={userId}
                className="flex items-center gap-2 rounded p-1.5 hover:bg-muted/50 cursor-pointer text-sm"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(val) => {
                    const next = new Set(selected)
                    if (val) next.add(userId)
                    else next.delete(userId)
                    setSelected(next)
                  }}
                />
                <span className="truncate">
                  {info?.userName ?? userId.slice(0, 8)}
                </span>
              </label>
            )
          })}
        </div>
        {updateProposal.error && (
          <p className="mt-2 text-xs text-destructive">{updateProposal.error.message}</p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateProposal.isPending}>
            {updateProposal.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// =============================================================================
// Helpers
// =============================================================================

function computeGroupAverage(
  memberIds: string[],
  entryMap: Map<string, SmartGroupEntry>,
  balanceField: string
): number | null {
  if (memberIds.length === 0) return null

  let sum = 0
  let count = 0

  for (const userId of memberIds) {
    const entry = entryMap.get(userId)
    if (!entry) continue
    const snapshot = entry.dataSnapshot as Record<string, unknown> | null
    const val = snapshot?.[balanceField]
    if (typeof val === "number") {
      sum += val
      count++
    }
  }

  if (count === 0) return null
  return sum / count
}

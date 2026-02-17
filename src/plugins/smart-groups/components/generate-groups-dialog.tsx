import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  LayoutGrid,
  Users,
  Shuffle,
  Scale,
  AlertTriangle,
} from "lucide-react"
import type { Criteria } from "../schemas"

type GenerateGroupsDialogProps = {
  configId: string
  activityId: string
  scope: "session" | "activity"
  sessionId?: string
  participantCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type Mode = "split" | "similarity" | "diversity" | "balanced"

type WeightedFieldState = {
  sourceId: string
  weight: number
}

const modeConfig = [
  {
    mode: "split" as const,
    label: "Split by Value",
    icon: LayoutGrid,
    description: "Group by exact field values",
  },
  {
    mode: "similarity" as const,
    label: "Group Similar",
    icon: Users,
    description: "Group similar people together",
  },
  {
    mode: "diversity" as const,
    label: "Mix Different",
    icon: Shuffle,
    description: "Mix different people together",
  },
  {
    mode: "balanced" as const,
    label: "Balanced Teams",
    icon: Scale,
    description: "Balance teams by a stat",
  },
]

const sourceLabels: Record<string, string> = {
  org: "Org Fields",
  activity: "Activity Fields",
  session: "Session Fields",
  ranking: "Ranking",
}

export function GenerateGroupsDialog({
  configId,
  activityId,
  scope,
  sessionId,
  participantCount,
  open,
  onOpenChange,
  onSuccess,
}: GenerateGroupsDialogProps) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [error, setError] = useState("")

  // Split mode state
  const [splitFields, setSplitFields] = useState<string[]>([])

  // Similarity/Diversity mode state
  const [clusterFields, setClusterFields] = useState<WeightedFieldState[]>([])
  const [groupCount, setGroupCount] = useState(() =>
    Math.max(2, Math.ceil(participantCount / 4))
  )

  // Balanced mode state
  const [balanceField, setBalanceField] = useState<string>("")
  const [teamCount, setTeamCount] = useState(() =>
    Math.max(2, Math.ceil(participantCount / 4))
  )

  const { data: fields, isLoading } = trpc.plugin.smartGroups.getAvailableFields.useQuery(
    { activityId, sessionId },
    { enabled: open }
  )

  const generateGroups = trpc.plugin.smartGroups.generateGroups.useMutation({
    onSuccess: () => {
      resetState()
      onSuccess()
      onOpenChange(false)
    },
    onError: (err) => setError(err.message),
  })

  function resetState() {
    setError("")
    setMode(null)
    setSplitFields([])
    setClusterFields([])
    setGroupCount(Math.max(2, Math.ceil(participantCount / 4)))
    setBalanceField("")
    setTeamCount(Math.max(2, Math.ceil(participantCount / 4)))
  }

  // Split mode helpers
  function toggleSplitField(sourceId: string) {
    setSplitFields((prev) => {
      if (prev.includes(sourceId)) return prev.filter((id) => id !== sourceId)
      if (prev.length >= 2) return prev
      return [...prev, sourceId]
    })
  }

  // Cluster mode helpers
  function toggleClusterField(sourceId: string) {
    setClusterFields((prev) => {
      if (prev.some((f) => f.sourceId === sourceId)) {
        return prev.filter((f) => f.sourceId !== sourceId)
      }
      if (prev.length >= 10) return prev
      return [...prev, { sourceId, weight: 1 }]
    })
  }

  function setFieldWeight(sourceId: string, weight: number) {
    setClusterFields((prev) =>
      prev.map((f) => (f.sourceId === sourceId ? { ...f, weight } : f))
    )
  }

  // Build criteria from current state
  function buildCriteria(): Criteria | null {
    if (!mode) return null

    if (mode === "split") {
      if (splitFields.length === 0) return null
      return {
        mode: "split",
        fields: splitFields.map((sourceId) => ({ sourceId, strategy: "split" as const })),
      }
    }

    if (mode === "similarity" || mode === "diversity") {
      if (clusterFields.length === 0) return null
      return {
        mode,
        fields: clusterFields.map((f) => ({ sourceId: f.sourceId, weight: f.weight })),
        groupCount,
      }
    }

    if (mode === "balanced") {
      if (!balanceField) return null
      return {
        mode: "balanced",
        balanceField,
        teamCount,
      }
    }

    return null
  }

  function handleGenerate() {
    const criteria = buildCriteria()
    if (!criteria) return
    setError("")
    generateGroups.mutate({
      configId,
      scope,
      sessionId,
      criteriaOverride: criteria,
    })
  }

  const criteria = buildCriteria()
  const canGenerate = criteria !== null

  // Group fields by source
  const groupedFields = new Map<string, NonNullable<typeof fields>>()
  if (fields) {
    for (const field of fields) {
      const group = groupedFields.get(field.source) ?? []
      group.push(field)
      groupedFields.set(field.source, group)
    }
  }

  // Numeric fields only (for balanced mode)
  const numericFields = fields?.filter(
    (f) => f.type === "ranking_stat" || f.type === "number"
  ) ?? []

  const memberLabel = scope === "session" ? "participants" : "members"

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Generate Groups
          </DialogTitle>
          <DialogDescription>
            Choose a grouping strategy for {participantCount} {memberLabel}.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-2">
          {modeConfig.map((m) => {
            const Icon = m.icon
            const isSelected = mode === m.mode
            return (
              <button
                key={m.mode}
                type="button"
                onClick={() => setMode(m.mode)}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border/50 bg-background/50 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                    {m.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{m.description}</span>
              </button>
            )
          })}
        </div>

        {/* Mode-specific config */}
        {mode && (
          <div className="max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading available fields...
              </div>
            ) : !fields || fields.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No form fields available. Add fields to your join forms first.
              </div>
            ) : mode === "split" ? (
              <SplitConfig
                groupedFields={groupedFields}
                selectedFields={splitFields}
                onToggle={toggleSplitField}
              />
            ) : mode === "similarity" || mode === "diversity" ? (
              <ClusterConfig
                groupedFields={groupedFields}
                selectedFields={clusterFields}
                onToggle={toggleClusterField}
                onWeightChange={setFieldWeight}
                groupCount={groupCount}
                onGroupCountChange={setGroupCount}
                participantCount={participantCount}
              />
            ) : mode === "balanced" ? (
              <BalancedConfig
                numericFields={numericFields}
                balanceField={balanceField}
                onBalanceFieldChange={setBalanceField}
                teamCount={teamCount}
                onTeamCountChange={setTeamCount}
                participantCount={participantCount}
              />
            ) : null}
          </div>
        )}

        {/* Preview */}
        {canGenerate && (
          <PreviewText
            mode={mode!}
            splitFields={splitFields}
            clusterFields={clusterFields}
            balanceField={balanceField}
            groupCount={groupCount}
            teamCount={teamCount}
            participantCount={participantCount}
            memberLabel={memberLabel}
            fields={fields ?? []}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetState(); onOpenChange(false) }}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || generateGroups.isPending}
          >
            {generateGroups.isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Split Config
// =============================================================================

type AvailableField = {
  sourceId: string
  label: string
  source: string
  type: string
  options?: string[]
}

function SplitConfig({
  groupedFields,
  selectedFields,
  onToggle,
}: {
  groupedFields: Map<string, AvailableField[]>
  selectedFields: string[]
  onToggle: (sourceId: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Select 1-2 fields to split members into groups by value.
      </p>
      {[...groupedFields.entries()].map(([source, sourceFields]) => (
        <div key={source}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {sourceLabels[source] ?? source}
          </p>
          <div className="space-y-2">
            {sourceFields.map((field) => {
              const checked = selectedFields.includes(field.sourceId)
              const disabled = !checked && selectedFields.length >= 2
              return (
                <div
                  key={field.sourceId}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3"
                >
                  <Checkbox
                    id={`split-${field.sourceId}`}
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() => onToggle(field.sourceId)}
                  />
                  <Label
                    htmlFor={`split-${field.sourceId}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    {field.label}
                  </Label>
                  <Badge variant="outline" className="text-xs">
                    {field.type}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// =============================================================================
// Cluster Config (Similarity / Diversity)
// =============================================================================

function ClusterConfig({
  groupedFields,
  selectedFields,
  onToggle,
  onWeightChange,
  groupCount,
  onGroupCountChange,
  participantCount,
}: {
  groupedFields: Map<string, AvailableField[]>
  selectedFields: WeightedFieldState[]
  onToggle: (sourceId: string) => void
  onWeightChange: (sourceId: string, weight: number) => void
  groupCount: number
  onGroupCountChange: (count: number) => void
  participantCount: number
}) {
  const selectedIds = new Set(selectedFields.map((f) => f.sourceId))

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Select fields and adjust their importance weights.
      </p>

      {[...groupedFields.entries()].map(([source, sourceFields]) => (
        <div key={source}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {sourceLabels[source] ?? source}
          </p>
          <div className="space-y-2">
            {sourceFields.map((field) => {
              const isSelected = selectedIds.has(field.sourceId)
              const weightState = selectedFields.find((f) => f.sourceId === field.sourceId)

              return (
                <div
                  key={field.sourceId}
                  className="rounded-lg border border-border/50 bg-background/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`cluster-${field.sourceId}`}
                      checked={isSelected}
                      onCheckedChange={() => onToggle(field.sourceId)}
                    />
                    <Label
                      htmlFor={`cluster-${field.sourceId}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {field.label}
                    </Label>
                    <Badge variant="outline" className="text-xs">
                      {field.type}
                    </Badge>
                  </div>
                  {isSelected && weightState && (
                    <div className="mt-2 ml-8 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-14 shrink-0">
                        Weight
                      </span>
                      <Slider
                        value={[weightState.weight]}
                        onValueChange={([v]) => onWeightChange(field.sourceId, v)}
                        min={0}
                        max={1}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                        {weightState.weight.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Group count input */}
      <div className="flex items-center gap-3 pt-2 border-t border-border/50">
        <Label htmlFor="group-count" className="text-sm whitespace-nowrap">
          Number of groups
        </Label>
        <Input
          id="group-count"
          type="number"
          min={2}
          max={Math.min(100, participantCount)}
          value={groupCount}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!Number.isNaN(val) && val >= 2) onGroupCountChange(val)
          }}
          className="w-20"
        />
        <span className="text-xs text-muted-foreground">
          (~{Math.ceil(participantCount / groupCount)} per group)
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Balanced Config
// =============================================================================

function BalancedConfig({
  numericFields,
  balanceField,
  onBalanceFieldChange,
  teamCount,
  onTeamCountChange,
  participantCount,
}: {
  numericFields: AvailableField[]
  balanceField: string
  onBalanceFieldChange: (field: string) => void
  teamCount: number
  onTeamCountChange: (count: number) => void
  participantCount: number
}) {
  if (numericFields.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          No numeric fields available. Add ranking data or numeric form fields first.
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Create teams balanced by a numeric stat using snake draft.
      </p>

      {/* Balance field selector */}
      <div className="space-y-2">
        <Label htmlFor="balance-field" className="text-sm">
          Balance by
        </Label>
        <Select value={balanceField} onValueChange={onBalanceFieldChange}>
          <SelectTrigger id="balance-field">
            <SelectValue placeholder="Select a numeric field" />
          </SelectTrigger>
          <SelectContent>
            {numericFields.map((field) => (
              <SelectItem key={field.sourceId} value={field.sourceId}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Team count input */}
      <div className="flex items-center gap-3">
        <Label htmlFor="team-count" className="text-sm whitespace-nowrap">
          Number of teams
        </Label>
        <Input
          id="team-count"
          type="number"
          min={2}
          max={Math.min(100, participantCount)}
          value={teamCount}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (!Number.isNaN(val) && val >= 2) onTeamCountChange(val)
          }}
          className="w-20"
        />
        <span className="text-xs text-muted-foreground">
          (~{Math.ceil(participantCount / teamCount)} per team)
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Preview Text
// =============================================================================

function PreviewText({
  mode,
  splitFields,
  clusterFields,
  balanceField,
  groupCount,
  teamCount,
  participantCount,
  memberLabel,
  fields,
}: {
  mode: Mode
  splitFields: string[]
  clusterFields: WeightedFieldState[]
  balanceField: string
  groupCount: number
  teamCount: number
  participantCount: number
  memberLabel: string
  fields: AvailableField[]
}) {
  const getLabel = (sourceId: string) =>
    fields.find((f) => f.sourceId === sourceId)?.label ?? sourceId

  if (mode === "split") {
    return (
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        Will split {participantCount} {memberLabel} by{" "}
        <span className="font-medium">
          {splitFields.map(getLabel).join(" and ")}
        </span>
      </div>
    )
  }

  if (mode === "similarity") {
    return (
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        Will create <span className="font-medium">{groupCount} groups</span> of
        ~{Math.ceil(participantCount / groupCount)} similar people based on{" "}
        <span className="font-medium">
          {clusterFields.map((f) => getLabel(f.sourceId)).join(", ")}
        </span>
      </div>
    )
  }

  if (mode === "diversity") {
    return (
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        Will create <span className="font-medium">{groupCount} groups</span>{" "}
        mixing{" "}
        <span className="font-medium">
          {clusterFields.map((f) => getLabel(f.sourceId)).join(", ")}
        </span>
      </div>
    )
  }

  if (mode === "balanced") {
    return (
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        Will create <span className="font-medium">{teamCount} balanced teams</span> by{" "}
        <span className="font-medium">{getLabel(balanceField)}</span>
      </div>
    )
  }

  return null
}

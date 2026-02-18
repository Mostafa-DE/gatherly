import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
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
  visibleFields?: string[] | null
  defaultCriteria?: Criteria | null
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
  visibleFields,
  defaultCriteria,
}: GenerateGroupsDialogProps) {
  const [mode, setMode] = useState<Mode | null>(null)
  const [error, setError] = useState("")
  const [initialized, setInitialized] = useState(false)

  // Split mode state
  const [splitFields, setSplitFields] = useState<string[]>([])

  // Similarity/Diversity mode state
  const [clusterFields, setClusterFields] = useState<WeightedFieldState[]>([])
  const [groupCount, setGroupCount] = useState(() =>
    Math.max(2, Math.ceil(participantCount / 4))
  )

  // Balanced mode state
  const [balanceFields, setBalanceFields] = useState<WeightedFieldState[]>([])
  const [partitionFields, setPartitionFields] = useState<string[]>([])
  const [teamCount, setTeamCount] = useState(() =>
    Math.max(2, Math.ceil(participantCount / 4))
  )

  // Variety state (shared across similarity/diversity/balanced)
  const [varietyWeight, setVarietyWeight] = useState(0)

  const { data: rawFields, isLoading } = trpc.plugin.smartGroups.getAvailableFields.useQuery(
    { activityId, sessionId },
    { enabled: open }
  )

  // Filter fields by visibility config
  const fields = rawFields
    ? visibleFields && visibleFields.length > 0
      ? rawFields.filter((f) => visibleFields.includes(f.sourceId))
      : rawFields
    : undefined

  // Initialize from defaultCriteria on first open
  useEffect(() => {
    if (!initialized && open && defaultCriteria && fields) {
      initializeFromCriteria(defaultCriteria)
      setInitialized(true)
    }
  }, [initialized, open, defaultCriteria, fields])

  const generateGroups = trpc.plugin.smartGroups.generateGroups.useMutation({
    onSuccess: () => {
      resetState()
      onSuccess()
      onOpenChange(false)
    },
    onError: (err) => setError(err.message),
  })

  const updateConfig = trpc.plugin.smartGroups.updateConfig.useMutation({
    onError: (err) => setError(err.message),
  })

  function resetState() {
    setError("")
    setMode(null)
    setSplitFields([])
    setClusterFields([])
    setGroupCount(Math.max(2, Math.ceil(participantCount / 4)))
    setBalanceFields([])
    setPartitionFields([])
    setTeamCount(Math.max(2, Math.ceil(participantCount / 4)))
    setVarietyWeight(0)
    setInitialized(false)
  }

  function initializeFromCriteria(criteria: Criteria) {
    setMode(criteria.mode)
    if (criteria.mode === "split") {
      setSplitFields(criteria.fields.map((f) => f.sourceId))
    } else if (criteria.mode === "similarity" || criteria.mode === "diversity") {
      setClusterFields(criteria.fields.map((f) => ({ sourceId: f.sourceId, weight: f.weight })))
      setGroupCount(criteria.groupCount)
      if (criteria.varietyWeight !== undefined) setVarietyWeight(criteria.varietyWeight)
    } else if (criteria.mode === "balanced") {
      setBalanceFields(criteria.balanceFields.map((f) => ({ sourceId: f.sourceId, weight: f.weight })))
      if (criteria.partitionFields) setPartitionFields(criteria.partitionFields)
      setTeamCount(criteria.teamCount)
      if (criteria.varietyWeight !== undefined) setVarietyWeight(criteria.varietyWeight)
    }
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

  // Balanced mode helpers
  function toggleBalanceField(sourceId: string) {
    setBalanceFields((prev) => {
      if (prev.some((f) => f.sourceId === sourceId)) {
        return prev.filter((f) => f.sourceId !== sourceId)
      }
      if (prev.length >= 10) return prev
      return [...prev, { sourceId, weight: 1 }]
    })
  }

  function setBalanceFieldWeight(sourceId: string, weight: number) {
    setBalanceFields((prev) =>
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
        ...(varietyWeight > 0 ? { varietyWeight } : {}),
      }
    }

    if (mode === "balanced") {
      if (balanceFields.length === 0) return null
      return {
        mode: "balanced",
        balanceFields: balanceFields.map((f) => ({ sourceId: f.sourceId, weight: f.weight })),
        ...(partitionFields.length > 0 ? { partitionFields } : {}),
        teamCount,
        ...(varietyWeight > 0 ? { varietyWeight } : {}),
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

  // Numeric fields only (for balanced mode balance fields)
  const numericFields = fields?.filter(
    (f) => f.type === "ranking_stat" || f.type === "number"
  ) ?? []

  // Categorical fields (for balanced mode partition field)
  const categoricalFields = fields?.filter(
    (f) => f.type === "select" || f.type === "radio" || f.type === "ranking_level"
  ) ?? []

  // Numeric fields grouped by source (for balanced multi-field UI)
  const numericGroupedFields = new Map<string, NonNullable<typeof fields>>()
  for (const field of numericFields) {
    const group = numericGroupedFields.get(field.source) ?? []
    group.push(field)
    numericGroupedFields.set(field.source, group)
  }

  const memberLabel = scope === "session" ? "participants" : "members"

  function handleSaveAsDefault() {
    const criteria = buildCriteria()
    if (!criteria) return
    setError("")
    updateConfig.mutate({ configId, defaultCriteria: criteria })
  }

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
                numericGroupedFields={numericGroupedFields}
                categoricalFields={categoricalFields}
                balanceFields={balanceFields}
                onToggleBalanceField={toggleBalanceField}
                onBalanceFieldWeightChange={setBalanceFieldWeight}
                partitionFields={partitionFields}
                onTogglePartitionField={(sourceId) => {
                  setPartitionFields((prev) =>
                    prev.includes(sourceId)
                      ? prev.filter((id) => id !== sourceId)
                      : [...prev, sourceId]
                  )
                }}
                teamCount={teamCount}
                onTeamCountChange={setTeamCount}
                participantCount={participantCount}
              />
            ) : null}
          </div>
        )}

        {/* Variety Slider — shown for all modes except split */}
        {mode && mode !== "split" && (
          <VarietySlider
            value={varietyWeight}
            onChange={setVarietyWeight}
          />
        )}

        {/* Preview */}
        {canGenerate && (
          <PreviewText
            mode={mode!}
            splitFields={splitFields}
            clusterFields={clusterFields}
            balanceFields={balanceFields}
            partitionFields={partitionFields}
            groupCount={groupCount}
            teamCount={teamCount}
            participantCount={participantCount}
            memberLabel={memberLabel}
            fields={fields ?? []}
          />
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {canGenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveAsDefault}
              disabled={updateConfig.isPending}
              className="mr-auto"
            >
              {updateConfig.isPending ? "Saving..." : "Save as Default"}
            </Button>
          )}
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
  numericGroupedFields,
  categoricalFields,
  balanceFields,
  onToggleBalanceField,
  onBalanceFieldWeightChange,
  partitionFields,
  onTogglePartitionField,
  teamCount,
  onTeamCountChange,
  participantCount,
}: {
  numericGroupedFields: Map<string, AvailableField[]>
  categoricalFields: AvailableField[]
  balanceFields: WeightedFieldState[]
  onToggleBalanceField: (sourceId: string) => void
  onBalanceFieldWeightChange: (sourceId: string, weight: number) => void
  partitionFields: string[]
  onTogglePartitionField: (sourceId: string) => void
  teamCount: number
  onTeamCountChange: (count: number) => void
  participantCount: number
}) {
  const hasNumericFields = numericGroupedFields.size > 0
  const selectedIds = new Set(balanceFields.map((f) => f.sourceId))

  if (!hasNumericFields) {
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
        Create teams balanced by numeric stats. Select fields and adjust weights.
      </p>

      {/* Balance fields — multi-select with weights */}
      {[...numericGroupedFields.entries()].map(([source, sourceFields]) => (
        <div key={source}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {sourceLabels[source] ?? source}
          </p>
          <div className="space-y-2">
            {sourceFields.map((field) => {
              const isSelected = selectedIds.has(field.sourceId)
              const weightState = balanceFields.find((f) => f.sourceId === field.sourceId)

              return (
                <div
                  key={field.sourceId}
                  className="rounded-lg border border-border/50 bg-background/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`balance-${field.sourceId}`}
                      checked={isSelected}
                      onCheckedChange={() => onToggleBalanceField(field.sourceId)}
                    />
                    <Label
                      htmlFor={`balance-${field.sourceId}`}
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
                        onValueChange={([v]) => onBalanceFieldWeightChange(field.sourceId, v)}
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

      {/* Optional partition fields */}
      {categoricalFields.length > 0 && (
        <div className="space-y-2 border-t border-border/50 pt-3">
          <div>
            <p className="text-sm font-medium">Partition by (optional)</p>
            <p className="text-xs text-muted-foreground">
              Ensures each team has members from every category
            </p>
          </div>
          <div className="space-y-2">
            {categoricalFields.map((field) => (
              <div
                key={field.sourceId}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3"
              >
                <Checkbox
                  id={`partition-${field.sourceId}`}
                  checked={partitionFields.includes(field.sourceId)}
                  onCheckedChange={() => onTogglePartitionField(field.sourceId)}
                />
                <Label
                  htmlFor={`partition-${field.sourceId}`}
                  className="flex-1 cursor-pointer text-sm"
                >
                  {field.label}
                </Label>
                <Badge variant="outline" className="text-xs">
                  {field.type === "ranking_level" ? "level" : field.type}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team count input */}
      <div className="flex items-center gap-3 pt-2 border-t border-border/50">
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
// Variety Slider
// =============================================================================

function VarietySlider({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2 border-t border-border/50 pt-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Variety</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {value.toFixed(1)}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={1}
        step={0.1}
      />
      <p className="text-xs text-muted-foreground">
        Higher variety avoids repeating previous group pairings
      </p>
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
  balanceFields,
  partitionFields,
  groupCount,
  teamCount,
  participantCount,
  memberLabel,
  fields,
}: {
  mode: Mode
  splitFields: string[]
  clusterFields: WeightedFieldState[]
  balanceFields: WeightedFieldState[]
  partitionFields: string[]
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
    const balanceLabels = balanceFields.map((f) => getLabel(f.sourceId)).join(", ")
    return (
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        Will create <span className="font-medium">{teamCount} balanced teams</span> by{" "}
        <span className="font-medium">{balanceLabels}</span>
        {partitionFields.length > 0 && (
          <>, partitioned by <span className="font-medium">{partitionFields.map(getLabel).join(", ")}</span></>
        )}
      </div>
    )
  }

  return null
}

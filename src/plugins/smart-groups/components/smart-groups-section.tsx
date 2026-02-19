import { useState, useEffect, useCallback } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid } from "lucide-react"
import { GenerateGroupsDialog } from "./generate-groups-dialog"
import type { Criteria } from "../schemas"

const sourceLabels: Record<string, string> = {
  org: "Org Fields",
  activity: "Activity Fields",
  session: "Session Fields",
  ranking: "Ranking",
}

type SmartGroupsSectionProps = {
  activityId: string
  activity: {
    enabledPlugins: unknown
    name: string
  }
}

function toValidCriteria(value: unknown): Criteria | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Record<string, unknown>
  const mode = raw.mode

  if (mode === "split") {
    if (!Array.isArray(raw.fields) || raw.fields.length === 0) return null
    return raw as Criteria
  }

  if (mode === "similarity" || mode === "diversity") {
    if (!Array.isArray(raw.fields) || raw.fields.length === 0) return null
    if (typeof raw.groupCount !== "number") return null
    return raw as Criteria
  }

  if (mode === "balanced") {
    if (!Array.isArray(raw.balanceFields) || raw.balanceFields.length === 0) return null
    if (typeof raw.teamCount !== "number") return null
    return raw as Criteria
  }

  return null
}

export function SmartGroupsSection({ activityId, activity }: SmartGroupsSectionProps) {
  const enabledPlugins = (activity.enabledPlugins ?? {}) as Record<string, boolean>
  const smartGroupsEnabled = enabledPlugins["smart-groups"] === true

  if (!smartGroupsEnabled) return null

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <LayoutGrid className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Smart Groups</h2>
          <p className="text-sm text-muted-foreground">
            Organize members into groups by attributes
          </p>
        </div>
      </div>

      <SmartGroupsContent activityId={activityId} activityName={activity.name} />
    </div>
  )
}

function SmartGroupsContent({
  activityId,
  activityName,
}: {
  activityId: string
  activityName: string
}) {
  const { data: config, isLoading } =
    trpc.plugin.smartGroups.getConfigByActivity.useQuery({ activityId })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    )
  }

  if (!config) {
    return <SmartGroupsSetup activityId={activityId} activityName={activityName} />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/50 bg-background/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{config.name}</p>
            <p className="text-xs text-muted-foreground">
              Created {new Date(config.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <DefaultCriteriaSettings
        activityId={activityId}
        configId={config.id}
        visibleFields={config.visibleFields as string[] | null}
        defaultCriteria={config.defaultCriteria as Criteria | null}
      />

      <FieldVisibilitySettings activityId={activityId} configId={config.id} visibleFields={config.visibleFields as string[] | null} />

      <p className="text-sm text-muted-foreground">
        Generate groups from session detail pages or the per-activity groups page.
      </p>
    </div>
  )
}

// =============================================================================
// Default Criteria Settings
// =============================================================================

function describeCriteria(criteria: Criteria): string {
  if (criteria.mode === "split") {
    return `Split by ${criteria.fields.length} field${criteria.fields.length === 1 ? "" : "s"}`
  }
  if (criteria.mode === "similarity") {
    return `Similarity mode, ${criteria.fields.length} weighted field${criteria.fields.length === 1 ? "" : "s"}, ${criteria.groupCount} groups`
  }
  if (criteria.mode === "diversity") {
    return `Diversity mode, ${criteria.fields.length} weighted field${criteria.fields.length === 1 ? "" : "s"}, ${criteria.groupCount} groups`
  }
  return `Balanced mode, ${criteria.balanceFields.length} weighted stat${criteria.balanceFields.length === 1 ? "" : "s"}, ${criteria.teamCount} teams`
}

function DefaultCriteriaSettings({
  activityId,
  configId,
  visibleFields,
  defaultCriteria,
}: {
  activityId: string
  configId: string
  visibleFields: string[] | null
  defaultCriteria: Criteria | null
}) {
  const [showDefaultsDialog, setShowDefaultsDialog] = useState(false)
  const safeDefaultCriteria = toValidCriteria(defaultCriteria)
  const { data: members } = trpc.activityMembership.members.useQuery(
    { activityId, limit: 1000, offset: 0 },
    { enabled: showDefaultsDialog }
  )
  const participantCount = Math.max(2, members?.length ?? 20)

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Default Grouping Criteria</p>
          <p className="text-xs text-muted-foreground">
            {safeDefaultCriteria
              ? describeCriteria(safeDefaultCriteria)
              : "No default set. Configure one to prefill Generate Groups."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDefaultsDialog(true)}
        >
          {safeDefaultCriteria ? "Edit Defaults" : "Set Defaults"}
        </Button>
      </div>

      {showDefaultsDialog && (
        <GenerateGroupsDialog
          configId={configId}
          activityId={activityId}
          scope="activity"
          participantCount={participantCount}
          open={showDefaultsDialog}
          onOpenChange={setShowDefaultsDialog}
          visibleFields={visibleFields}
          defaultCriteria={safeDefaultCriteria}
          defaultsOnly
        />
      )}
    </div>
  )
}

// =============================================================================
// Field Visibility Settings
// =============================================================================

function FieldVisibilitySettings({
  activityId,
  configId,
  visibleFields,
}: {
  activityId: string
  configId: string
  visibleFields: string[] | null
}) {
  const utils = trpc.useUtils()
  const [error, setError] = useState("")

  const { data: fields, isLoading } = trpc.plugin.smartGroups.getAvailableFields.useQuery(
    { activityId }
  )

  // Draft state: set of visible field sourceIds
  // null from server means "show all" → initialize with all field IDs
  const [draft, setDraft] = useState<Set<string> | null>(null)

  const initDraft = useCallback(
    (allFields: typeof fields) => {
      if (!allFields) return
      if (visibleFields) {
        setDraft(new Set(visibleFields))
      } else {
        // null = show all → all enabled
        setDraft(new Set(allFields.map((f) => f.sourceId)))
      }
    },
    [visibleFields]
  )

  useEffect(() => {
    if (fields && !draft) {
      initDraft(fields)
    }
  }, [fields, draft, initDraft])

  const updateConfig = trpc.plugin.smartGroups.updateConfig.useMutation({
    onSuccess: () => {
      utils.plugin.smartGroups.getConfigByActivity.invalidate({ activityId })
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  if (isLoading || !fields || !draft) {
    return <Skeleton className="h-20 rounded-lg" />
  }

  // Compute dirty state
  const allFieldIds = fields.map((f) => f.sourceId)
  const allEnabled = draft.size === allFieldIds.length && allFieldIds.every((id) => draft.has(id))
  // Server value: null means all visible; otherwise compare sets
  const serverSet = visibleFields ? new Set(visibleFields) : null
  const isDirty = serverSet === null
    ? !allEnabled
    : draft.size !== serverSet.size || [...draft].some((id) => !serverSet.has(id))

  function toggleField(sourceId: string) {
    setDraft((prev) => {
      if (!prev) return prev
      const next = new Set(prev)
      if (next.has(sourceId)) {
        // Don't allow disabling all fields
        if (next.size <= 1) return prev
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return next
    })
  }

  function handleSave() {
    if (!draft) return
    // If all fields are enabled, save null (show all)
    const value = allEnabled ? null : [...draft]
    setError("")
    updateConfig.mutate({ configId, visibleFields: value })
  }

  // Group fields by source
  const groupedFields = new Map<string, typeof fields>()
  for (const field of fields) {
    const group = groupedFields.get(field.source) ?? []
    group.push(field)
    groupedFields.set(field.source, group)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Visible Fields</p>
          <p className="text-xs text-muted-foreground">
            Choose which fields appear in the generate dialog
          </p>
        </div>
        {isDirty && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateConfig.isPending}
          >
            {updateConfig.isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {[...groupedFields.entries()].map(([source, sourceFields]) => (
          <div key={source}>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {sourceLabels[source] ?? source}
            </p>
            <div className="space-y-1">
              {sourceFields.map((field) => (
                <div
                  key={field.sourceId}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                >
                  <Label htmlFor={`vis-${field.sourceId}`} className="text-sm cursor-pointer">
                    {field.label}
                  </Label>
                  <Switch
                    id={`vis-${field.sourceId}`}
                    checked={draft.has(field.sourceId)}
                    onCheckedChange={() => toggleField(field.sourceId)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Smart Groups Setup (first-time config creation)
// =============================================================================

function SmartGroupsSetup({
  activityId,
  activityName,
}: {
  activityId: string
  activityName: string
}) {
  const utils = trpc.useUtils()
  const [name, setName] = useState(`${activityName} Groups`)
  const [error, setError] = useState("")

  const createConfig = trpc.plugin.smartGroups.createConfig.useMutation({
    onSuccess: () => {
      utils.plugin.smartGroups.getConfigByActivity.invalidate({ activityId })
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set up Smart Groups to organize members by form field values.
      </p>
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="sg-name">Config Name</Label>
        <Input
          id="sg-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tennis Groups"
          className="bg-popover"
        />
      </div>
      <Button
        onClick={() => createConfig.mutate({ activityId, name: name.trim() })}
        disabled={!name.trim() || createConfig.isPending}
      >
        {createConfig.isPending ? "Creating..." : "Create Smart Groups"}
      </Button>
    </div>
  )
}

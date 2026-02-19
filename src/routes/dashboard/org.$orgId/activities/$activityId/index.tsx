import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowLeft,
  FileText,
  LayoutGrid,
  Plus,
  Save,
  Settings,
  Users,
  UserPlus,
  X,
  Power,
  PowerOff,
  Puzzle,
  Trophy,
  XCircle,
} from "lucide-react"
import { FormFieldEditor } from "@/components/form-field-editor"
import type { FormField } from "@/types/form"
import { pluginCatalog } from "@/plugins/catalog"
import { RankingManagement } from "@/plugins/ranking/components/ranking-management"
import { RankingSetupForm } from "@/plugins/ranking/components/ranking-setup-form"
import { SmartGroupsSection } from "@/plugins/smart-groups/components/smart-groups-section"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/activities/$activityId/"
)({
  component: ActivitySettingsPage,
})

function ActivitySettingsPage() {
  const { orgId, activityId } = Route.useParams()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: activityData, isLoading: activityLoading } = trpc.activity.getById.useQuery(
    { activityId },
    { enabled: isAdmin }
  )

  if (whoamiLoading || activityLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Only group owners and admins can access activity settings.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId/activities" params={{ orgId }}>
            Back to Activities
          </Link>
        </Button>
      </div>
    )
  }

  if (!activityData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <h2 className="text-xl font-semibold mb-2">Activity Not Found</h2>
        <p className="text-muted-foreground mb-6">
          This activity does not exist or has been removed.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId/activities" params={{ orgId }}>
            Back to Activities
          </Link>
        </Button>
      </div>
    )
  }

  const enabledPlugins = (activityData.enabledPlugins ?? {}) as Record<string, boolean>
  const smartGroupsEnabled = enabledPlugins["smart-groups"] === true

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link to="/dashboard/org/$orgId/activities" params={{ orgId }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{activityData.name}</h1>
            <Badge variant={activityData.isActive ? "default" : "outline"} className="text-xs">
              {activityData.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        {smartGroupsEnabled && (
          <Button variant="outline" size="sm" asChild>
            <Link
              to="/dashboard/org/$orgId/activities/$activityId/smart-groups"
              params={{ orgId, activityId }}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Smart Groups
            </Link>
          </Button>
        )}
      </div>

      {/* General Settings Section */}
      <GeneralSettingsSection
        activityId={activityId}
        activity={activityData}
      />

      {/* Join Form Section */}
      <JoinFormSection
        activityId={activityId}
        activity={activityData}
      />

      {/* Members Section */}
      <MembersSection activityId={activityId} />

      {/* Plugins Section */}
      <PluginsSection activityId={activityId} activity={activityData} />

      {/* Rankings Section (conditional) */}
      <RankingsSection activityId={activityId} activityName={activityData.name} activity={activityData} />

      {/* Smart Groups Section (conditional) */}
      <SmartGroupsSection activityId={activityId} activity={activityData} />
    </div>
  )
}

// =============================================================================
// General Settings Section
// =============================================================================

type ActivityData = {
  id: string
  name: string
  slug: string
  joinMode: string
  joinFormSchema: unknown
  isActive: boolean
  enabledPlugins: unknown
}

function GeneralSettingsSection({
  activityId,
  activity,
}: {
  activityId: string
  activity: ActivityData
}) {
  const utils = trpc.useUtils()
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [joinModeDraft, setJoinModeDraft] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false)

  const name = nameDraft ?? activity.name
  const joinMode = joinModeDraft ?? activity.joinMode
  const dirty = name !== activity.name || joinMode !== activity.joinMode

  const updateActivity = trpc.activity.update.useMutation({
    onSuccess: () => {
      utils.activity.getById.invalidate({ activityId })
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setNameDraft(null)
      setJoinModeDraft(null)
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  const deactivateActivity = trpc.activity.deactivate.useMutation({
    onSuccess: () => {
      utils.activity.getById.invalidate({ activityId })
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setShowDeactivateConfirm(false)
    },
    onError: (err) => setError(err.message),
  })

  const reactivateActivity = trpc.activity.reactivate.useMutation({
    onSuccess: () => {
      utils.activity.getById.invalidate({ activityId })
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
    },
    onError: (err) => setError(err.message),
  })

  function handleSave() {
    setError("")
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    updateActivity.mutate({
      activityId,
      name: name.trim(),
      joinMode: joinMode as "open" | "require_approval" | "invite",
    })
  }

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">General Settings</h2>
            <p className="text-sm text-muted-foreground">Basic activity information</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="activity-name">Name</Label>
            <Input
              id="activity-name"
              value={name}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Activity name"
              className="bg-popover"
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <div className="rounded-lg border border-border/50 bg-background/50 p-3">
              <p className="text-sm font-medium font-mono text-muted-foreground">/{activity.slug}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-join-mode">Join Mode</Label>
            <Select
              value={joinMode}
              onValueChange={(v) => setJoinModeDraft(v)}
            >
              <SelectTrigger id="activity-join-mode" className="bg-popover">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open - Anyone can join</SelectItem>
                <SelectItem value="require_approval">Approval Required</SelectItem>
                <SelectItem value="invite">Invite Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3">
              {activity.isActive ? (
                <>
                  <Badge className="bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)] border-0 text-xs">
                    Active
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => setShowDeactivateConfirm(true)}
                  >
                    <PowerOff className="h-3.5 w-3.5 mr-1.5" />
                    Deactivate
                  </Button>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Inactive
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto text-muted-foreground hover:text-primary"
                    disabled={reactivateActivity.isPending}
                    onClick={() => reactivateActivity.mutate({ activityId })}
                  >
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                    {reactivateActivity.isPending ? "Reactivating..." : "Reactivate"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border/50 pt-6">
          <Button
            onClick={handleSave}
            disabled={!dirty || updateActivity.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateActivity.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Deactivate Confirmation */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &quot;{activity.name}&quot;? Deactivated
              activities cannot accept new sessions or members. Existing sessions and data will
              be preserved. You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deactivateActivity.mutate({ activityId })}
            >
              {deactivateActivity.isPending ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// =============================================================================
// Join Form Section
// =============================================================================

function JoinFormSection({
  activityId,
  activity,
}: {
  activityId: string
  activity: ActivityData
}) {
  const utils = trpc.useUtils()
  const [fieldsDraft, setFieldsDraft] = useState<FormField[] | null>(null)
  const [formError, setFormError] = useState("")

  const persistedFields =
    ((activity.joinFormSchema as { fields?: FormField[] } | null)?.fields || [])

  const fields = fieldsDraft ?? persistedFields
  const formDirty = fieldsDraft !== null

  const updateJoinForm = trpc.activity.update.useMutation({
    onSuccess: () => {
      utils.activity.getById.invalidate({ activityId })
      setFieldsDraft(null)
      setFormError("")
    },
    onError: (err) => {
      setFormError(err.message)
    },
  })

  const generateFieldId = () => `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const addField = () => {
    const newField: FormField = {
      id: generateFieldId(),
      type: "text",
      label: "",
      required: false,
    }
    setFieldsDraft((prev) => [...(prev ?? persistedFields), newField])
  }

  const removeField = (id: string) => {
    setFieldsDraft((prev) => (prev ?? persistedFields).filter((f) => f.id !== id))
  }

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFieldsDraft((prev) =>
      (prev ?? persistedFields).map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
  }

  const moveField = (index: number, direction: "up" | "down") => {
    const currentFields = fieldsDraft ?? persistedFields
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= currentFields.length) return
    const newFields = [...currentFields]
    const [removed] = newFields.splice(index, 1)
    newFields.splice(newIndex, 0, removed)
    setFieldsDraft(newFields)
  }

  const handleSaveForm = () => {
    setFormError("")
    for (const field of fields) {
      if (!field.label.trim()) {
        setFormError("All fields must have a label")
        return
      }
      if ((field.type === "select" || field.type === "multiselect") && (!field.options || field.options.length === 0)) {
        setFormError(`Field "${field.label}" requires at least one option`)
        return
      }
    }
    updateJoinForm.mutate({
      activityId,
      joinFormSchema: fields.length > 0 ? { fields } : null,
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <FileText className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Join Form</h2>
          <p className="text-sm text-muted-foreground">
            Custom fields members fill out when joining this activity
          </p>
        </div>
      </div>

      {formError && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {formError}
        </div>
      )}

      {fields.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium">No Custom Fields</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add custom fields that members fill out when joining this activity.
          </p>
          <Button onClick={addField} className="mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add First Field
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <FormFieldEditor
              key={field.id}
              field={field}
              index={index}
              totalFields={fields.length}
              onUpdate={(updates) => updateField(field.id, updates)}
              onRemove={() => removeField(field.id)}
              onMoveUp={() => moveField(index, "up")}
              onMoveDown={() => moveField(index, "down")}
            />
          ))}
          <Button variant="outline" onClick={addField} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </div>
      )}

      {fields.length > 0 && (
        <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-6">
          <p className="text-sm text-muted-foreground">
            {fields.length} field{fields.length !== 1 ? "s" : ""} configured
          </p>
          <Button
            onClick={handleSaveForm}
            disabled={!formDirty || updateJoinForm.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateJoinForm.isPending ? "Saving..." : "Save Form"}
          </Button>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Members Section
// =============================================================================

function MembersSection({ activityId }: { activityId: string }) {
  const utils = trpc.useUtils()
  const [showAddMember, setShowAddMember] = useState(false)
  const [addError, setAddError] = useState("")

  const { data: members, isLoading: membersLoading } = trpc.activityMembership.members.useQuery(
    { activityId, limit: 1000, offset: 0 }
  )

  const { data: orgMembers } = trpc.organization.listMembers.useQuery(
    undefined,
    { enabled: showAddMember }
  )

  const addMember = trpc.activityMembership.adminAdd.useMutation({
    onSuccess: () => {
      utils.activityMembership.members.invalidate({ activityId })
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setAddError("")
    },
    onError: (err) => setAddError(err.message),
  })

  const removeMember = trpc.activityMembership.remove.useMutation({
    onSuccess: () => {
      utils.activityMembership.members.invalidate({ activityId })
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
    },
  })

  const activityMemberIds = new Set(members?.map(({ member: m }) => m.userId) ?? [])
  const availableOrgMembers = orgMembers?.filter(
    ({ user }) => !activityMemberIds.has(user.id)
  ) ?? []

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Members</h2>
            <p className="text-sm text-muted-foreground">
              {membersLoading ? "Loading..." : `${members?.length ?? 0} member${(members?.length ?? 0) !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {!showAddMember && (
          <Button variant="outline" size="sm" onClick={() => setShowAddMember(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        )}
      </div>

      {addError && (
        <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {addError}
        </div>
      )}

      {membersLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                <div className="h-2.5 w-32 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : members && members.length > 0 ? (
        <div className="max-h-80 overflow-y-auto space-y-1">
          {members.map(({ member: m, user: u }) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={u.image ?? undefined} alt={u.name} />
                <AvatarFallback className="text-xs">
                  {u.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeMember.mutate({ activityId, userId: m.userId })}
                disabled={removeMember.isPending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No members yet
        </p>
      )}

      {showAddMember && (
        <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Add Org Member</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddMember(false)}
            >
              Done
            </Button>
          </div>
          {availableOrgMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              All org members are already in this activity
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {availableOrgMembers.map(({ user }) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                  onClick={() => addMember.mutate({ activityId, userId: user.id })}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image ?? undefined} alt={user.name} />
                    <AvatarFallback className="text-xs">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Plugins Section
// =============================================================================

function PluginsSection({
  activityId,
  activity,
}: {
  activityId: string
  activity: ActivityData
}) {
  const utils = trpc.useUtils()
  const activityPlugins = pluginCatalog.filter((p) => p.scope === "activity")
  const enabledPlugins = (activity.enabledPlugins ?? {}) as Record<string, boolean>

  const togglePlugin = trpc.activity.togglePlugin.useMutation({
    onSuccess: () => {
      utils.activity.getById.invalidate({ activityId })
    },
  })

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Puzzle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Plugins</h2>
          <p className="text-sm text-muted-foreground">
            Enable or disable plugins for this activity
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {activityPlugins.map((plugin) => {
          const locked = plugin.alwaysEnabled === true
          const enabled = locked ? true : enabledPlugins[plugin.id] === true
          // Once enabled, ranking cannot be disabled — user must deactivate the activity instead
          const permanentlyEnabled = plugin.id === "ranking" && enabled

          return (
            <div
              key={plugin.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4"
            >
              <div className="space-y-0.5">
                <p className="font-medium">{plugin.name}</p>
                <p className="text-sm text-muted-foreground">{plugin.description}</p>
                {locked && (
                  <p className="text-xs text-muted-foreground">
                    {plugin.alwaysEnabledReason ?? "This plugin is required and cannot be disabled."}
                  </p>
                )}
                {permanentlyEnabled && (
                  <p className="text-xs text-muted-foreground">
                    Rankings cannot be disabled once enabled. Deactivate the activity to start fresh.
                  </p>
                )}
              </div>
              <Switch
                checked={enabled}
                disabled={locked || permanentlyEnabled || togglePlugin.isPending}
                onCheckedChange={(checked) => {
                  if (locked || permanentlyEnabled) return
                  togglePlugin.mutate({ activityId, pluginId: plugin.id, enabled: checked })
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =============================================================================
// Rankings Section
// =============================================================================

function RankingsSection({
  activityId,
  activityName,
  activity,
}: {
  activityId: string
  activityName: string
  activity: ActivityData
}) {
  const enabledPlugins = (activity.enabledPlugins ?? {}) as Record<string, boolean>
  const rankingEnabled = enabledPlugins.ranking === true

  if (!rankingEnabled) return null

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Rankings</h2>
          <p className="text-sm text-muted-foreground">
            Manage ranking system for this activity
          </p>
        </div>
      </div>

      <RankingsContent activityId={activityId} activityName={activityName} />
    </div>
  )
}

function RankingsContent({
  activityId,
  activityName,
}: {
  activityId: string
  activityName: string
}) {
  const { data: definition, isLoading } =
    trpc.plugin.ranking.getByActivity.useQuery({ activityId })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  if (!definition) {
    return (
      <RankingSetupForm
        activityId={activityId}
        activityName={activityName}
      />
    )
  }

  return <RankingManagement activityId={activityId} />
}

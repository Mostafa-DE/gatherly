import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
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
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog"
import {
  Settings,
  Globe,
  Users,
  Clock,
  Plus,
  Save,
  XCircle,
  DollarSign,
  Puzzle,
  Lock,
} from "lucide-react"
import { type FormField } from "@/types/form"
import { FormFieldEditor as SharedFormFieldEditor } from "@/components/form-field-editor"
import { getTimezones } from "@/lib/timezones"
import { SUPPORTED_CURRENCIES } from "@/schemas/organization-settings"
import { ShareDialog } from "@/components/share-dialog"
import { buildOrgUrl } from "@/lib/share-urls"
import { TimezoneSelect } from "@/components/ui/timezone-select"
import { pluginCatalog } from "@/plugins/catalog"
import { InterestPicker } from "@/components/onboarding/interest-picker"
import { Tags, Layers, ArrowRight } from "lucide-react"

export const Route = createFileRoute("/dashboard/org/$orgId/settings")({
  component: SettingsPage,
})

const CURRENCY_EMPTY_VALUE = "__unset__"
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

function SettingsPage() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isOwner = whoami?.membership?.role === "owner"
  const isAdmin = isOwner || whoami?.membership?.role === "admin"

  const { data: settings, isLoading: settingsLoading } = trpc.organizationSettings.get.useQuery(
    {},
    { enabled: isAdmin }
  )

  const [fieldsDraft, setFieldsDraft] = useState<FormField[] | null>(null)
  const [formError, setFormError] = useState("")
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [timezoneDraft, setTimezoneDraft] = useState<string | null>(null)
  const [joinModeDraft, setJoinModeDraft] = useState<"open" | "invite" | "approval" | null>(null)
  const [currencyDraft, setCurrencyDraft] = useState<SupportedCurrency | "" | null>(null)
  const [interestsDraft, setInterestsDraft] = useState<string[] | null>(null)
  const [showNameConfirm, setShowNameConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState("")

  const org = whoami?.activeOrganization
  const [generalError, setGeneralError] = useState("")
  const timezones = useMemo(() => getTimezones(), [])

  const persistedName = org?.name ?? ""
  const persistedTimezone = org?.timezone || ""
  const persistedJoinMode = (org?.defaultJoinMode as "open" | "invite" | "approval") || "invite"
  const persistedCurrency = (settings?.currency as SupportedCurrency | null) ?? ""
  const persistedFields =
    ((settings?.joinFormSchema as { fields?: FormField[] } | null)?.fields || [])

  const nameAlreadyChanged = settings?.nameChangedAt != null
  const canEditName = isOwner && !nameAlreadyChanged

  const groupName = nameDraft ?? persistedName
  const timezone = timezoneDraft ?? persistedTimezone
  const joinMode = joinModeDraft ?? persistedJoinMode
  const currency = currencyDraft ?? persistedCurrency
  const fields = fieldsDraft ?? persistedFields

  const currencyDirty = currency !== persistedCurrency
  const generalDirty =
    groupName !== persistedName ||
    timezone !== persistedTimezone ||
    joinMode !== persistedJoinMode ||
    currencyDirty
  const formDirty = fieldsDraft !== null

  const updateOrgSettings = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      utils.user.whoami.invalidate()
      setGeneralError("")
      setNameDraft(null)
      setTimezoneDraft(null)
      setJoinModeDraft(null)
    },
    onError: (err) => {
      setGeneralError(err.message)
    },
  })

  const updateCurrency = trpc.organizationSettings.updateCurrency.useMutation({
    onSuccess: () => {
      utils.organizationSettings.get.invalidate()
      setCurrencyDraft(null)
    },
    onError: (err) => {
      setGeneralError(err.message)
    },
  })

  const saveCurrencyIfDirty = () => {
    if (currencyDirty) {
      updateCurrency.mutate({ currency: currency === "" ? null : currency })
    }
  }

  const handleSaveGeneralSettings = () => {
    setGeneralError("")
    const nameChanged = groupName !== persistedName

    // If name is being changed, show confirmation dialog
    if (nameChanged) {
      setShowNameConfirm(true)
      setConfirmText("")
      return
    }

    updateOrgSettings.mutate({
      timezone: timezone || null,
      defaultJoinMode: joinMode,
    })
    saveCurrencyIfDirty()
  }

  const handleConfirmNameChange = () => {
    setShowNameConfirm(false)
    setConfirmText("")
    updateOrgSettings.mutate({
      name: groupName,
      confirmText: "confirm",
      timezone: timezone || null,
      defaultJoinMode: joinMode,
    })
    saveCurrencyIfDirty()
  }

  const updateJoinForm = trpc.organizationSettings.updateJoinForm.useMutation({
    onSuccess: () => {
      utils.organizationSettings.get.invalidate()
      setFieldsDraft(null)
      setFormError("")
    },
    onError: (err) => {
      setFormError(err.message)
    },
  })

  // Organization interests
  const showInterests = (joinMode !== "invite")

  const { data: orgInterestIds } = trpc.onboarding.getOrganizationInterests.useQuery(
    undefined,
    { enabled: isAdmin && showInterests }
  )

  const persistedInterests = orgInterestIds ?? []
  const currentInterests = interestsDraft ?? persistedInterests
  const interestsDirty = interestsDraft !== null

  const saveOrgInterests = trpc.onboarding.setOrganizationInterests.useMutation({
    onSuccess: () => {
      utils.onboarding.getOrganizationInterests.invalidate()
      setInterestsDraft(null)
    },
  })

  const handleSaveInterests = () => {
    saveOrgInterests.mutate({ interestIds: currentInterests })
  }

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
      joinFormSchema: fields.length > 0 ? { fields } : null,
    })
  }

  if (whoamiLoading || settingsLoading) {
    return (
      <div className="space-y-8 py-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
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
          Only group owners and admins can access settings.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId" params={{ orgId }}>
            Back to Overview
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Group Settings
        </h1>
      </div>

      {/* General Settings */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">General Settings</h2>
            <p className="text-sm text-muted-foreground">Basic group information</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <div className="space-y-2">
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              value={groupName}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Group name"
              className="bg-popover"
              disabled={!canEditName}
            />
            {nameAlreadyChanged && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Group name can only be changed once and has already been updated
              </p>
            )}
            {!isOwner && !nameAlreadyChanged && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Only the group owner can change the name
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <p className="text-sm font-medium text-muted-foreground">URL</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="font-medium">/{org?.ownerUsername}/{org?.userSlug}</p>
              {org?.ownerUsername && org?.userSlug && (
                <ShareDialog
                  url={buildOrgUrl(org.ownerUsername, org.userSlug)}
                  title={org.name}
                  inviteLink={
                    isAdmin
                      ? { orgId: org.id, username: org.ownerUsername, groupSlug: org.userSlug }
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        </div>

        {generalError && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {generalError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="timezone" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timezone
            </Label>
            <TimezoneSelect
              id="timezone"
              value={timezone}
              onChange={setTimezoneDraft}
              timezones={timezones}
            />
            <p className="text-xs text-muted-foreground">
              e.g. America/New_York, Europe/London
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="joinMode" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Default Join Mode
            </Label>
            <Select
              value={joinMode}
              onValueChange={(v) => setJoinModeDraft(v as "open" | "invite" | "approval")}
            >
              <SelectTrigger id="joinMode" className="bg-popover">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invite">Invite Only</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="approval">Approval Required</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Currency
            </Label>
            <Select
              value={currency || CURRENCY_EMPTY_VALUE}
              onValueChange={(value) =>
                setCurrencyDraft(
                  value === CURRENCY_EMPTY_VALUE ? "" : (value as SupportedCurrency)
                )
              }
            >
              <SelectTrigger id="currency" className="bg-popover">
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CURRENCY_EMPTY_VALUE}>Not set</SelectItem>
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <SelectItem key={curr} value={curr}>
                    {curr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Required for setting session prices
            </p>
          </div>
        </div>
        <div className="mt-6 border-t border-border/50 pt-6">
          <Button
            onClick={handleSaveGeneralSettings}
            disabled={!generalDirty || updateOrgSettings.isPending || updateCurrency.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {updateOrgSettings.isPending || updateCurrency.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>

      {/* Plugins */}
      {isAdmin && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Puzzle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Plugins</h2>
              <p className="text-sm text-muted-foreground">
                Manage plugins for your group. Some plugins are required and
                cannot be disabled.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {pluginCatalog.map((plugin) => (
              <PluginToggle
                key={plugin.id}
                pluginId={plugin.id}
                name={plugin.name}
                description={plugin.description}
                enabled={
                  plugin.alwaysEnabled
                    ? true
                    : ((settings?.enabledPlugins ?? {}) as Record<string, boolean>)[
                        plugin.id
                      ] === true
                }
                alwaysEnabled={plugin.alwaysEnabled}
                alwaysEnabledReason={plugin.alwaysEnabledReason}
              />
            ))}
          </div>
        </div>
      )}

      {/* Activities */}
      {isAdmin && (
        <Link
          to="/dashboard/org/$orgId/activities"
          params={{ orgId }}
          className="group flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-colors hover:border-primary/50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Activities</h2>
              <p className="text-sm text-muted-foreground">
                Manage sub-group activities within your organization
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* Interest Tags */}
      {isAdmin && showInterests && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Tags className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Interest Tags</h2>
              <p className="text-sm text-muted-foreground">
                Tag your group with interests to help people discover it
              </p>
            </div>
          </div>

          <InterestPicker
            selected={currentInterests}
            onChange={setInterestsDraft}
          />

          <div className="mt-6 border-t border-border/50 pt-6">
            <Button
              onClick={handleSaveInterests}
              disabled={!interestsDirty || saveOrgInterests.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveOrgInterests.isPending ? "Saving..." : "Save Interests"}
            </Button>
          </div>
        </div>
      )}

      {/* Join Form Configuration */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Join Form Configuration</h2>
            <p className="text-sm text-muted-foreground">
              Configure the profile fields members fill out when joining
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
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium">No Custom Fields</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add custom fields that members fill out when joining your group.
            </p>
            <Button onClick={addField} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Add First Field
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {fields.map((field, index) => (
              <SharedFormFieldEditor
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

      {/* Name Change Confirmation Dialog */}
      <AlertDialog open={showNameConfirm} onOpenChange={setShowNameConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Group Name</AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. The group name can only be changed once.
              After this change, the name will be locked and cannot be modified again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirmInput">
              Type <span className="font-semibold">confirm</span> to proceed
            </Label>
            <Input
              id="confirmInput"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="confirm"
              className="bg-popover"
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText !== "confirm"}
              onClick={handleConfirmNameChange}
            >
              Change Name
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


type PluginToggleProps = {
  pluginId: string
  name: string
  description: string
  enabled: boolean
  alwaysEnabled?: boolean
  alwaysEnabledReason?: string
}

function PluginToggle({
  pluginId,
  name,
  description,
  enabled,
  alwaysEnabled,
  alwaysEnabledReason,
}: PluginToggleProps) {
  const utils = trpc.useUtils()
  const locked = alwaysEnabled === true

  const togglePlugin = trpc.organizationSettings.togglePlugin.useMutation({
    onSuccess: () => {
      utils.organizationSettings.get.invalidate()
      utils.plugin.ai.checkAvailability.invalidate()
    },
  })

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4">
      <div className="space-y-0.5">
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {locked && (
          <p className="text-xs text-muted-foreground">
            {alwaysEnabledReason ??
              "This plugin is required and cannot be disabled."}
          </p>
        )}
      </div>
      <Switch
        checked={locked ? true : enabled}
        disabled={locked || togglePlugin.isPending}
        onCheckedChange={(checked) => {
          if (locked) return
          togglePlugin.mutate({ pluginId, enabled: checked })
        }}
      />
    </div>
  )
}

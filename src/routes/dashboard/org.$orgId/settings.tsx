import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect, useMemo } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Settings,
  Globe,
  Users,
  Clock,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  XCircle,
  DollarSign,
} from "lucide-react"
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from "@/types/form"
import { getTimezones } from "@/lib/timezones"
import { SUPPORTED_CURRENCIES } from "@/schemas/organization-settings"

export const Route = createFileRoute("/dashboard/org/$orgId/settings")({
  component: SettingsPage,
})

const TIMEZONE_EMPTY_VALUE = "__unset__"
const CURRENCY_EMPTY_VALUE = "__unset__"
type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

function SettingsPage() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"
  const isOwner = whoami?.membership?.role === "owner"

  const { data: settings, isLoading: settingsLoading } = trpc.organizationSettings.get.useQuery(
    {},
    { enabled: isAdmin }
  )

  const [fields, setFields] = useState<FormField[]>([])
  const [formError, setFormError] = useState("")
  const [formDirty, setFormDirty] = useState(false)

  const org = whoami?.activeOrganization
  const [timezone, setTimezone] = useState(org?.timezone || "")
  const [joinMode, setJoinMode] = useState<"open" | "invite" | "approval">(
    (org?.defaultJoinMode as "open" | "invite" | "approval") || "invite"
  )
  const [currency, setCurrency] = useState<SupportedCurrency | "">(
    (settings?.currency as SupportedCurrency | null) ?? ""
  )
  const [generalError, setGeneralError] = useState("")
  const timezones = useMemo(() => getTimezones(), [])

  useEffect(() => {
    setTimezone(org?.timezone || "")
    setJoinMode((org?.defaultJoinMode as "open" | "invite" | "approval") || "invite")
  }, [org?.timezone, org?.defaultJoinMode])

  useEffect(() => {
    setCurrency((settings?.currency as SupportedCurrency | null) ?? "")
  }, [settings?.currency])

  const generalDirty =
    timezone !== (org?.timezone || "") ||
    joinMode !== ((org?.defaultJoinMode as "open" | "invite" | "approval") || "invite")

  const currencyDirty = currency !== (settings?.currency || "")

  const updateOrgSettings = trpc.organization.updateSettings.useMutation({
    onSuccess: () => {
      utils.user.whoami.invalidate()
      setGeneralError("")
    },
    onError: (err) => {
      setGeneralError(err.message)
    },
  })

  const handleSaveGeneralSettings = () => {
    setGeneralError("")
    updateOrgSettings.mutate({
      timezone: timezone || null,
      defaultJoinMode: joinMode,
    })
  }

  const updateCurrency = trpc.organizationSettings.updateCurrency.useMutation({
    onSuccess: () => {
      utils.organizationSettings.get.invalidate()
      setGeneralError("")
    },
    onError: (err) => {
      setGeneralError(err.message)
    },
  })

  const handleSaveCurrency = () => {
    setGeneralError("")
    updateCurrency.mutate({
      currency: currency === "" ? null : currency,
    })
  }

  useEffect(() => {
    const joinFormSchema = settings?.joinFormSchema as { fields?: FormField[] } | null
    if (joinFormSchema?.fields) {
      setFields(joinFormSchema.fields)
    }
  }, [settings])

  const updateJoinForm = trpc.organizationSettings.updateJoinForm.useMutation({
    onSuccess: () => {
      utils.organizationSettings.get.invalidate()
      setFormDirty(false)
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
    setFields([...fields, newField])
    setFormDirty(true)
  }

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id))
    setFormDirty(true)
  }

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)))
    setFormDirty(true)
  }

  const moveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= fields.length) return
    const newFields = [...fields]
    const [removed] = newFields.splice(index, 1)
    newFields.splice(newIndex, 0, removed)
    setFields(newFields)
    setFormDirty(true)
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
    <div className="space-y-10 py-6">
      {/* Hero Section */}
      <div>
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <Settings className="mr-2 h-3.5 w-3.5" />
          Settings
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          Group{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Configure your group preferences and join form
        </p>
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
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <p className="text-sm font-medium text-muted-foreground">Group Name</p>
            <p className="mt-1 font-medium">{org?.name}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/50 p-4">
            <p className="text-sm font-medium text-muted-foreground">URL Slug</p>
            <p className="mt-1 font-medium">/{org?.slug}</p>
          </div>
        </div>

        {generalError && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {generalError}
          </div>
        )}

        {isOwner ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="timezone" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Timezone
                </Label>
                <Select
                  value={timezone || TIMEZONE_EMPTY_VALUE}
                  onValueChange={(value) =>
                    setTimezone(value === TIMEZONE_EMPTY_VALUE ? "" : value)
                  }
                >
                  <SelectTrigger id="timezone" className="bg-background/50">
                    <SelectValue placeholder="Select a timezone" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={TIMEZONE_EMPTY_VALUE}>Not set</SelectItem>
                    {timezones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  onValueChange={(v) => setJoinMode(v as "open" | "invite" | "approval")}
                >
                  <SelectTrigger id="joinMode" className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invite">Invite Only</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="approval">Approval Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-6 border-t border-border/50 pt-6">
              <Button
                onClick={handleSaveGeneralSettings}
                disabled={!generalDirty || updateOrgSettings.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateOrgSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/50 bg-background/50 p-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timezone
              </p>
              <p className="mt-1 font-medium">{org?.timezone || "Not set"}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/50 p-4">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Default Join Mode
              </p>
              <p className="mt-1 font-medium capitalize">{org?.defaultJoinMode || "Invite"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Currency Settings */}
      {isOwner && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Currency Settings</h2>
              <p className="text-sm text-muted-foreground">
                Set the default currency for session pricing
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Currency
            </Label>
            <Select
              value={currency || CURRENCY_EMPTY_VALUE}
              onValueChange={(value) =>
                setCurrency(
                  value === CURRENCY_EMPTY_VALUE ? "" : (value as SupportedCurrency)
                )
              }
            >
              <SelectTrigger id="currency" className="bg-background/50 max-w-xs">
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

          <div className="mt-6 border-t border-border/50 pt-6">
            <Button
              onClick={handleSaveCurrency}
              disabled={!currencyDirty || updateCurrency.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateCurrency.isPending ? "Saving..." : "Save Currency"}
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
    </div>
  )
}

type FormFieldEditorProps = {
  field: FormField
  index: number
  totalFields: number
  onUpdate: (updates: Partial<FormField>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Text",
  textarea: "Text Area",
  email: "Email",
  phone: "Phone",
  number: "Number",
  select: "Dropdown",
  multiselect: "Multi-Select",
  checkbox: "Checkbox",
  date: "Date",
}

function FormFieldEditor({
  field,
  index,
  totalFields,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: FormFieldEditorProps) {
  const [optionsText, setOptionsText] = useState(field.options?.join("\n") || "")

  const handleOptionsChange = (value: string) => {
    setOptionsText(value)
    const options = value
      .split("\n")
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
    onUpdate({ options: options.length > 0 ? options : undefined })
  }

  const needsOptions = field.type === "select" || field.type === "multiselect"

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {index + 1}
          </span>
          <span className="font-medium">{field.label || "New Field"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveDown}
            disabled={index === totalFields - 1}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-label`}>Label *</Label>
          <Input
            id={`${field.id}-label`}
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Field label"
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-type`}>Type</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onUpdate({ type: v as FormFieldType })}
          >
            <SelectTrigger id={`${field.id}-type`} className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {FIELD_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsOptions && (
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-options`}>Options (one per line) *</Label>
          <textarea
            id={`${field.id}-options`}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Option 1&#10;Option 2&#10;Option 3"
            value={optionsText}
            onChange={(e) => handleOptionsChange(e.target.value)}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${field.id}-required`}
          checked={field.required || false}
          onCheckedChange={(checked) => onUpdate({ required: checked === true })}
        />
        <Label htmlFor={`${field.id}-required`} className="text-sm font-normal">
          Required field
        </Label>
      </div>
    </div>
  )
}

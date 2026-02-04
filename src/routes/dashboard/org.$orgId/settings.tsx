import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
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
import { Settings, Globe, Users, Clock, Plus, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react"
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from "@/types/form"

export const Route = createFileRoute("/dashboard/org/$orgId/settings")({
  component: SettingsPage,
})

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

  // General settings state (owner only)
  const org = whoami?.activeOrganization
  const [timezone, setTimezone] = useState(org?.timezone || "")
  const [joinMode, setJoinMode] = useState<"open" | "invite" | "approval">(
    (org?.defaultJoinMode as "open" | "invite" | "approval") || "invite"
  )
  const [generalError, setGeneralError] = useState("")

  const generalDirty =
    timezone !== (org?.timezone || "") ||
    joinMode !== ((org?.defaultJoinMode as "open" | "invite" | "approval") || "invite")

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

  // Initialize fields from settings
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

    // Validate fields
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
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only group owners and admins can access settings.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard/org/$orgId" params={{ orgId }}>
                Back to Overview
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your group settings
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic group information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium">Group Name</p>
                <p className="text-sm text-muted-foreground">{org?.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">URL Slug</p>
                <p className="text-sm text-muted-foreground">/{org?.slug}</p>
              </div>
            </div>
            <Separator />
            {generalError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {generalError}
              </div>
            )}
            {isOwner ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timezone
                  </Label>
                  <Input
                    id="timezone"
                    placeholder="America/New_York"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
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
                    onValueChange={(v) => setJoinMode(v as "open" | "invite" | "approval")}
                  >
                    <SelectTrigger id="joinMode">
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
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timezone
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {org?.timezone || "Not set"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Default Join Mode
                  </p>
                  <Badge variant="secondary" className="capitalize">
                    {org?.defaultJoinMode || "Invite"}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
          {isOwner && (
            <CardFooter className="border-t pt-6">
              <Button
                onClick={handleSaveGeneralSettings}
                disabled={!generalDirty || updateOrgSettings.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateOrgSettings.isPending ? "Saving..." : "Save Settings"}
              </Button>
            </CardFooter>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Join Form Configuration
            </CardTitle>
            <CardDescription>
              Configure the profile fields members fill out when joining
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

            {fields.length === 0 ? (
              <div className="rounded-lg border p-8 text-center">
                <Globe className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-medium">No Custom Fields</h3>
                <p className="mt-2 text-sm text-muted-foreground">
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
          </CardContent>
          {fields.length > 0 && (
            <CardFooter className="flex justify-between border-t pt-6">
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
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}

// =============================================================================
// Form Field Editor Component
// =============================================================================

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
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
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
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${field.id}-type`}>Type</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onUpdate({ type: v as FormFieldType })}
          >
            <SelectTrigger id={`${field.id}-type`}>
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

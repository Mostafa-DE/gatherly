import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateTimePicker } from "@/components/ui/datetime-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sparkles, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { useAISuggestion } from "@/plugins/ai/hooks/use-ai-suggestion"
import { FormFieldEditor, useFormFields } from "@/components/form-field-editor"
import { useActivityContext } from "@/hooks/use-activity-context"
import type { JoinFormSchema } from "@/types/form"

export const Route = createFileRoute("/dashboard/org/$orgId/sessions/create")({
  component: CreateSessionPage,
})

const getDefaultDateTime = () => {
  const date = new Date()
  date.setSeconds(0, 0)
  date.setMinutes(0)
  date.setHours(date.getHours() + 1)
  return date
}

const SESSION_JOIN_MODES = [
  { value: "open", label: "Open", description: "Members can join directly" },
  {
    value: "approval_required",
    label: "Approval Required",
    description: "Members request to join, admins approve",
  },
  {
    value: "invite_only",
    label: "Invite Only",
    description: "Only admins can add participants",
  },
] as const

function CreateSessionPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dateTime, setDateTime] = useState<Date | undefined>(getDefaultDateTime)
  const [location, setLocation] = useState("")
  const [maxCapacity, setMaxCapacity] = useState("20")
  const [maxWaitlist, setMaxWaitlist] = useState("0")
  const [joinMode, setJoinMode] = useState<
    "open" | "approval_required" | "invite_only"
  >("open")
  const [price, setPrice] = useState("")
  const [showJoinForm, setShowJoinForm] = useState(false)
  const [error, setError] = useState("")

  const joinForm = useFormFields([])

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: orgSettings } = trpc.organizationSettings.get.useQuery({}, { enabled: isAdmin })
  const orgCurrency = orgSettings?.currency

  const { activities, isMultiActivity, selectedActivityId, defaultActivityId } =
    useActivityContext(orgId)

  const [selectedActivity, setSelectedActivity] = useState<string>("")

  // Set initial activity from sidebar selection or default
  const effectiveActivityId = selectedActivity || selectedActivityId || defaultActivityId || ""

  const {
    suggest: suggestDesc,
    streamedText,
    isStreaming,
    isPending: aiPending,
    error: aiError,
    clearError: clearAiError,
    isAvailable: aiAvailable,
  } = useAISuggestion({
    onComplete: (text) => setDescription(text),
  })

  const createSession = trpc.session.create.useMutation({
    onSuccess: (data) => {
      utils.session.list.invalidate()
      utils.session.listUpcoming.invalidate()
      utils.session.listDraftsWithCounts.invalidate()
      navigate({ to: "/dashboard/org/$orgId/sessions/$sessionId", params: { orgId, sessionId: data.id } })
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  if (whoamiLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
              Only group owners and admins can create sessions.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard/org/$orgId/sessions" params={{ orgId }}>
                Back to Sessions
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!title.trim()) {
      setError("Title is required")
      return
    }
    if (!dateTime) {
      setError("Date and time is required")
      return
    }

    const capacity = parseInt(maxCapacity, 10)
    const waitlist = parseInt(maxWaitlist, 10)

    if (isNaN(capacity) || capacity < 1) {
      setError("Capacity must be at least 1")
      return
    }
    if (isNaN(waitlist) || waitlist < 0) {
      setError("Waitlist must be 0 or greater")
      return
    }

    // Validate price format if provided
    const trimmedPrice = price.trim()
    if (trimmedPrice && !/^\d+(\.\d{1,2})?$/.test(trimmedPrice)) {
      setError("Invalid price format. Use a number like 25 or 25.00")
      return
    }
    if (trimmedPrice && !orgCurrency) {
      setError("Please set a currency in group settings before adding a price")
      return
    }

    // Validate join form fields
    for (const field of joinForm.fields) {
      if (!field.label.trim()) {
        setError("All join form fields must have a label")
        return
      }
      if (
        (field.type === "select" || field.type === "multiselect") &&
        (!field.options || field.options.length === 0)
      ) {
        setError(`Field "${field.label}" needs at least one option`)
        return
      }
    }

    const joinFormSchema: JoinFormSchema | null =
      joinForm.fields.length > 0 ? { fields: joinForm.fields } : null

    if (!effectiveActivityId) {
      setError("No activity found. Please create an activity first.")
      return
    }

    createSession.mutate({
      activityId: effectiveActivityId,
      title: title.trim(),
      description: description.trim() || undefined,
      dateTime,
      location: location.trim() || undefined,
      maxCapacity: capacity,
      maxWaitlist: waitlist,
      joinMode,
      price: trimmedPrice || null,
      joinFormSchema,
    })
  }

  const timezoneLabel =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "Local time"

  return (
    <div className="py-4">
      <div className="mx-auto max-w-2xl">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Create Session</CardTitle>
              <CardDescription>
                Create a new session for your group. Sessions start in
                draft status.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {isMultiActivity && (
                <div className="space-y-2">
                  <Label htmlFor="activity">Activity *</Label>
                  <Select
                    value={effectiveActivityId}
                    onValueChange={setSelectedActivity}
                  >
                    <SelectTrigger id="activity">
                      <SelectValue placeholder="Select activity" />
                    </SelectTrigger>
                    <SelectContent>
                      {activities.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Weekly Meetup"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description">Description</Label>
                  {aiAvailable && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!title.trim() || aiPending}
                      onClick={() => {
                        clearAiError()
                        suggestDesc({
                          sessionTitle: title.trim(),
                          location: location.trim() || undefined,
                          dateTime: dateTime || undefined,
                        })
                      }}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {isStreaming ? "Thinking..." : "Suggest Description"}
                    </Button>
                  )}
                </div>
                {aiError && (
                  <div className="rounded-md bg-destructive/15 p-2 text-xs text-destructive">
                    {aiError}
                  </div>
                )}
                <textarea
                  id="description"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-popover px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                  placeholder="Tell participants what this session is about..."
                  value={isStreaming ? streamedText : description}
                  onChange={(e) => setDescription(e.target.value)}
                  readOnly={isStreaming}
                />
              </div>

              <div className="space-y-2">
                <div>
                  <Label>Date & Time *</Label>
                  <p className="text-xs text-muted-foreground">
                    Timezone: {timezoneLabel}
                  </p>
                </div>
                <DateTimePicker
                  value={dateTime}
                  onChange={setDateTime}
                  placeholder="Pick date and time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="Conference Room A or https://zoom.us/..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxCapacity">Max Capacity *</Label>
                  <Input
                    id="maxCapacity"
                    type="number"
                    min="1"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of participants
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxWaitlist">Waitlist Size</Label>
                  <Input
                    id="maxWaitlist"
                    type="number"
                    min="0"
                    value={maxWaitlist}
                    onChange={(e) => setMaxWaitlist(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set to 0 to disable waitlist
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinMode">Join Mode</Label>
                <Select
                  value={joinMode}
                  onValueChange={(value) =>
                    setJoinMode(
                      value as "open" | "approval_required" | "invite_only"
                    )
                  }
                >
                  <SelectTrigger id="joinMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_JOIN_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label} - {mode.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">
                  Price {orgCurrency && `(${orgCurrency})`}
                </Label>
                {orgCurrency ? (
                  <>
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty for free sessions
                    </p>
                  </>
                ) : (
                  <div className="rounded-md border bg-muted/50 p-3">
                    <p className="text-sm text-muted-foreground">
                      No currency configured.{" "}
                      <Link
                        to="/dashboard/org/$orgId/settings"
                        params={{ orgId }}
                        className="text-primary font-medium hover:underline"
                      >
                        Set currency in settings
                      </Link>{" "}
                      to enable pricing.
                    </p>
                  </div>
                )}
              </div>

              {/* Join Form (optional) */}
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setShowJoinForm(!showJoinForm)}
                >
                  <div>
                    <Label className="cursor-pointer">Join Form (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      {joinForm.fields.length > 0
                        ? `${joinForm.fields.length} field${joinForm.fields.length !== 1 ? "s" : ""} configured`
                        : "Add custom fields members fill when joining"}
                    </p>
                  </div>
                  {showJoinForm ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {showJoinForm && (
                  <div className="space-y-3 rounded-lg border border-border/50 p-4">
                    {joinForm.fields.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          No form fields yet. Add fields that members will fill out when joining this session.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={joinForm.addField}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Field
                        </Button>
                      </div>
                    ) : (
                      <>
                        {joinForm.fields.map((field, index) => (
                          <FormFieldEditor
                            key={field.id}
                            field={field}
                            index={index}
                            totalFields={joinForm.fields.length}
                            onUpdate={(updates) => joinForm.updateField(field.id, updates)}
                            onRemove={() => joinForm.removeField(field.id)}
                            onMoveUp={() => joinForm.moveField(index, "up")}
                            onMoveDown={() => joinForm.moveField(index, "down")}
                          />
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={joinForm.addField}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Field
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" type="button" asChild>
                <Link to="/dashboard/org/$orgId/sessions" params={{ orgId }}>
                  Cancel
                </Link>
              </Button>
              <Button type="submit" disabled={createSession.isPending}>
                {createSession.isPending ? "Creating..." : "Create Session"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

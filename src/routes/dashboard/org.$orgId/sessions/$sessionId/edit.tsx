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
import { Skeleton } from "@/components/ui/skeleton"
import { DateTimePicker } from "@/components/ui/datetime-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/sessions/$sessionId/edit"
)({
  component: EditSessionPage,
})

type SessionForm = {
  title: string
  description: string
  dateTime: Date | undefined
  location: string
  maxCapacity: string
  maxWaitlist: string
  joinMode: "open" | "approval_required" | "invite_only"
  price: string
}

type SessionFormDraft = {
  sessionId: string
  values: SessionForm
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

function normalizeJoinMode(
  value: string
): "open" | "approval_required" | "invite_only" {
  if (value === "approval_required" || value === "invite_only") {
    return value
  }
  return "open"
}

function EditSessionPage() {
  const { orgId, sessionId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [formDraft, setFormDraft] = useState<SessionFormDraft | null>(null)
  const [error, setError] = useState("")

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: orgSettings } = trpc.organizationSettings.get.useQuery({}, { enabled: isAdmin })
  const orgCurrency = orgSettings?.currency

  const {
    data: sessionData,
    isLoading: sessionLoading,
    error: sessionError,
  } = trpc.session.getById.useQuery({ sessionId })

  const updateSession = trpc.session.update.useMutation({
    onSuccess: () => {
      utils.session.getById.invalidate({ sessionId })
      utils.session.getWithCounts.invalidate({ sessionId })
      utils.session.list.invalidate()
      utils.session.listUpcoming.invalidate()
      utils.session.listPast.invalidate()
      utils.session.listDraftsWithCounts.invalidate()
      navigate({
        to: "/dashboard/org/$orgId/sessions/$sessionId",
        params: { orgId, sessionId },
      })
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  if (whoamiLoading || sessionLoading) {
    return (
      <div className="py-4">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (sessionError || !sessionData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>
              {sessionError?.message || "This session doesn't exist or has been deleted."}
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

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only group owners and admins can edit sessions.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link
                to="/dashboard/org/$orgId/sessions/$sessionId"
                params={{ orgId, sessionId }}
              >
                Back to Session
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Cannot edit completed or cancelled sessions
  if (sessionData.status === "completed" || sessionData.status === "cancelled") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Cannot Edit Session</CardTitle>
            <CardDescription>
              Sessions that are {sessionData.status} cannot be modified.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link
                to="/dashboard/org/$orgId/sessions/$sessionId"
                params={{ orgId, sessionId }}
              >
                Back to Session
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const initialForm: SessionForm = {
    title: sessionData.title,
    description: sessionData.description || "",
    dateTime: new Date(sessionData.dateTime),
    location: sessionData.location || "",
    maxCapacity: String(sessionData.maxCapacity),
    maxWaitlist: String(sessionData.maxWaitlist),
    joinMode: normalizeJoinMode(sessionData.joinMode),
    price: sessionData.price || "",
  }

  const form =
    formDraft?.sessionId === sessionId
      ? formDraft.values
      : initialForm

  const setFormField = <K extends keyof SessionForm>(
    key: K,
    value: SessionForm[K]
  ) => {
    setFormDraft((prev) => {
      const baseValues =
        prev?.sessionId === sessionId
          ? prev.values
          : initialForm

      return {
        sessionId,
        values: {
          ...baseValues,
          [key]: value,
        },
      }
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.title.trim()) {
      setError("Title is required")
      return
    }
    if (!form.dateTime) {
      setError("Date and time is required")
      return
    }

    const capacity = parseInt(form.maxCapacity, 10)
    const waitlist = parseInt(form.maxWaitlist, 10)

    if (isNaN(capacity) || capacity < 1) {
      setError("Capacity must be at least 1")
      return
    }
    if (isNaN(waitlist) || waitlist < 0) {
      setError("Waitlist must be 0 or greater")
      return
    }

    // Validate price format if provided
    const trimmedPrice = form.price.trim()
    if (trimmedPrice && !/^\d+(\.\d{1,2})?$/.test(trimmedPrice)) {
      setError("Invalid price format. Use a number like 25 or 25.00")
      return
    }
    if (trimmedPrice && !orgCurrency) {
      setError("Please set a currency in group settings before adding a price")
      return
    }

    updateSession.mutate({
      sessionId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      dateTime: form.dateTime,
      location: form.location.trim() || null,
      maxCapacity: capacity,
      maxWaitlist: waitlist,
      joinMode: form.joinMode,
      price: trimmedPrice || null,
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
              <CardTitle>Edit Session</CardTitle>
              <CardDescription>
                Update the details for this session.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  type="text"
                  placeholder="Weekly Meetup"
                  value={form.title}
                  onChange={(e) => setFormField("title", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-popover px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                  placeholder="Tell participants what this session is about..."
                  value={form.description}
                  onChange={(e) => setFormField("description", e.target.value)}
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
                  value={form.dateTime}
                  onChange={(value) => setFormField("dateTime", value)}
                  placeholder="Pick date and time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="Conference Room A or https://zoom.us/..."
                  value={form.location}
                  onChange={(e) => setFormField("location", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxCapacity">Max Capacity *</Label>
                  <Input
                    id="maxCapacity"
                    type="number"
                    min="1"
                    value={form.maxCapacity}
                    onChange={(e) => setFormField("maxCapacity", e.target.value)}
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
                    value={form.maxWaitlist}
                    onChange={(e) => setFormField("maxWaitlist", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Set to 0 to disable waitlist
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinMode">Join Mode</Label>
                <Select
                  value={form.joinMode}
                  onValueChange={(value) =>
                    setFormField(
                      "joinMode",
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
                      value={form.price}
                      onChange={(e) => setFormField("price", e.target.value)}
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
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" type="button" asChild>
                <Link
                  to="/dashboard/org/$orgId/sessions/$sessionId"
                  params={{ orgId, sessionId }}
                >
                  Cancel
                </Link>
              </Button>
              <Button type="submit" disabled={updateSession.isPending}>
                {updateSession.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

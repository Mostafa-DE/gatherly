import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/sessions/$sessionId/edit"
)({
  component: EditSessionPage,
})

function EditSessionPage() {
  const { orgId, sessionId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dateTime, setDateTime] = useState("")
  const [location, setLocation] = useState("")
  const [maxCapacity, setMaxCapacity] = useState("")
  const [maxWaitlist, setMaxWaitlist] = useState("")
  const [error, setError] = useState("")

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const {
    data: sessionData,
    isLoading: sessionLoading,
    error: sessionError,
  } = trpc.session.getById.useQuery({ sessionId })

  // Populate form when session data loads
  useEffect(() => {
    if (sessionData) {
      setTitle(sessionData.title)
      setDescription(sessionData.description || "")
      // Format datetime for datetime-local input
      const dt = new Date(sessionData.dateTime)
      const localDateTime = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
      setDateTime(localDateTime)
      setLocation(sessionData.location || "")
      setMaxCapacity(String(sessionData.maxCapacity))
      setMaxWaitlist(String(sessionData.maxWaitlist))
    }
  }, [sessionData])

  const updateSession = trpc.session.update.useMutation({
    onSuccess: () => {
      utils.session.getById.invalidate({ sessionId })
      utils.session.getWithCounts.invalidate({ sessionId })
      utils.session.list.invalidate()
      utils.session.listUpcoming.invalidate()
      utils.session.listPast.invalidate()
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
              Only organization owners and admins can edit sessions.
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

    updateSession.mutate({
      sessionId,
      title: title.trim(),
      description: description.trim() || null,
      dateTime: new Date(dateTime),
      location: location.trim() || null,
      maxCapacity: capacity,
      maxWaitlist: waitlist,
    })
  }

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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Tell participants what this session is about..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateTime">Date & Time *</Label>
                <Input
                  id="dateTime"
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  required
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

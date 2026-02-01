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

export const Route = createFileRoute("/dashboard/org/$orgId/sessions/create")({
  component: CreateSessionPage,
})

function CreateSessionPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dateTime, setDateTime] = useState("")
  const [location, setLocation] = useState("")
  const [maxCapacity, setMaxCapacity] = useState("20")
  const [maxWaitlist, setMaxWaitlist] = useState("0")
  const [error, setError] = useState("")

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const createSession = trpc.session.create.useMutation({
    onSuccess: (data) => {
      utils.session.list.invalidate()
      utils.session.listUpcoming.invalidate()
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
              Only organization owners and admins can create sessions.
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

    createSession.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      dateTime: new Date(dateTime),
      location: location.trim() || undefined,
      maxCapacity: capacity,
      maxWaitlist: waitlist,
      joinMode: "open",
    })
  }

  return (
    <div className="py-4">
      <div className="mx-auto max-w-2xl">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Create Session</CardTitle>
              <CardDescription>
                Create a new session for your organization. Sessions start in
                draft status.
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

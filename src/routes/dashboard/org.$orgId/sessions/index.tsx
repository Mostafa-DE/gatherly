import { createFileRoute, Link } from "@tanstack/react-router"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Plus, Calendar, MapPin, Users, ChevronDown } from "lucide-react"

export const Route = createFileRoute("/dashboard/org/$orgId/sessions/")({
  component: SessionsPage,
})

function SessionsPage() {
  const { orgId } = Route.useParams()
  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground">
            Browse and join sessions in your organization
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/dashboard/org/$orgId/sessions/create" params={{ orgId }}>
              <Plus className="mr-2 h-4 w-4" />
              Create Session
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingSessions orgId={orgId} />
        <PastSessions orgId={orgId} />
      </div>
    </div>
  )
}

const PAGE_SIZE = 10

function UpcomingSessions({ orgId }: { orgId: string }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { data: sessions, isLoading, error, isFetching } = trpc.session.listUpcoming.useQuery({
    limit,
  })

  const hasMore = sessions && sessions.length === limit

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Sessions</CardTitle>
        <CardDescription>Sessions you can join</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">{error.message}</p>
        )}
        {sessions && sessions.length === 0 && (
          <p className="text-muted-foreground">No upcoming sessions</p>
        )}
        {sessions && sessions.length > 0 && (
          <div className="space-y-4">
            {sessions.map((session, index) => (
              <div key={session.id}>
                {index > 0 && <Separator className="my-4" />}
                <SessionCard session={session} orgId={orgId} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {hasMore && (
        <CardFooter className="border-t pt-4">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function PastSessions({ orgId }: { orgId: string }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { data: sessions, isLoading, error, isFetching } = trpc.session.listPast.useQuery({
    limit,
  })

  const hasMore = sessions && sessions.length === limit

  return (
    <Card>
      <CardHeader>
        <CardTitle>Past Sessions</CardTitle>
        <CardDescription>Completed and cancelled sessions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">{error.message}</p>
        )}
        {sessions && sessions.length === 0 && (
          <p className="text-muted-foreground">No past sessions</p>
        )}
        {sessions && sessions.length > 0 && (
          <div className="space-y-4">
            {sessions.map((session, index) => (
              <div key={session.id}>
                {index > 0 && <Separator className="my-4" />}
                <SessionCard session={session} orgId={orgId} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {hasMore && (
        <CardFooter className="border-t pt-4">
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

type SessionCardProps = {
  session: {
    id: string
    title: string
    description: string | null
    dateTime: Date
    location: string | null
    status: string
    maxCapacity: number
    maxWaitlist: number
  }
  orgId: string
}

function SessionCard({ session, orgId }: SessionCardProps) {
  const statusVariant = (status: string) => {
    switch (status) {
      case "published":
        return "default"
      case "draft":
        return "secondary"
      case "cancelled":
        return "destructive"
      case "completed":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <Link
      to="/dashboard/org/$orgId/sessions/$sessionId"
      params={{ orgId, sessionId: session.id }}
      className="block space-y-2 rounded-lg p-2 -m-2 hover:bg-muted transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="font-medium hover:underline">{session.title}</span>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(session.dateTime).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {session.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {session.location}
              </span>
            )}
          </div>
        </div>
        <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
      </div>
      {session.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {session.description}
        </p>
      )}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Capacity: {session.maxCapacity}
        </span>
        {session.maxWaitlist > 0 && (
          <span>Waitlist: {session.maxWaitlist}</span>
        )}
      </div>
    </Link>
  )
}

import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Calendar, MapPin, ChevronDown, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, hasPrice } from "@/lib/format-price"

export const Route = createFileRoute("/dashboard/org/$orgId/sessions/")({
  component: SessionsPage,
})

function SessionsPage() {
  const { orgId } = Route.useParams()
  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"
  const isOwner = whoami?.membership?.role === "owner"
  const org = whoami?.activeOrganization

  const { data: orgSettings } = trpc.organizationSettings.get.useQuery({})
  const orgCurrency = orgSettings?.currency || null

  return (
    <div className="space-y-10 py-6">
      {/* Hero Section */}
      <div>
        {/* Badge */}
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <Calendar className="mr-2 h-3.5 w-3.5" />
          Sessions
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Manage{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Sessions
              </span>
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              Browse, join, and manage all sessions in {org?.name}
            </p>
          </div>
          {isAdmin && (
            <Button asChild>
              <Link to="/dashboard/org/$orgId/sessions/create" params={{ orgId }}>
                <Plus className="mr-2 h-4 w-4" />
                New Session
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Draft Sessions */}
      <DraftSessions orgId={orgId} isOwner={isOwner} currency={orgCurrency} />

      {/* Upcoming Sessions */}
      <UpcomingSessions orgId={orgId} currency={orgCurrency} />

      {/* Past Sessions */}
      <PastSessions orgId={orgId} currency={orgCurrency} />
    </div>
  )
}

const PAGE_SIZE = 10

function DraftSessions({ orgId, isOwner, currency }: { orgId: string; isOwner: boolean; currency: string | null }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { data: sessions, isLoading, error, isFetching } =
    trpc.session.listDraftsWithCounts.useQuery(
      { limit },
      { enabled: isOwner }
    )

  if (!isOwner) {
    return null
  }

  const hasMore = sessions && sessions.length === limit

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Draft Sessions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Draft Sessions</h2>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Draft Sessions</h2>
        <p className="text-muted-foreground">No draft sessions</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        {sessions.length} draft session{sessions.length !== 1 ? "s" : ""}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} orgId={orgId} currency={currency} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}

function UpcomingSessions({ orgId, currency }: { orgId: string; currency: string | null }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { data: sessions, isLoading, error, isFetching } = trpc.session.listUpcomingWithCounts.useQuery({
    limit,
  })

  const hasMore = sessions && sessions.length === limit

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Upcoming Sessions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Upcoming Sessions</h2>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Upcoming Sessions</h2>
        <p className="text-muted-foreground">No upcoming sessions</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">
        {sessions.length} upcoming session{sessions.length !== 1 ? "s" : ""}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} orgId={orgId} currency={currency} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}

function PastSessions({ orgId, currency }: { orgId: string; currency: string | null }) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { data: sessions, isLoading, error, isFetching } = trpc.session.listPastWithCounts.useQuery({
    limit,
  })

  const hasMore = sessions && sessions.length === limit

  if (isLoading) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Past Sessions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Past Sessions</h2>
        <p className="text-sm text-destructive">{error.message}</p>
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return null // Don't show past sessions section if empty
  }

  return (
    <div>
      <h2 className="mb-4 text-sm font-medium text-muted-foreground">Past Sessions</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sessions.map((session) => (
          <SessionCard key={session.id} session={session} orgId={orgId} isPast currency={currency} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}

type SessionWithCounts = {
  id: string
  title: string
  description: string | null
  dateTime: Date
  location: string | null
  status: string
  maxCapacity: number
  maxWaitlist: number
  price: string | null
  joinedCount: number
  waitlistCount: number
  participants: Array<{
    id: string
    name: string | null
    image: string | null
  }>
}

function SessionCard({
  session,
  orgId,
  isPast = false,
  currency,
}: {
  session: SessionWithCounts
  orgId: string
  isPast?: boolean
  currency: string | null
}) {
  const spotsLeft = session.maxCapacity - session.joinedCount
  const capacityPercent = (session.joinedCount / session.maxCapacity) * 100

  // Determine status badge
  const getStatusBadge = () => {
  if (session.status === "cancelled") {
    return { text: "Cancelled", className: "bg-destructive/10 text-destructive" }
  }
  if (session.status === "completed") {
    return { text: "Completed", className: "bg-muted text-muted-foreground" }
  }
  if (session.status === "draft") {
    return { text: "Draft", className: "bg-yellow-500/10 text-yellow-600" }
  }
  if (isPast) {
    return { text: "Past", className: "bg-muted text-muted-foreground" }
  }
    if (spotsLeft === 0) {
      return { text: "Full", className: "bg-destructive/10 text-destructive" }
    }
    if (spotsLeft <= 2) {
      return { text: `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`, className: "bg-yellow-500/10 text-yellow-600" }
    }
    return { text: "Open", className: "bg-green-500/10 text-green-600" }
  }

  const statusBadge = getStatusBadge()
  const dateObj = new Date(session.dateTime)

  // Avatar colors for participants without images
  const avatarColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-amber-500",
    "bg-rose-500",
  ]

  // Get initials from name
  const getInitials = (name: string | null) => {
    if (!name) return "?"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <Link
      to="/dashboard/org/$orgId/sessions/$sessionId"
      params={{ orgId, sessionId: session.id }}
      className="group block rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg"
    >
      {/* Header: Date and Status */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Calendar className="h-5 w-5 text-primary group-hover:text-primary-foreground" />
          </div>
          <div>
            <p className="font-medium">
              {dateObj.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {dateObj.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              statusBadge.className
            )}
          >
            {statusBadge.text}
          </span>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              hasPrice(session.price)
                ? "bg-primary/10 text-primary"
                : "bg-green-500/10 text-green-600"
            )}
          >
            <Tag className="h-3 w-3" />
            {formatPrice(session.price, currency)}
          </span>
        </div>
      </div>

      {/* Location */}
      {session.location && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{session.location}</span>
        </div>
      )}

      {/* Capacity bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted-foreground">Capacity</span>
          <span className="font-medium">
            {session.joinedCount}/{session.maxCapacity}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isPast || session.status === "cancelled"
                ? "bg-muted-foreground/50"
                : "bg-primary"
            )}
            style={{ width: `${Math.min(capacityPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Attendees and View roster */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {session.participants.slice(0, 4).map((participant, i) => (
            <div
              key={participant.id}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs font-medium",
                participant.image
                  ? ""
                  : `${avatarColors[i % avatarColors.length]} text-white`
              )}
            >
              {participant.image ? (
                <img
                  src={participant.image}
                  alt={participant.name ?? ""}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                getInitials(participant.name)
              )}
            </div>
          ))}
          {session.joinedCount > 4 && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium">
              +{session.joinedCount - 4}
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-primary">
          View roster &rarr;
        </span>
      </div>
    </Link>
  )
}

function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mb-3 h-4 w-40" />
      <div className="mb-3">
        <div className="mb-1 flex justify-between">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

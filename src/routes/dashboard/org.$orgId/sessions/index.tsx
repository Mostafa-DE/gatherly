import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Plus,
  Calendar,
  MapPin,
  ChevronDown,
  Tag,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, hasPrice } from "@/lib/format-price"

export const Route = createFileRoute("/dashboard/org/$orgId/sessions/")({
  component: SessionsPage,
})

/* ─────────────────────────── helpers ─────────────────────────── */

const avatarColors = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
]

function getInitials(name: string | null) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/* ─────────────────────────── main page ─────────────────────────── */

function SessionsPage() {
  const { orgId } = Route.useParams()
  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin =
    whoami?.membership?.role === "owner" ||
    whoami?.membership?.role === "admin"

  const { data: orgSettings } = trpc.organizationSettings.get.useQuery({})
  const orgCurrency = orgSettings?.currency || null
  const { data: pendingApprovals } = trpc.participation.pendingApprovalsSummary.useQuery(
    { limit: 3 },
    { enabled: isAdmin }
  )

  return (
    <div className="space-y-8 py-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
        {isAdmin && (
          <Button asChild>
            <Link
              to="/dashboard/org/$orgId/sessions/create"
              params={{ orgId }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Session
            </Link>
          </Button>
        )}
      </div>

      {isAdmin && pendingApprovals && pendingApprovals.totalPending > 0 && (
        <PendingApprovalsNotice orgId={orgId} summary={pendingApprovals} />
      )}

      {/* Draft Sessions */}
      <DraftSessions orgId={orgId} isAdmin={isAdmin} currency={orgCurrency} />

      {/* Upcoming Sessions */}
      <UpcomingSessions orgId={orgId} currency={orgCurrency} />

      {/* Past Sessions */}
      <PastSessions orgId={orgId} currency={orgCurrency} />
    </div>
  )
}

/* ─────────────────────────── section components ─────────────────────────── */

const PAGE_SIZE = 10

type PendingApprovalsSummary = {
  totalPending: number
  sessionsWithPending: number
  sessions: Array<{
    sessionId: string
    title: string
    dateTime: Date
    pendingCount: number
  }>
}

function PendingApprovalsNotice({
  orgId,
  summary,
}: {
  orgId: string
  summary: PendingApprovalsSummary
}) {
  const hiddenSessionCount = Math.max(0, summary.sessionsWithPending - summary.sessions.length)

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-500">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm font-semibold">
            {summary.totalPending} session approval request{summary.totalPending !== 1 ? "s" : ""} need review
          </p>
        </div>
        <Badge className="bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-0">
          {summary.sessionsWithPending} session{summary.sessionsWithPending !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {summary.sessions.map((session) => (
          <Button key={session.sessionId} size="sm" variant="outline" asChild>
            <Link
              to="/dashboard/org/$orgId/sessions/$sessionId/participants"
              params={{ orgId, sessionId: session.sessionId }}
            >
              {session.title} ({session.pendingCount})
            </Link>
          </Button>
        ))}
        {hiddenSessionCount > 0 && (
          <span className="inline-flex items-center text-xs text-muted-foreground">
            +{hiddenSessionCount} more
          </span>
        )}
      </div>
    </div>
  )
}

function DraftSessions({
  orgId,
  isAdmin,
  currency,
}: {
  orgId: string
  isAdmin: boolean
  currency: string | null
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const {
    data: sessions,
    isLoading,
    error,
    isFetching,
  } = trpc.session.listDraftsWithCounts.useQuery(
    { limit },
    { enabled: isAdmin }
  )

  if (!isAdmin) return null

  const hasMore = sessions && sessions.length === limit

  if (isLoading) {
    return (
      <SessionSection title="Drafts">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </SessionSection>
    )
  }

  if (error) {
    return (
      <SessionSection title="Drafts">
        <p className="text-sm text-destructive">{error.message}</p>
      </SessionSection>
    )
  }

  if (!sessions || sessions.length === 0) return null

  return (
    <SessionSection title="Drafts" count={sessions.length}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            orgId={orgId}
            currency={currency}
          />
        ))}
      </div>
      {hasMore && (
        <LoadMoreButton
          onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
          loading={isFetching}
        />
      )}
    </SessionSection>
  )
}

function UpcomingSessions({
  orgId,
  currency,
}: {
  orgId: string
  currency: string | null
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const {
    data: sessions,
    isLoading,
    error,
    isFetching,
  } = trpc.session.listUpcomingWithCounts.useQuery({ limit })

  const hasMore = sessions && sessions.length === limit

  if (isLoading) {
    return (
      <SessionSection title="Upcoming">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </SessionSection>
    )
  }

  if (error) {
    return (
      <SessionSection title="Upcoming">
        <p className="text-sm text-destructive">{error.message}</p>
      </SessionSection>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <SessionSection title="Upcoming">
        <div className="rounded-xl border bg-card p-10 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <p className="font-medium">No upcoming sessions</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back later for new sessions
          </p>
        </div>
      </SessionSection>
    )
  }

  return (
    <SessionSection title="Upcoming" count={sessions.length}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            orgId={orgId}
            currency={currency}
          />
        ))}
      </div>
      {hasMore && (
        <LoadMoreButton
          onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
          loading={isFetching}
        />
      )}
    </SessionSection>
  )
}

function PastSessions({
  orgId,
  currency,
}: {
  orgId: string
  currency: string | null
}) {
  const [limit, setLimit] = useState(PAGE_SIZE)

  const {
    data: sessions,
    isLoading,
    error,
    isFetching,
  } = trpc.session.listPastWithCounts.useQuery({ limit })

  const hasMore = sessions && sessions.length === limit

  if (isLoading) {
    return (
      <SessionSection title="Past">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2].map((i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </SessionSection>
    )
  }

  if (error) {
    return (
      <SessionSection title="Past">
        <p className="text-sm text-destructive">{error.message}</p>
      </SessionSection>
    )
  }

  if (!sessions || sessions.length === 0) return null

  return (
    <SessionSection title="Past" count={sessions.length}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            orgId={orgId}
            isPast
            currency={currency}
          />
        ))}
      </div>
      {hasMore && (
        <LoadMoreButton
          onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
          loading={isFetching}
        />
      )}
    </SessionSection>
  )
}

/* ─────────────────────────── shared components ─────────────────────────── */

function SessionSection({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="text-sm text-muted-foreground">
            {count} session{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function LoadMoreButton({
  onClick,
  loading,
}: {
  onClick: () => void
  loading: boolean
}) {
  return (
    <div className="mt-4 text-center">
      <Button variant="ghost" size="sm" onClick={onClick} disabled={loading}>
        <ChevronDown className="h-4 w-4 mr-1.5" />
        {loading ? "Loading..." : "Load More"}
      </Button>
    </div>
  )
}

/* ─────────────────────────── session card ─────────────────────────── */

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
  const dateObj = new Date(session.dateTime)

  return (
    <Link
      to="/dashboard/org/$orgId/sessions/$sessionId"
      params={{ orgId, sessionId: session.id }}
      className="group block rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
    >
      {/* Title + status */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold leading-snug min-w-0 truncate">
          {session.title}
        </h3>
        <SessionStatusBadge
          status={session.status}
          spotsLeft={spotsLeft}
          isPast={isPast}
        />
      </div>

      {/* Description */}
      {session.description && (
        <p className="mb-3 text-sm text-muted-foreground line-clamp-2 overflow-hidden break-words">
          {session.description}
        </p>
      )}

      {/* Date + time */}
      <div className="mb-3 flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">
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

      {/* Location + price */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {session.location && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{session.location}</span>
          </span>
        )}
        <span
          className={cn(
            "flex items-center gap-1 font-medium",
            hasPrice(session.price)
              ? "text-foreground"
              : "text-[var(--color-status-success)]"
          )}
        >
          <Tag className="h-3 w-3" />
          {formatPrice(session.price, currency)}
        </span>
      </div>

      {/* Capacity */}
      <div className="mb-3">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-muted-foreground">Capacity</span>
          <span className="font-medium tabular-nums">
            {session.joinedCount}/{session.maxCapacity}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              isPast || session.status === "cancelled"
                ? "bg-muted-foreground/50"
                : capacityPercent >= 100
                  ? "bg-[var(--color-status-danger)]"
                  : capacityPercent >= 80
                    ? "bg-[var(--color-status-warning)]"
                    : "bg-primary"
            )}
            style={{ width: `${Math.min(capacityPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Participants + View session */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {session.participants.slice(0, 4).map((participant, i) => (
            <div
              key={participant.id}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-medium",
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
            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium tabular-nums">
              +{session.joinedCount - 4}
            </div>
          )}
        </div>
        <span className="text-sm font-medium text-primary transition-colors group-hover:text-primary/80">
          View session →
        </span>
      </div>
    </Link>
  )
}

/* ─────────────────────────── status badge ─────────────────────────── */

function SessionStatusBadge({
  status,
  spotsLeft,
  isPast,
}: {
  status: string
  spotsLeft: number
  isPast: boolean
}) {
  if (status === "cancelled") {
    return (
      <Badge className="bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)] border-0 text-xs">
        Cancelled
      </Badge>
    )
  }
  if (status === "completed") {
    return (
      <Badge className="bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)] border-0 text-xs">
        Completed
      </Badge>
    )
  }
  if (status === "draft") {
    return (
      <Badge className="bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)] border-0 text-xs">
        Draft
      </Badge>
    )
  }
  if (isPast) {
    return (
      <Badge className="bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)] border-0 text-xs">
        Past
      </Badge>
    )
  }
  if (spotsLeft === 0) {
    return (
      <Badge className="bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)] border-0 text-xs">
        Full
      </Badge>
    )
  }
  if (spotsLeft <= 3) {
    return (
      <Badge className="bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)] border-0 text-xs">
        {spotsLeft} left
      </Badge>
    )
  }
  return (
    <Badge className="bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)] border-0 text-xs">
      Open
    </Badge>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-1 h-4 w-16" />
          </div>
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="mb-3 h-4 w-32" />
      <div className="mb-3">
        <div className="mb-1.5 flex justify-between">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-7 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

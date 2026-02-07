import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ShareDialog } from "@/components/share-dialog"
import {
  Calendar,
  Users,
  ArrowRight,
  MapPin,
  TrendingUp,
  Plus,
  Crown,
  ShieldCheck,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buildOrgUrl } from "@/lib/share-urls"

export const Route = createFileRoute("/dashboard/org/$orgId/")({
  component: OrgOverviewPage,
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

function RoleBadge({ role }: { role: string }) {
  const config = {
    owner: {
      icon: Crown,
      label: "Owner",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    admin: {
      icon: ShieldCheck,
      label: "Admin",
      className: "bg-primary/10 text-primary",
    },
    member: {
      icon: User,
      label: "Member",
      className: "bg-muted text-muted-foreground",
    },
  }[role] ?? {
    icon: User,
    label: role,
    className: "bg-muted text-muted-foreground",
  }

  const Icon = config.icon

  return (
    <span
      className={cn(
        "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        config.className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  )
}

/* ─────────────────────────── main page ─────────────────────────── */

function OrgOverviewPage() {
  const { orgId } = Route.useParams()
  const { data: whoami, isLoading: whoamiLoading } =
    trpc.user.whoami.useQuery()
  const { data: upcomingSessions, isLoading: sessionsLoading } =
    trpc.session.listUpcomingWithCounts.useQuery({
      limit: 3,
    })

  const isAdmin =
    whoami?.membership?.role === "owner" ||
    whoami?.membership?.role === "admin"

  if (whoamiLoading) {
    return (
      <div className="space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  const org = whoami?.activeOrganization
  const role = whoami?.membership?.role

  return (
    <div className="space-y-6 py-6">
      {/* ── Header: name + role badge + actions ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {org?.name}
          </h1>
          {role && <RoleBadge role={role} />}
        </div>
        <div className="flex items-center gap-2">
          {org?.ownerUsername && org?.userSlug && (
            <ShareDialog
              url={buildOrgUrl(org.ownerUsername, org.userSlug)}
              title={org.name}
              username={org.ownerUsername}
              inviteLink={
                isAdmin
                  ? {
                      orgId: org.id,
                      username: org.ownerUsername,
                      groupSlug: org.userSlug,
                    }
                  : undefined
              }
            />
          )}
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
      </div>

      {/* ── Quick nav ── */}
      <div className="flex flex-wrap gap-2">
        <Link
          to="/dashboard/org/$orgId/sessions"
          params={{ orgId }}
          className="group inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          <Calendar className="h-4 w-4 text-primary" />
          All Sessions
          <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        {isAdmin && (
          <Link
            to="/dashboard/org/$orgId/members"
            params={{ orgId }}
            className="group inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <Users className="h-4 w-4 text-primary" />
            Members
            <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
        <Link
          to="/dashboard/org/$orgId/profile"
          params={{ orgId }}
          className="group inline-flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5"
        >
          <TrendingUp className="h-4 w-4 text-primary" />
          Group Profile
          <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* ── Upcoming sessions ── */}
      <div>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
          {upcomingSessions && upcomingSessions.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {upcomingSessions.length} coming up
            </span>
          )}
        </div>

        {sessionsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <SessionCardSkeleton key={i} />
            ))}
          </div>
        ) : upcomingSessions && upcomingSessions.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcomingSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                orgId={orgId}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-10 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-medium">No upcoming sessions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Create your first session to get started"
                : "Check back later for new sessions"}
            </p>
            {isAdmin && (
              <Button asChild size="sm" className="mt-4">
                <Link
                  to="/dashboard/org/$orgId/sessions/create"
                  params={{ orgId }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create Session
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── Session card ─────────────────────────── */

type SessionWithCounts = {
  id: string
  title: string
  description: string | null
  dateTime: Date
  location: string | null
  status: string
  maxCapacity: number
  maxWaitlist: number
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
}: {
  session: SessionWithCounts
  orgId: string
}) {
  const spotsLeft = session.maxCapacity - session.joinedCount
  const capacityPercent = (session.joinedCount / session.maxCapacity) * 100
  const dateObj = new Date(session.dateTime)

  return (
    <Link
      to="/dashboard/org/$orgId/sessions/$sessionId"
      params={{ orgId, sessionId: session.id }}
      className="group block rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
    >
      {/* Header: date badge + status */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center rounded-lg bg-primary/10 px-2.5 py-1.5 min-w-[3rem] shrink-0">
            <span className="text-base font-bold text-primary leading-none">
              {dateObj.getDate()}
            </span>
            <span className="text-[10px] font-semibold text-primary/70 mt-0.5">
              {dateObj
                .toLocaleDateString(undefined, { month: "short" })
                .toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{session.title}</p>
            <p className="text-sm text-muted-foreground">
              {dateObj.toLocaleDateString(undefined, {
                weekday: "short",
              })}
              {" "}
              {dateObj.toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <SessionStatusBadge status={session.status} spotsLeft={spotsLeft} />
      </div>

      {/* Location */}
      {session.location && (
        <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{session.location}</span>
        </div>
      )}

      {/* Capacity */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted-foreground">Capacity</span>
          <span className="font-medium tabular-nums">
            {session.joinedCount}/{session.maxCapacity}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              capacityPercent >= 100
                ? "bg-[var(--color-status-danger)]"
                : capacityPercent >= 80
                  ? "bg-[var(--color-status-warning)]"
                  : "bg-primary"
            )}
            style={{ width: `${Math.min(capacityPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Participants + arrow */}
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
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
    </Link>
  )
}

/* ─────────────────────────── Status badge ─────────────────────────── */

function SessionStatusBadge({
  status,
  spotsLeft,
}: {
  status: string
  spotsLeft: number
}) {
  if (status === "cancelled") {
    return (
      <Badge className="bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)] border-0 text-xs shrink-0">
        Cancelled
      </Badge>
    )
  }
  if (status === "completed") {
    return (
      <Badge className="bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)] border-0 text-xs shrink-0">
        Completed
      </Badge>
    )
  }
  if (spotsLeft === 0) {
    return (
      <Badge className="bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)] border-0 text-xs shrink-0">
        Full
      </Badge>
    )
  }
  if (spotsLeft <= 3) {
    return (
      <Badge className="bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)] border-0 text-xs shrink-0">
        {spotsLeft} left
      </Badge>
    )
  }
  return (
    <Badge className="bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)] border-0 text-xs shrink-0">
      Open
    </Badge>
  )
}

/* ─────────────────────────── Skeleton ─────────────────────────── */

function SessionCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-[46px] w-12 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-1 h-4 w-20" />
          </div>
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <div className="mb-3">
        <div className="mb-1 flex justify-between">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-7 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  )
}

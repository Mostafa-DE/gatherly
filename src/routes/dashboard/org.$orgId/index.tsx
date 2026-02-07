import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ShareDialog } from "@/components/share-dialog"
import {
  Calendar,
  Users,
  ArrowRight,
  MapPin,
  TrendingUp,
  CheckCircle2,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { buildOrgUrl } from "@/lib/share-urls"

export const Route = createFileRoute("/dashboard/org/$orgId/")({
  component: OrgOverviewPage,
})

function OrgOverviewPage() {
  const { orgId } = Route.useParams()
  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const { data: upcomingSessions, isLoading: sessionsLoading } =
    trpc.session.listUpcomingWithCounts.useQuery({
      limit: 3,
    })

  const isAdmin =
    whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  if (whoamiLoading) {
    return (
      <div className="space-y-8 py-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
    )
  }

  const org = whoami?.activeOrganization

  return (
    <div className="space-y-10 py-6">
      {/* Hero Section */}
      <div className="relative">
        {/* Badge */}
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary" />
          Group Dashboard
        </div>

        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome to{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {org?.name}
          </span>
        </h1>

        <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
          Manage your sessions, track attendance, and keep your group organized
          — all in one place.
        </p>

        {org?.ownerUsername && org?.userSlug && (
          <div className="mt-4">
            <ShareDialog
              url={buildOrgUrl(org.ownerUsername, org.userSlug)}
              title={org.name}
              username={org.ownerUsername}
              inviteLink={
                isAdmin
                  ? { orgId: org.id, username: org.ownerUsername, groupSlug: org.userSlug }
                  : undefined
              }
            />
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold text-primary">
              {upcomingSessions?.length ?? 0}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Upcoming Sessions
            </div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold text-primary capitalize">
              {whoami?.membership?.role}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">Your Role</div>
          </div>
          <div className="rounded-xl border border-border/50 bg-card/50 p-4 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-500">
              <CheckCircle2 className="h-5 w-5" />
              Active
            </div>
            <div className="mt-1 text-sm text-muted-foreground">Status</div>
          </div>
        </div>
      </div>

      {/* Upcoming Sessions Section */}
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
            <p className="text-sm text-muted-foreground">
              {upcomingSessions && upcomingSessions.length > 0
                ? `${upcomingSessions.length} session${upcomingSessions.length !== 1 ? "s" : ""} coming up`
                : "No upcoming sessions scheduled"}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button asChild>
                <Link
                  to="/dashboard/org/$orgId/sessions/create"
                  params={{ orgId }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  New Session
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/dashboard/org/$orgId/sessions" params={{ orgId }}>
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
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
              <SessionCard key={session.id} session={session} orgId={orgId} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card/50 p-12 text-center backdrop-blur-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium">No upcoming sessions</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Create your first session to get started"
                : "Check back later for new sessions"}
            </p>
            {isAdmin && (
              <Button asChild className="mt-4">
                <Link
                  to="/dashboard/org/$orgId/sessions/create"
                  params={{ orgId }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Session
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/dashboard/org/$orgId/sessions"
          params={{ orgId }}
          className="group rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Calendar className="h-5 w-5" />
          </div>
          <h3 className="font-medium">All Sessions</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and manage all your sessions
          </p>
        </Link>

        {isAdmin && (
          <Link
            to="/dashboard/org/$orgId/members"
            params={{ orgId }}
            className="group rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="font-medium">Members</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your group members
            </p>
          </Link>
        )}

        <Link
          to="/dashboard/org/$orgId/profile"
          params={{ orgId }}
          className="group rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h3 className="font-medium">My Profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            View your attendance and history
          </p>
        </Link>
      </div>
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

  const getStatusBadge = () => {
    if (session.status === "cancelled") {
      return {
        text: "Cancelled",
        className: "bg-destructive/10 text-destructive",
      }
    }
    if (session.status === "completed") {
      return { text: "Completed", className: "bg-muted text-muted-foreground" }
    }
    if (spotsLeft === 0) {
      return { text: "Full", className: "bg-destructive/10 text-destructive" }
    }
    if (spotsLeft <= 2) {
      return {
        text: `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`,
        className: "bg-yellow-500/10 text-yellow-600",
      }
    }
    return { text: "Open", className: "bg-green-500/10 text-green-600" }
  }

  const statusBadge = getStatusBadge()
  const dateObj = new Date(session.dateTime)

  const avatarColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
  ]

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
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            statusBadge.className
          )}
        >
          {statusBadge.text}
        </span>
      </div>

      {session.location && (
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{session.location}</span>
        </div>
      )}

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted-foreground">Capacity</span>
          <span className="font-medium">
            {session.joinedCount}/{session.maxCapacity}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(capacityPercent, 100)}%` }}
          />
        </div>
      </div>

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
        <span className="text-sm font-medium text-primary">View &rarr;</span>
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
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

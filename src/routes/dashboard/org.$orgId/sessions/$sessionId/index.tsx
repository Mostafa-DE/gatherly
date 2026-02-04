import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar,
  MapPin,
  Users,
  Pencil,
  Trash2,
  Clock,
  UserPlus,
  UserMinus,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/sessions/$sessionId/"
)({
  component: SessionDetailPage,
})

function SessionDetailPage() {
  const { orgId, sessionId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin =
    whoami?.membership?.role === "owner" ||
    whoami?.membership?.role === "admin"

  const {
    data: sessionData,
    isLoading,
    error,
  } = trpc.session.getWithCounts.useQuery({ sessionId })

  const { data: myParticipation, isLoading: participationLoading } =
    trpc.participation.myParticipation.useQuery({ sessionId })

  const { data: roster } = trpc.participation.roster.useQuery({
    sessionId,
    status: "joined",
    limit: 8,
  })

  const joinMutation = trpc.participation.join.useMutation({
    onSuccess: () => {
      utils.participation.myParticipation.invalidate({ sessionId })
      utils.session.getWithCounts.invalidate({ sessionId })
      utils.participation.roster.invalidate({ sessionId })
    },
  })

  const cancelMutation = trpc.participation.cancel.useMutation({
    onSuccess: () => {
      utils.participation.myParticipation.invalidate({ sessionId })
      utils.session.getWithCounts.invalidate({ sessionId })
      utils.participation.roster.invalidate({ sessionId })
    },
  })

  const updateStatusMutation = trpc.session.updateStatus.useMutation({
    onSuccess: () => {
      utils.session.getWithCounts.invalidate({ sessionId })
      utils.session.listUpcoming.invalidate()
      utils.session.listPast.invalidate()
      utils.session.listUpcomingWithCounts.invalidate()
      utils.session.listPastWithCounts.invalidate()
    },
  })

  const deleteMutation = trpc.session.delete.useMutation({
    onSuccess: () => {
      utils.session.list.invalidate()
      utils.session.listUpcoming.invalidate()
      utils.session.listPast.invalidate()
      utils.session.listUpcomingWithCounts.invalidate()
      utils.session.listPastWithCounts.invalidate()
      navigate({ to: "/dashboard/org/$orgId/sessions", params: { orgId } })
    },
  })

  if (isLoading) {
    return (
      <div className="py-6">
        <SessionDetailSkeleton />
      </div>
    )
  }

  if (error || !sessionData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {error?.message || "This session doesn't exist or has been deleted."}
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId/sessions" params={{ orgId }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
      </div>
    )
  }

  const dateObj = new Date(sessionData.dateTime)
  const spotsLeft = sessionData.maxCapacity - sessionData.joinedCount
  const capacityPercent = (sessionData.joinedCount / sessionData.maxCapacity) * 100
  const isPast = dateObj < new Date() || sessionData.status === "completed" || sessionData.status === "cancelled"

  const canJoin =
    sessionData.status === "published" &&
    !myParticipation &&
    (sessionData.joinedCount < sessionData.maxCapacity ||
      sessionData.waitlistCount < sessionData.maxWaitlist)

  const isJoined = myParticipation?.status === "joined"
  const isWaitlisted = myParticipation?.status === "waitlisted"

  // Status badge styling
  const getStatusBadge = () => {
    if (sessionData.status === "cancelled") {
      return { text: "Cancelled", className: "bg-destructive/10 text-destructive" }
    }
    if (sessionData.status === "completed") {
      return { text: "Completed", className: "bg-muted text-muted-foreground" }
    }
    if (sessionData.status === "draft") {
      return { text: "Draft", className: "bg-yellow-500/10 text-yellow-600" }
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

  // Avatar colors
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
    <div className="py-6 space-y-6">
      {/* Back Link */}
      <Link
        to="/dashboard/org/$orgId/sessions"
        params={{ orgId }}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to Sessions
      </Link>

      {/* Hero Section */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          {/* Left: Date & Title */}
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">{sessionData.title}</h1>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium",
                    statusBadge.className
                  )}
                >
                  {statusBadge.text}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {dateObj.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                  {" at "}
                  {dateObj.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {sessionData.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {sessionData.location}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Admin Edit Button */}
          {isAdmin && (sessionData.status === "draft" || sessionData.status === "published") && (
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/dashboard/org/$orgId/sessions/$sessionId/edit"
                params={{ orgId, sessionId }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit Session
              </Link>
            </Button>
          )}
        </div>

        {/* Description */}
        {sessionData.description && (
          <p className="mt-4 text-muted-foreground">{sessionData.description}</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Capacity Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Capacity</span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-3xl font-bold">{sessionData.joinedCount}</span>
            <span className="text-muted-foreground">/ {sessionData.maxCapacity}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isPast ? "bg-muted-foreground/50" : "bg-primary"
              )}
              style={{ width: `${Math.min(capacityPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Waitlist Card */}
        {sessionData.maxWaitlist > 0 && (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Waitlist</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{sessionData.waitlistCount}</span>
              <span className="text-muted-foreground">/ {sessionData.maxWaitlist}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {sessionData.waitlistCount === 0
                ? "No one waiting"
                : `${sessionData.waitlistCount} waiting for a spot`}
            </p>
          </div>
        )}

        {/* Your Status Card */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Your Status</span>
            {isJoined ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : isWaitlisted ? (
              <Clock className="h-4 w-4 text-yellow-500" />
            ) : (
              <UserPlus className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          {participationLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : isJoined ? (
            <div>
              <span className="text-xl font-bold text-green-500">Joined</span>
              <p className="text-xs text-muted-foreground mt-1">You're in!</p>
            </div>
          ) : isWaitlisted ? (
            <div>
              <span className="text-xl font-bold text-yellow-500">Waitlisted</span>
              <p className="text-xs text-muted-foreground mt-1">
                Position #{(myParticipation as { waitlistPosition?: number }).waitlistPosition || "—"}
              </p>
            </div>
          ) : myParticipation?.status === "cancelled" ? (
            <div>
              <span className="text-xl font-bold text-muted-foreground">Cancelled</span>
              <p className="text-xs text-muted-foreground mt-1">Registration cancelled</p>
            </div>
          ) : (
            <div>
              <span className="text-xl font-bold text-muted-foreground">Not Joined</span>
              <p className="text-xs text-muted-foreground mt-1">
                {canJoin ? "Spots available" : "Session full"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Participants Preview */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium">Participants</h3>
          {isAdmin && (
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/dashboard/org/$orgId/sessions/$sessionId/roster"
                params={{ orgId, sessionId }}
              >
                View full roster →
              </Link>
            </Button>
          )}
        </div>
        {roster && roster.length > 0 ? (
          <div className="space-y-3">
            {roster.slice(0, 8).map((p, i) => (
              <div
                key={p.participation.id}
                className="flex items-center gap-3"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium shrink-0",
                    p.user.image
                      ? ""
                      : `${avatarColors[i % avatarColors.length]} text-white`
                  )}
                >
                  {p.user.image ? (
                    <img
                      src={p.user.image}
                      alt={p.user.name ?? ""}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    getInitials(p.user.name)
                  )}
                </div>
                <p className="font-medium truncate">{p.user.name}</p>
              </div>
            ))}
            {sessionData.joinedCount > 8 && (
              <p className="text-sm text-muted-foreground">
                +{sessionData.joinedCount - 8} more participant{sessionData.joinedCount - 8 !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground">No participants yet</p>
        )}
      </div>

      {/* Action Section */}
      {!isPast && (
        <div className="rounded-xl border bg-card p-5">
          {canJoin ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-medium mb-1">Ready to join?</h3>
                <p className="text-sm text-muted-foreground">
                  {sessionData.joinedCount < sessionData.maxCapacity
                    ? `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} remaining`
                    : "You will be added to the waitlist"}
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => joinMutation.mutate({ sessionId })}
                disabled={joinMutation.isPending}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {joinMutation.isPending
                  ? "Joining..."
                  : sessionData.joinedCount < sessionData.maxCapacity
                    ? "Join Session"
                    : "Join Waitlist"}
              </Button>
            </div>
          ) : (isJoined || isWaitlisted) && sessionData.status !== "completed" && sessionData.status !== "cancelled" ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-medium mb-1">Change your mind?</h3>
                <p className="text-sm text-muted-foreground">
                  You can cancel your registration anytime
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() =>
                  cancelMutation.mutate({
                    participationId: myParticipation!.id,
                  })
                }
                disabled={cancelMutation.isPending}
                className="gap-2"
              >
                <UserMinus className="h-4 w-4" />
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Registration"}
              </Button>
            </div>
          ) : sessionData.status === "published" && !myParticipation ? (
            <div className="text-center py-2">
              <p className="text-muted-foreground">
                This session is full and the waitlist is at capacity.
              </p>
            </div>
          ) : null}
          {(joinMutation.error || cancelMutation.error) && (
            <p className="text-sm text-destructive mt-3">
              {joinMutation.error?.message || cancelMutation.error?.message}
            </p>
          )}
        </div>
      )}

      {/* Admin Actions */}
      {isAdmin && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="font-medium">Admin Actions</h3>
          <div className="flex flex-wrap gap-2">
            {sessionData.status === "draft" && (
              <Button
                onClick={() =>
                  updateStatusMutation.mutate({
                    sessionId,
                    status: "published",
                  })
                }
                disabled={updateStatusMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Publish Session
              </Button>
            )}
            {sessionData.status === "published" && (
              <Button
                variant="outline"
                onClick={() =>
                  updateStatusMutation.mutate({
                    sessionId,
                    status: "completed",
                  })
                }
                disabled={updateStatusMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Completed
              </Button>
            )}
            {(sessionData.status === "draft" || sessionData.status === "published") && (
              <Button
                variant="outline"
                onClick={() =>
                  updateStatusMutation.mutate({
                    sessionId,
                    status: "cancelled",
                  })
                }
                disabled={updateStatusMutation.isPending}
                className="gap-2 text-destructive hover:text-destructive"
              >
                <XCircle className="h-4 w-4" />
                Cancel Session
              </Button>
            )}
          </div>

          {updateStatusMutation.error && (
            <p className="text-sm text-destructive">
              {updateStatusMutation.error.message}
            </p>
          )}

          {/* Danger Zone */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-3">Danger Zone</p>
            {!showDeleteConfirm ? (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/50 hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Session
              </Button>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/50 bg-destructive/5">
                <span className="text-sm">Are you sure? This cannot be undone.</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate({ sessionId })}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            )}
            {deleteMutation.error && (
              <p className="text-sm text-destructive mt-2">
                {deleteMutation.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SessionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-32" />
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-5">
        <Skeleton className="h-5 w-24 mb-4" />
        <div className="flex -space-x-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

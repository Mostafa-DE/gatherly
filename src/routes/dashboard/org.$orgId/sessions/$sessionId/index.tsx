import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  Tag,
  MoreHorizontal,
  Send,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, hasPrice } from "@/lib/format-price"
import { ShareDialog } from "@/components/share-dialog"
import { buildSessionUrl } from "@/lib/share-urls"

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

  const { data: orgSettings } = trpc.organizationSettings.get.useQuery({})
  const orgCurrency = orgSettings?.currency

  const canLoadParticipation = sessionData ? sessionData.status !== "draft" : false
  const canLoadRoster = sessionData
    ? sessionData.status !== "draft" || isAdmin
    : false

  const { data: myParticipation, isLoading: participationLoading } =
    trpc.participation.myParticipation.useQuery(
      { sessionId },
      { enabled: canLoadParticipation }
    )

  const { data: roster } = trpc.participation.roster.useQuery(
    {
      sessionId,
      status: "joined",
      limit: 8,
    },
    { enabled: canLoadRoster }
  )

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
      utils.session.listDraftsWithCounts.invalidate()
    },
  })

  const deleteMutation = trpc.session.delete.useMutation({
    onSuccess: () => {
      utils.session.list.invalidate()
      utils.session.listUpcoming.invalidate()
      utils.session.listPast.invalidate()
      utils.session.listUpcomingWithCounts.invalidate()
      utils.session.listPastWithCounts.invalidate()
      utils.session.listDraftsWithCounts.invalidate()
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
  const isDraft = sessionData.status === "draft"
  const showParticipants = !isDraft || isAdmin

  const canJoin =
    sessionData.status === "published" &&
    !myParticipation &&
    (sessionData.joinedCount < sessionData.maxCapacity ||
      sessionData.waitlistCount < sessionData.maxWaitlist)

  const isJoined = myParticipation?.status === "joined"
  const isWaitlisted = myParticipation?.status === "waitlisted"
  const canCancel = (isJoined || isWaitlisted) && sessionData.status === "published" && !isPast

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

  const canEdit = isAdmin && (sessionData.status === "draft" || sessionData.status === "published")
  const canPublish = isAdmin && sessionData.status === "draft"
  const canComplete = isAdmin && sessionData.status === "published"
  const canCancelSession = isAdmin && (sessionData.status === "draft" || sessionData.status === "published")

  return (
    <div className="py-6 space-y-6">
      {/* Header with Back Link and Admin Actions */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/org/$orgId/sessions"
          params={{ orgId }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Sessions
        </Link>

        <div className="flex items-center gap-2">
          {/* Share button (visible to all when session is published) */}
          {whoami?.activeOrganization?.ownerUsername &&
            whoami.activeOrganization.userSlug &&
            sessionData?.status === "published" && (
            <ShareDialog
              url={buildSessionUrl(
                whoami.activeOrganization.ownerUsername,
                whoami.activeOrganization.userSlug,
                sessionId
              )}
              title={sessionData.title}
              type="session"
              groupName={whoami.activeOrganization.name}
              username={whoami.activeOrganization.ownerUsername}
            />
          )}

          {/* Admin Actions Dropdown */}
          {isAdmin && (
            <>
            {/* Primary admin action based on status */}
            {canPublish && (
              <Button
                size="sm"
                onClick={() =>
                  updateStatusMutation.mutate({
                    sessionId,
                    status: "published",
                  })
                }
                disabled={updateStatusMutation.isPending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Publish</span>
              </Button>
            )}

            {/* More actions dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link
                      to="/dashboard/org/$orgId/sessions/$sessionId/edit"
                      params={{ orgId, sessionId }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Session
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link
                    to="/dashboard/org/$orgId/sessions/$sessionId/roster"
                    params={{ orgId, sessionId }}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    View Roster
                  </Link>
                </DropdownMenuItem>
                {canComplete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        updateStatusMutation.mutate({
                          sessionId,
                          status: "completed",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark Completed
                    </DropdownMenuItem>
                  </>
                )}
                {canCancelSession && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        updateStatusMutation.mutate({
                          sessionId,
                          status: "cancelled",
                        })
                      }
                      disabled={updateStatusMutation.isPending}
                      className="text-destructive focus:text-destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancel Session
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Session
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Banner */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-destructive/50 bg-destructive/5">
          <span className="text-sm font-medium">
            Are you sure you want to delete this session? This cannot be undone.
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteMutation.mutate({ sessionId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
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
        </div>
      )}

      {/* Error messages */}
      {(updateStatusMutation.error || deleteMutation.error) && (
        <div className="p-4 rounded-xl border border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive">
            {updateStatusMutation.error?.message || deleteMutation.error?.message}
          </p>
        </div>
      )}

      {/* Hero Section - More compact */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-4">
          {/* Title and badges */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Calendar className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-2xl font-bold truncate">{sessionData.title}</h1>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0",
                    statusBadge.className
                  )}
                >
                  {statusBadge.text}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {dateObj.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                  {" · "}
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
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {sessionData.joinedCount}/{sessionData.maxCapacity}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1",
                    hasPrice(sessionData.price)
                      ? "text-primary"
                      : "text-green-600"
                  )}
                >
                  <Tag className="h-3.5 w-3.5" />
                  {formatPrice(sessionData.price, orgCurrency)}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {sessionData.description && (
            <p className="text-muted-foreground text-sm">{sessionData.description}</p>
          )}

          {/* User Actions - Prominent CTA */}
          {!isDraft && (
            <div className="flex items-center gap-3 pt-2 border-t">
              {participationLoading ? (
                <Skeleton className="h-10 w-32" />
              ) : canJoin ? (
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
              ) : isJoined ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-medium">You're joined!</span>
                  </div>
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        cancelMutation.mutate({
                          participationId: myParticipation!.id,
                        })
                      }
                      disabled={cancelMutation.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      {cancelMutation.isPending ? "Cancelling..." : "Cancel"}
                    </Button>
                  )}
                </div>
              ) : isWaitlisted ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-600">
                    <Clock className="h-4 w-4" />
                    <span className="font-medium">
                      Waitlist #{(myParticipation as { waitlistPosition?: number }).waitlistPosition || "—"}
                    </span>
                  </div>
                  {canCancel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        cancelMutation.mutate({
                          participationId: myParticipation!.id,
                        })
                      }
                      disabled={cancelMutation.isPending}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <UserMinus className="h-4 w-4 mr-1" />
                      {cancelMutation.isPending ? "Cancelling..." : "Leave Waitlist"}
                    </Button>
                  )}
                </div>
              ) : myParticipation?.status === "cancelled" ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">Registration cancelled</span>
                </div>
              ) : sessionData.status === "published" && !isPast ? (
                <p className="text-sm text-muted-foreground">
                  Session is full and waitlist is at capacity.
                </p>
              ) : null}

              {(joinMutation.error || cancelMutation.error) && (
                <p className="text-sm text-destructive">
                  {joinMutation.error?.message || cancelMutation.error?.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout for Stats and Participants */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Stats */}
        <div className="lg:col-span-2 space-y-4">
          {/* Capacity Card */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Capacity</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold">{sessionData.joinedCount}</span>
              <span className="text-muted-foreground">/ {sessionData.maxCapacity}</span>
              <span className="text-sm text-muted-foreground ml-2">
                ({spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  isPast ? "bg-muted-foreground/50" : capacityPercent >= 100 ? "bg-destructive" : capacityPercent >= 80 ? "bg-yellow-500" : "bg-primary"
                )}
                style={{ width: `${Math.min(capacityPercent, 100)}%` }}
              />
            </div>
          </div>

          {/* Waitlist Card - Only if enabled */}
          {sessionData.maxWaitlist > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Waitlist</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{sessionData.waitlistCount}</span>
                <span className="text-muted-foreground">/ {sessionData.maxWaitlist}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {sessionData.waitlistCount === 0
                  ? "No one on the waitlist"
                  : `${sessionData.waitlistCount} ${sessionData.waitlistCount === 1 ? "person" : "people"} waiting for a spot`}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar - Participants */}
        {showParticipants && (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Participants</h3>
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild className="text-xs">
                  <Link
                    to="/dashboard/org/$orgId/sessions/$sessionId/roster"
                    params={{ orgId, sessionId }}
                  >
                    View all →
                  </Link>
                </Button>
              )}
            </div>
            {roster && roster.length > 0 ? (
              <div className="space-y-2">
                {roster.slice(0, 6).map((p, i) => (
                  <div
                    key={p.participation.id}
                    className="flex items-center gap-2.5"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium shrink-0",
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
                    <p className="text-sm font-medium truncate">{p.user.name}</p>
                  </div>
                ))}
                {sessionData.joinedCount > 6 && (
                  <p className="text-xs text-muted-foreground pt-2">
                    +{sessionData.joinedCount - 6} more
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No participants yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-24 mb-3" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

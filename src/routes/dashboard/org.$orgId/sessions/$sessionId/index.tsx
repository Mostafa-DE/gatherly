import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
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
  DollarSign,
  ListOrdered,
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

/* ─────────────────────────── helpers ─────────────────────────── */

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

function getInitials(name: string | null) {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatDay(date: Date) {
  return date.getDate()
}

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()
}

function formatWeekday(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "long" })
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/* ─────────────────────────── main page ─────────────────────────── */

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

  const canLoadParticipation = sessionData
    ? sessionData.status !== "draft"
    : false
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

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="py-6">
        <SessionDetailSkeleton />
      </div>
    )
  }

  /* ── Error / Not Found ── */
  if (error || !sessionData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          {error?.message ||
            "This session doesn't exist or has been deleted."}
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

  /* ── Derived state ── */
  const dateObj = new Date(sessionData.dateTime)
  const spotsLeft = sessionData.maxCapacity - sessionData.joinedCount
  const capacityPercent =
    (sessionData.joinedCount / sessionData.maxCapacity) * 100
  const isPast =
    dateObj < new Date() ||
    sessionData.status === "completed" ||
    sessionData.status === "cancelled"
  const isDraft = sessionData.status === "draft"

  const canJoin =
    sessionData.status === "published" &&
    !myParticipation &&
    (sessionData.joinedCount < sessionData.maxCapacity ||
      sessionData.waitlistCount < sessionData.maxWaitlist)

  const isJoined = myParticipation?.status === "joined"
  const isWaitlisted = myParticipation?.status === "waitlisted"
  const canCancel =
    (isJoined || isWaitlisted) &&
    sessionData.status === "published" &&
    !isPast

  const canEdit =
    isAdmin &&
    (sessionData.status === "draft" || sessionData.status === "published")
  const canPublish = isAdmin && sessionData.status === "draft"
  const canComplete = isAdmin && sessionData.status === "published"
  const canCancelSession =
    isAdmin &&
    (sessionData.status === "draft" || sessionData.status === "published")

  const showParticipants = !isDraft || isAdmin

  return (
    <div className="py-6 space-y-6 max-w-4xl">
      {/* ── Top bar: back + actions ── */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard/org/$orgId/sessions"
          params={{ orgId }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Sessions
        </Link>

        <div className="flex items-center gap-2">
          {whoami?.activeOrganization?.ownerUsername &&
            whoami.activeOrganization.userSlug &&
            sessionData.status === "published" && (
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

          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/dashboard/org/$orgId/sessions/$sessionId/edit"
                params={{ orgId, sessionId }}
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Edit</span>
              </Link>
            </Button>
          )}

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
            >
              <Send className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">Publish</span>
            </Button>
          )}

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="px-2">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
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
          )}
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      {showDeleteConfirm && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-destructive/50 bg-destructive/5">
          <span className="text-sm font-medium">
            Are you sure you want to delete this session? This cannot be
            undone.
          </span>
          <div className="flex items-center gap-2 shrink-0">
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

      {/* ── Mutation errors ── */}
      {(updateStatusMutation.error || deleteMutation.error) && (
        <div className="p-4 rounded-xl border border-destructive/50 bg-destructive/5">
          <p className="text-sm text-destructive">
            {updateStatusMutation.error?.message ||
              deleteMutation.error?.message}
          </p>
        </div>
      )}

      {/* ── Hero card ── */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex gap-5">
            {/* Date badge - ticket style */}
            <div className="flex flex-col items-center justify-center rounded-xl bg-primary/10 px-4 py-3 min-w-[4.5rem] shrink-0">
              <span className="text-2xl font-bold text-primary leading-none">
                {formatDay(dateObj)}
              </span>
              <span className="text-xs font-semibold text-primary/70 mt-0.5">
                {formatMonth(dateObj)}
              </span>
            </div>

            {/* Title + meta */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-start gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">
                  {sessionData.title}
                </h1>
                <StatusBadge
                  status={sessionData.status}
                  spotsLeft={spotsLeft}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatWeekday(dateObj)} at {formatTime(dateObj)}
                </span>
                {sessionData.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {sessionData.location}
                  </span>
                )}
                <span
                  className={cn(
                    "flex items-center gap-1.5 font-medium",
                    hasPrice(sessionData.price)
                      ? "text-foreground"
                      : "text-[var(--color-status-success)]"
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
            <>
              <Separator className="my-5" />
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {sessionData.description}
              </p>
            </>
          )}
        </div>

        {/* ── Participation CTA ── */}
        {!isDraft && (
          <ParticipationBar
            participationLoading={participationLoading}
            canJoin={canJoin}
            isJoined={isJoined}
            isWaitlisted={isWaitlisted}
            canCancel={canCancel}
            isPast={isPast}
            isFull={
              sessionData.joinedCount >= sessionData.maxCapacity &&
              sessionData.waitlistCount >= sessionData.maxWaitlist
            }
            sessionStatus={sessionData.status}
            myParticipation={myParticipation}
            spotsLeft={spotsLeft}
            onJoin={() => joinMutation.mutate({ sessionId })}
            onCancel={() =>
              cancelMutation.mutate({
                participationId: myParticipation!.id,
              })
            }
            joinPending={joinMutation.isPending}
            cancelPending={cancelMutation.isPending}
            joinError={joinMutation.error?.message}
            cancelError={cancelMutation.error?.message}
          />
        )}
      </div>

      {/* ── Stats strip ── */}
      <div
        className={cn(
          "grid gap-4",
          sessionData.maxWaitlist > 0
            ? "sm:grid-cols-3"
            : "sm:grid-cols-2"
        )}
      >
        {/* Capacity */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              Capacity
            </span>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <span className="text-3xl font-bold tabular-nums">
              {sessionData.joinedCount}
            </span>
            <span className="text-lg text-muted-foreground font-medium">
              / {sessionData.maxCapacity}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isPast
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
          <p className="text-xs text-muted-foreground mt-2">
            {spotsLeft > 0
              ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} remaining`
              : "At full capacity"}
          </p>
        </div>

        {/* Waitlist */}
        {sessionData.maxWaitlist > 0 && (
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                Waitlist
              </span>
              <ListOrdered className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl font-bold tabular-nums">
                {sessionData.waitlistCount}
              </span>
              <span className="text-lg text-muted-foreground font-medium">
                / {sessionData.maxWaitlist}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isPast
                    ? "bg-muted-foreground/50"
                    : sessionData.waitlistCount >= sessionData.maxWaitlist
                      ? "bg-[var(--color-status-warning)]"
                      : "bg-[var(--color-status-warning)]/60"
                )}
                style={{
                  width: `${Math.min(
                    (sessionData.waitlistCount / sessionData.maxWaitlist) *
                      100,
                    100
                  )}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {sessionData.waitlistCount === 0
                ? "No one waiting"
                : `${sessionData.waitlistCount} ${sessionData.waitlistCount === 1 ? "person" : "people"} waiting`}
            </p>
          </div>
        )}

        {/* Price / Join Mode */}
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-muted-foreground">
              Pricing
            </span>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mb-1">
            <span
              className={cn(
                "text-3xl font-bold",
                hasPrice(sessionData.price)
                  ? "text-foreground"
                  : "text-[var(--color-status-success)]"
              )}
            >
              {formatPrice(sessionData.price, orgCurrency)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {sessionData.joinMode === "open"
              ? "Open registration"
              : sessionData.joinMode === "approval_required"
                ? "Requires approval"
                : "Invite only"}
          </p>
        </div>
      </div>

      {/* ── Participants ── */}
      {showParticipants && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Participants</h3>
              {sessionData.joinedCount > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {sessionData.joinedCount}
                </Badge>
              )}
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" asChild className="text-xs">
                <Link
                  to="/dashboard/org/$orgId/sessions/$sessionId/roster"
                  params={{ orgId, sessionId }}
                >
                  View Roster
                  <ArrowLeft className="h-3 w-3 ml-1 rotate-180" />
                </Link>
              </Button>
            )}
          </div>

          {roster && roster.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {roster.slice(0, 8).map((p, i) => (
                <div
                  key={p.participation.id}
                  className="group relative flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium shrink-0",
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
                  <span className="text-sm font-medium truncate max-w-[120px]">
                    {p.user.name}
                  </span>
                </div>
              ))}
              {sessionData.joinedCount > 8 && (
                <div className="flex items-center rounded-lg border bg-muted/30 px-3 py-2">
                  <span className="text-sm text-muted-foreground font-medium tabular-nums">
                    +{sessionData.joinedCount - 8} more
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Users className="h-5 w-5 mr-2 opacity-40" />
              No participants yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Status badge ─────────────────────────── */

function StatusBadge({
  status,
  spotsLeft,
}: {
  status: string
  spotsLeft: number
}) {
  if (status === "cancelled") {
    return (
      <Badge className="bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)] border-0 shrink-0">
        Cancelled
      </Badge>
    )
  }
  if (status === "completed") {
    return (
      <Badge className="bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)] border-0 shrink-0">
        Completed
      </Badge>
    )
  }
  if (status === "draft") {
    return (
      <Badge className="bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)] border-0 shrink-0">
        Draft
      </Badge>
    )
  }
  if (spotsLeft === 0) {
    return (
      <Badge className="bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)] border-0 shrink-0">
        Full
      </Badge>
    )
  }
  if (spotsLeft <= 3) {
    return (
      <Badge className="bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)] border-0 shrink-0">
        {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
      </Badge>
    )
  }
  return (
    <Badge className="bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)] border-0 shrink-0">
      Open
    </Badge>
  )
}

/* ─────────────────────── Participation bar ──────────────────────── */

type ParticipationBarProps = {
  participationLoading: boolean
  canJoin: boolean
  isJoined: boolean
  isWaitlisted: boolean
  canCancel: boolean
  isPast: boolean
  isFull: boolean
  sessionStatus: string
  myParticipation: { id: string; status: string; waitlistPosition?: number | null } | null | undefined
  spotsLeft: number
  onJoin: () => void
  onCancel: () => void
  joinPending: boolean
  cancelPending: boolean
  joinError?: string
  cancelError?: string
}

function ParticipationBar({
  participationLoading,
  canJoin,
  isJoined,
  isWaitlisted,
  canCancel,
  isPast,
  isFull,
  sessionStatus,
  myParticipation,
  spotsLeft,
  onJoin,
  onCancel,
  joinPending,
  cancelPending,
  joinError,
  cancelError,
}: ParticipationBarProps) {
  return (
    <div className="border-t bg-muted/30 px-6 sm:px-8 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {participationLoading ? (
          <Skeleton className="h-10 w-40" />
        ) : canJoin ? (
          <div className="flex items-center gap-3">
            <Button size="lg" onClick={onJoin} disabled={joinPending}>
              <UserPlus className="h-4 w-4 mr-2" />
              {joinPending
                ? "Joining..."
                : spotsLeft > 0
                  ? "Join Session"
                  : "Join Waitlist"}
            </Button>
            {spotsLeft > 0 && spotsLeft <= 5 && (
              <span className="text-sm text-[var(--color-status-warning)] font-medium">
                {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
              </span>
            )}
          </div>
        ) : isJoined ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)]">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium text-sm">You're in</span>
            </div>
            {canCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={cancelPending}
                className="text-muted-foreground hover:text-destructive"
              >
                <UserMinus className="h-4 w-4 mr-1.5" />
                {cancelPending ? "Cancelling..." : "Cancel"}
              </Button>
            )}
          </div>
        ) : isWaitlisted ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)]">
              <Clock className="h-4 w-4" />
              <span className="font-medium text-sm">
                Waitlisted
                {(myParticipation as { waitlistPosition?: number })
                  ?.waitlistPosition
                  ? ` #${(myParticipation as { waitlistPosition?: number }).waitlistPosition}`
                  : ""}
              </span>
            </div>
            {canCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                disabled={cancelPending}
                className="text-muted-foreground hover:text-destructive"
              >
                <UserMinus className="h-4 w-4 mr-1.5" />
                {cancelPending ? "Leaving..." : "Leave Waitlist"}
              </Button>
            )}
          </div>
        ) : myParticipation?.status === "cancelled" ? (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)]">
            <XCircle className="h-4 w-4" />
            <span className="font-medium text-sm">Cancelled</span>
          </div>
        ) : sessionStatus === "published" && !isPast && isFull ? (
          <p className="text-sm text-muted-foreground">
            This session is full and the waitlist is at capacity.
          </p>
        ) : null}

        {(joinError || cancelError) && (
          <p className="text-sm text-destructive">
            {joinError || cancelError}
          </p>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────── Skeleton ─────────────────────────── */

function SessionDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top bar */}
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex gap-5">
            <Skeleton className="h-[72px] w-[72px] rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          </div>
        </div>
        <div className="border-t bg-muted/30 px-6 py-4">
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-9 w-24 mb-3" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Participants */}
      <div className="rounded-xl border bg-card p-5">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-36 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

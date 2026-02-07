import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { useSession } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { ShareDialog } from "@/components/share-dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Tag,
  ArrowLeft,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, hasPrice } from "@/lib/format-price"
import { buildSessionUrl } from "@/lib/share-urls"

export const Route = createFileRoute(
  "/$username/$groupSlug/sessions/$sessionId"
)({
  component: PublicSessionPage,
})

/* ─────────────────────────── helpers ─────────────────────────── */

function formatDay(date: Date) {
  return date.getDate()
}

function formatMonth(date: Date) {
  return date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()
}

function formatFullDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

/* ─────────────────────────── main page ─────────────────────────── */

function PublicSessionPage() {
  const { username, groupSlug, sessionId } = Route.useParams()
  const { data: session, isPending: sessionPending } = useSession()
  const isLoggedIn = !sessionPending && !!session?.user

  const {
    data,
    isLoading,
    error,
  } = trpc.organization.getPublicSession.useQuery({
    username,
    groupSlug,
    sessionId,
  })

  /* ── Loading ── */
  if (isLoading) {
    return (
      <>
        <LandingNavbar
          isLoggedIn={isLoggedIn}
          isAuthLoading={sessionPending}
        />
        <div className="mx-auto max-w-2xl px-4 pt-24 pb-12">
          <PublicSessionSkeleton />
        </div>
      </>
    )
  }

  /* ── Error ── */
  if (error || !data) {
    return (
      <>
        <LandingNavbar
          isLoggedIn={isLoggedIn}
          isAuthLoading={sessionPending}
        />
        <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 pt-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
            <Calendar className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Session Not Found</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            This session doesn't exist or isn't publicly available.
          </p>
          <Button asChild>
            <Link
              to="/$username/$groupSlug"
              params={{ username, groupSlug }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Group
            </Link>
          </Button>
        </div>
      </>
    )
  }

  const { session: sessionData, organization: org } = data
  const dateObj = new Date(sessionData.dateTime)
  const spotsLeft = sessionData.maxCapacity - sessionData.joinedCount
  const capacityPercent =
    (sessionData.joinedCount / sessionData.maxCapacity) * 100
  const shareUrl = buildSessionUrl(username, groupSlug, sessionId)

  return (
    <>
      <LandingNavbar
        isLoggedIn={isLoggedIn}
        isAuthLoading={sessionPending}
      />
      <div className="mx-auto max-w-2xl px-4 pt-24 pb-12 space-y-6">
        {/* ── Back link ── */}
        <Link
          to="/$username/$groupSlug"
          params={{ username, groupSlug }}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          {org.name}
        </Link>

        {/* ── Hero card ── */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-6 sm:p-8">
            {/* Header: date badge + title */}
            <div className="flex gap-5">
              <div className="flex flex-col items-center justify-center rounded-xl bg-primary/10 px-4 py-3 min-w-[4.5rem] shrink-0">
                <span className="text-2xl font-bold text-primary leading-none">
                  {formatDay(dateObj)}
                </span>
                <span className="text-xs font-semibold text-primary/70 mt-0.5">
                  {formatMonth(dateObj)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold leading-tight mb-1">
                  {sessionData.title}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Hosted by{" "}
                  <Link
                    to="/$username/$groupSlug"
                    params={{ username, groupSlug }}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {org.name}
                  </Link>
                </p>
              </div>
              <div className="shrink-0 hidden sm:block">
                <ShareDialog
                  url={shareUrl}
                  title={sessionData.title}
                  type="session"
                  groupName={org.name}
                  username={username}
                />
              </div>
            </div>

            <Separator className="my-5" />

            {/* ── Details grid ── */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Date & time */}
              <div className="flex items-start gap-3 rounded-lg border bg-background p-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {formatFullDate(dateObj)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatTime(dateObj)}
                  </p>
                </div>
              </div>

              {/* Location */}
              {sessionData.location && (
                <div className="flex items-start gap-3 rounded-lg border bg-background p-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {sessionData.location}
                    </p>
                    <p className="text-sm text-muted-foreground">Location</p>
                  </div>
                </div>
              )}

              {/* Capacity */}
              <div className="flex items-start gap-3 rounded-lg border bg-background p-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {sessionData.joinedCount}/{sessionData.maxCapacity}{" "}
                    joined
                  </p>
                  <p
                    className={cn(
                      "text-sm",
                      spotsLeft === 0
                        ? "text-[var(--color-status-danger)] font-medium"
                        : spotsLeft <= 3
                          ? "text-[var(--color-status-warning)] font-medium"
                          : "text-muted-foreground"
                    )}
                  >
                    {spotsLeft > 0
                      ? `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"} left`
                      : "Full"}
                  </p>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-start gap-3 rounded-lg border bg-background p-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Tag className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      hasPrice(sessionData.price)
                        ? "text-foreground"
                        : "text-[var(--color-status-success)]"
                    )}
                  >
                    {formatPrice(sessionData.price, null)}
                  </p>
                  <p className="text-sm text-muted-foreground">Price</p>
                </div>
              </div>
            </div>

            {/* ── Capacity bar ── */}
            <div className="mt-5">
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>Capacity</span>
                <span className="font-medium tabular-nums">
                  {Math.round(capacityPercent)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    capacityPercent >= 100
                      ? "bg-[var(--color-status-danger)]"
                      : capacityPercent >= 80
                        ? "bg-[var(--color-status-warning)]"
                        : "bg-primary"
                  )}
                  style={{
                    width: `${Math.min(capacityPercent, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* ── Description ── */}
            {sessionData.description && (
              <>
                <Separator className="my-5" />
                <div>
                  <h3 className="text-sm font-medium mb-2">
                    About this session
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {sessionData.description}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── CTA footer ── */}
          <div className="border-t bg-muted/30 px-6 sm:px-8 py-5">
            <div className="flex flex-col gap-3">
              {!isLoggedIn ? (
                <Button asChild size="lg" className="w-full">
                  <Link to="/login">Sign in to join this session</Link>
                </Button>
              ) : (
                <Button asChild size="lg" className="w-full">
                  <Link to="/dashboard">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Dashboard
                  </Link>
                </Button>
              )}
              <div className="flex items-center justify-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    to="/$username/$groupSlug"
                    params={{ username, groupSlug }}
                  >
                    View Group
                  </Link>
                </Button>
                <div className="sm:hidden">
                  <ShareDialog
                    url={shareUrl}
                    title={sessionData.title}
                    type="session"
                    groupName={org.name}
                    username={username}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────── Skeleton ─────────────────────────── */

function PublicSessionSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex gap-5">
            <Skeleton className="h-[72px] w-[72px] rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
        <div className="border-t bg-muted/30 px-6 py-5">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

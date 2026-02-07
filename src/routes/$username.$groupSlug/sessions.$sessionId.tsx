import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { useSession } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { ShareDialog } from "@/components/share-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  Tag,
  ArrowLeft,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice, hasPrice } from "@/lib/format-price"
import { buildSessionUrl } from "@/lib/share-urls"

export const Route = createFileRoute("/$username/$groupSlug/sessions/$sessionId")({
  component: PublicSessionPage,
})

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

  if (isLoading) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="mx-auto max-w-2xl px-4 pt-24 pb-12">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="mt-2 h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-2 w-full rounded-full" />
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="flex min-h-screen items-center justify-center p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Session Not Found</CardTitle>
              <p className="text-sm text-muted-foreground">
                This session doesn't exist or isn't publicly available.
              </p>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button asChild>
                <Link to="/$username/$groupSlug" params={{ username, groupSlug }}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Group
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    )
  }

  const { session: sessionData, organization: org } = data
  const dateObj = new Date(sessionData.dateTime)
  const spotsLeft = sessionData.maxCapacity - sessionData.joinedCount
  const capacityPercent = (sessionData.joinedCount / sessionData.maxCapacity) * 100
  const shareUrl = buildSessionUrl(username, groupSlug, sessionId)

  return (
    <>
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
      <div className="mx-auto max-w-2xl px-4 pt-24 pb-12">
        {/* Back link */}
        <Link
          to="/$username/$groupSlug"
          params={{ username, groupSlug }}
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {org.name}
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                  <Calendar className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{sessionData.title}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hosted by {org.name}
                  </p>
                </div>
              </div>
              <ShareDialog url={shareUrl} title={sessionData.title} type="session" groupName={org.name} username={username} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Details grid */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {dateObj.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
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

              {sessionData.location && (
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium">{sessionData.location}</p>
                </div>
              )}

              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {sessionData.joinedCount}/{sessionData.maxCapacity} spots filled
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {spotsLeft > 0
                      ? `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left`
                      : "Full"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <Tag className="h-5 w-5 text-muted-foreground" />
                <p
                  className={cn(
                    "text-sm font-medium",
                    hasPrice(sessionData.price)
                      ? "text-primary"
                      : "text-green-600"
                  )}
                >
                  {formatPrice(sessionData.price, null)}
                </p>
              </div>
            </div>

            {/* Capacity bar */}
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">
                  {sessionData.joinedCount}/{sessionData.maxCapacity}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    capacityPercent >= 100
                      ? "bg-destructive"
                      : capacityPercent >= 80
                        ? "bg-yellow-500"
                        : "bg-primary"
                  )}
                  style={{ width: `${Math.min(capacityPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Description */}
            {sessionData.description && (
              <div>
                <h3 className="mb-2 text-sm font-medium">About this session</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {sessionData.description}
                </p>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex-col gap-3">
            {!isLoggedIn ? (
              <Button asChild className="w-full">
                <Link to="/login">Sign in to join</Link>
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link to="/$username/$groupSlug" params={{ username, groupSlug }}>
                View Group
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}

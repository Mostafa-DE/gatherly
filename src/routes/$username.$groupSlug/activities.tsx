import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { useSession } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Layers } from "lucide-react"

export const Route = createFileRoute("/$username/$groupSlug/activities")({
  component: ActivitiesListPage,
})

const JOIN_MODE_LABELS: Record<string, string> = {
  open: "Open",
  require_approval: "Approval Required",
  invite: "Invite Only",
}

function ActivitiesListPage() {
  const { username, groupSlug } = Route.useParams()
  const { data: session, isPending: sessionPending } = useSession()
  const isLoggedIn = !sessionPending && !!session?.user

  const { data: org, isLoading: orgLoading, error: orgError } =
    trpc.organization.getPublicInfo.useQuery({ username, groupSlug })

  const { data: activities, isLoading: activitiesLoading } =
    trpc.activity.listPublicByOrg.useQuery(
      { organizationId: org?.id ?? "" },
      { enabled: !!org?.id }
    )

  if (orgLoading) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="mx-auto max-w-3xl p-4 pt-20">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </>
    )
  }

  if (orgError || !org) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="flex min-h-screen items-center justify-center p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Group Not Found</CardTitle>
              <CardDescription>
                The group you're looking for doesn't exist or has been removed.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button asChild>
                <Link to="/">Go Home</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
      <div className="mx-auto max-w-3xl p-4 pt-20">
        <div className="mb-6">
          <Link
            to="/$username/$groupSlug"
            params={{ username, groupSlug }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; {org.name}
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Activities</h1>
              <p className="text-sm text-muted-foreground">
                Browse and join activities in {org.name}
              </p>
            </div>
          </div>
        </div>

        {activitiesLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {activities.map((activity) => (
              <Link
                key={activity.id}
                to="/$username/$groupSlug/activities/$activitySlug"
                params={{ username, groupSlug, activitySlug: activity.slug }}
                className="group block rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold">{activity.name}</h3>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {JOIN_MODE_LABELS[activity.joinMode] ?? activity.joinMode}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  /{activity.slug}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-primary transition-colors group-hover:text-primary/80">
                    View activity &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-10 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <p className="font-medium">No activities available</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This group hasn't published any activities yet
            </p>
          </div>
        )}
      </div>
    </>
  )
}

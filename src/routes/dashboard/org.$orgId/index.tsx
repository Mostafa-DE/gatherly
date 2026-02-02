import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Calendar, Users, Clock, ArrowRight } from "lucide-react"

export const Route = createFileRoute("/dashboard/org/$orgId/")({
  component: OrgOverviewPage,
})

function OrgOverviewPage() {
  const { orgId } = Route.useParams()
  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const { data: upcomingSessions, isLoading: sessionsLoading } = trpc.session.listUpcoming.useQuery({
    limit: 5,
  })

  if (whoamiLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    )
  }

  const org = whoami?.activeOrganization

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{org?.name}</h1>
        <p className="text-muted-foreground">
          Organization overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Role</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {whoami?.membership?.role}
            </div>
            <p className="text-xs text-muted-foreground">
              {whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"
                ? "Full access to all features"
                : "Member access"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Join Mode</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {org?.defaultJoinMode || "Invite"}
            </div>
            <p className="text-xs text-muted-foreground">
              How new members can join
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timezone</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {org?.timezone || "Not set"}
            </div>
            <p className="text-xs text-muted-foreground">
              Organization timezone
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upcoming Sessions</CardTitle>
              <CardDescription>Sessions you can join</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/org/$orgId/sessions" params={{ orgId }}>
                View all
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : upcomingSessions && upcomingSessions.length > 0 ? (
            <div className="space-y-4">
              {upcomingSessions.map((session, index) => (
                <div key={session.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <Link
                    to="/dashboard/org/$orgId/sessions/$sessionId"
                    params={{ orgId, sessionId: session.id }}
                    className="block space-y-1 hover:text-primary"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{session.title}</span>
                      <Badge
                        variant={session.status === "published" ? "default" : "secondary"}
                      >
                        {session.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(session.dateTime).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No upcoming sessions
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Check, X, Clock } from "lucide-react"

export const Route = createFileRoute("/dashboard/org/$orgId/activity-requests")({
  component: ActivityRequestsPage,
})

function ActivityRequestsPage() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: requests, isLoading: requestsLoading } = trpc.activityMembership.listAllPendingRequests.useQuery(
    undefined,
    { enabled: isAdmin }
  )

  const approveMutation = trpc.activityMembership.approveRequest.useMutation({
    onSuccess: () => {
      utils.activityMembership.listAllPendingRequests.invalidate()
      utils.activityMembership.countAllPendingRequests.invalidate()
      utils.activity.list.invalidate()
    },
  })

  const rejectMutation = trpc.activityMembership.rejectRequest.useMutation({
    onSuccess: () => {
      utils.activityMembership.listAllPendingRequests.invalidate()
      utils.activityMembership.countAllPendingRequests.invalidate()
      utils.activity.list.invalidate()
    },
  })

  if (whoamiLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only group owners and admins can manage activity join requests.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard/org/$orgId" params={{ orgId }}>
                Back to Overview
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Group requests by activity
  const grouped = new Map<string, {
    activity: { id: string; name: string; slug: string }
    items: NonNullable<typeof requests>
  }>()

  for (const item of requests ?? []) {
    const key = item.activity.id
    if (!grouped.has(key)) {
      grouped.set(key, { activity: item.activity, items: [] })
    }
    grouped.get(key)!.items.push(item)
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Join Requests</h1>
        <p className="text-muted-foreground">
          Review and manage pending join requests for activities in your group
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Pending Requests
          </CardTitle>
          <CardDescription>
            Users waiting for approval to join activities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-20" />
                </div>
              ))}
            </div>
          ) : grouped.size === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Pending Requests</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no pending activity join requests at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(grouped.values()).map(({ activity, items }) => (
                <div key={activity.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary shrink-0">
                      {activity.name.charAt(0).toUpperCase()}
                    </span>
                    <h3 className="font-semibold">{activity.name}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {items.length} pending
                    </Badge>
                  </div>
                  <div className="space-y-3 pl-8">
                    {items.map(({ request, user }) => (
                      <div
                        key={request.id}
                        className="rounded-lg border p-4 space-y-2"
                      >
                        <div className="flex items-start gap-4">
                          <Avatar>
                            <AvatarImage src={user.image ?? undefined} alt={user.name} />
                            <AvatarFallback>
                              {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {user.email}
                            </p>
                            {request.message && (
                              <p className="mt-2 text-sm text-muted-foreground italic">
                                &ldquo;{request.message}&rdquo;
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              Requested {new Date(request.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveMutation.mutate({ requestId: request.id })}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <Check className="mr-1 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectMutation.mutate({ requestId: request.id })}
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(approveMutation.error || rejectMutation.error) && (
            <p className="mt-4 text-sm text-destructive text-center">
              {approveMutation.error?.message || rejectMutation.error?.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

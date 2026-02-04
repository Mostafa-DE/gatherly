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
import { UserPlus, Check, X, Clock } from "lucide-react"

export const Route = createFileRoute("/dashboard/org/$orgId/join-requests")({
  component: JoinRequestsPage,
})

function JoinRequestsPage() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: requests, isLoading: requestsLoading } = trpc.joinRequest.listPending.useQuery(
    undefined,
    { enabled: isAdmin }
  )

  const approveMutation = trpc.joinRequest.approve.useMutation({
    onSuccess: () => {
      utils.joinRequest.listPending.invalidate()
      utils.organization.listMembers.invalidate()
    },
  })

  const rejectMutation = trpc.joinRequest.reject.useMutation({
    onSuccess: () => {
      utils.joinRequest.listPending.invalidate()
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
              Only group owners and admins can manage join requests.
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

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Join Requests</h1>
        <p className="text-muted-foreground">
          Review and manage pending join requests for your group
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Pending Requests
          </CardTitle>
          <CardDescription>
            Users waiting for approval to join your group.
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
          ) : requests?.length === 0 ? (
            <div className="rounded-lg border p-8 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No Pending Requests</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                There are no pending join requests at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests?.map(({ request, user }) => (
                <div
                  key={request.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
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
                        "{request.message}"
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

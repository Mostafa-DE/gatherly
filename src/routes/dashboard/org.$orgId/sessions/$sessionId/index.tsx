import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
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
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar, MapPin, Users, Pencil, Trash2 } from "lucide-react"

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
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const {
    data: sessionData,
    isLoading,
    error,
  } = trpc.session.getWithCounts.useQuery({ sessionId })

  const { data: myParticipation, isLoading: participationLoading } =
    trpc.participation.myParticipation.useQuery({ sessionId })

  const joinMutation = trpc.participation.join.useMutation({
    onSuccess: () => {
      utils.participation.myParticipation.invalidate({ sessionId })
      utils.session.getWithCounts.invalidate({ sessionId })
    },
  })

  const cancelMutation = trpc.participation.cancel.useMutation({
    onSuccess: () => {
      utils.participation.myParticipation.invalidate({ sessionId })
      utils.session.getWithCounts.invalidate({ sessionId })
    },
  })

  const updateStatusMutation = trpc.session.updateStatus.useMutation({
    onSuccess: () => {
      utils.session.getWithCounts.invalidate({ sessionId })
      utils.session.listUpcoming.invalidate()
      utils.session.listPast.invalidate()
    },
  })

  const deleteMutation = trpc.session.delete.useMutation({
    onSuccess: () => {
      utils.session.list.invalidate()
      utils.session.listUpcoming.invalidate()
      utils.session.listPast.invalidate()
      navigate({ to: "/dashboard/org/$orgId/sessions", params: { orgId } })
    },
  })

  if (isLoading) {
    return (
      <div className="py-4">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (error || !sessionData) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
            <CardDescription>
              {error?.message || "This session doesn't exist or has been deleted."}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard/org/$orgId/sessions" params={{ orgId }}>
                Back to Sessions
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "published":
        return "default"
      case "draft":
        return "secondary"
      case "cancelled":
        return "destructive"
      case "completed":
        return "outline"
      default:
        return "secondary"
    }
  }

  const canJoin =
    sessionData.status === "published" &&
    !myParticipation &&
    (sessionData.joinedCount < sessionData.maxCapacity ||
      sessionData.waitlistCount < sessionData.maxWaitlist)

  const isJoined = myParticipation?.status === "joined"
  const isWaitlisted = myParticipation?.status === "waitlisted"

  return (
    <div className="py-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{sessionData.title}</CardTitle>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(sessionData.dateTime).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            <Badge variant={statusVariant(sessionData.status)} className="text-sm">
              {sessionData.status}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {sessionData.description && (
            <div>
              <h3 className="font-medium mb-2">Description</h3>
              <p className="text-muted-foreground">{sessionData.description}</p>
            </div>
          )}

          {sessionData.location && (
            <div>
              <h3 className="font-medium mb-2">Location</h3>
              <p className="text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {sessionData.location}
              </p>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">Participants</h3>
              <p className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                {sessionData.joinedCount}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  / {sessionData.maxCapacity}
                </span>
              </p>
            </div>
            {sessionData.maxWaitlist > 0 && (
              <div>
                <h3 className="font-medium mb-2">Waitlist</h3>
                <p className="text-2xl font-bold">
                  {sessionData.waitlistCount}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {sessionData.maxWaitlist}
                  </span>
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Participation Status */}
          {participationLoading ? (
            <div className="rounded-lg border p-4">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : myParticipation ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Your Status</h3>
                  <p className="text-sm text-muted-foreground">
                    {isJoined && "You are registered for this session"}
                    {isWaitlisted && (
                      <>
                        You are on the waitlist
                        {(myParticipation as { waitlistPosition?: number }).waitlistPosition && (
                          <> (Position #{(myParticipation as { waitlistPosition?: number }).waitlistPosition})</>
                        )}
                      </>
                    )}
                    {myParticipation.status === "cancelled" &&
                      "Your registration was cancelled"}
                  </p>
                </div>
                <Badge
                  variant={
                    isJoined
                      ? "default"
                      : isWaitlisted
                        ? "secondary"
                        : "outline"
                  }
                >
                  {myParticipation.status}
                </Badge>
              </div>
              {(isJoined || isWaitlisted) &&
                sessionData.status !== "completed" &&
                sessionData.status !== "cancelled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      cancelMutation.mutate({
                        participationId: myParticipation.id,
                      })
                    }
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending
                      ? "Cancelling..."
                      : "Cancel Registration"}
                  </Button>
                )}
              {cancelMutation.error && (
                <p className="text-sm text-destructive">
                  {cancelMutation.error.message}
                </p>
              )}
            </div>
          ) : canJoin ? (
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <h3 className="font-medium">Join This Session</h3>
                <p className="text-sm text-muted-foreground">
                  {sessionData.joinedCount < sessionData.maxCapacity
                    ? "Spots are available"
                    : "You will be added to the waitlist"}
                </p>
              </div>
              <Button
                onClick={() => joinMutation.mutate({ sessionId })}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending
                  ? "Joining..."
                  : sessionData.joinedCount < sessionData.maxCapacity
                    ? "Join Session"
                    : "Join Waitlist"}
              </Button>
              {joinMutation.error && (
                <p className="text-sm text-destructive">
                  {joinMutation.error.message}
                </p>
              )}
            </div>
          ) : sessionData.status === "published" ? (
            <div className="rounded-lg border p-4">
              <p className="text-muted-foreground">
                This session is full and the waitlist is at capacity.
              </p>
            </div>
          ) : null}
        </CardContent>

        {/* Admin Actions */}
        {isAdmin && (
          <CardFooter className="flex-col items-start gap-4 border-t pt-6">
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
                >
                  Publish Session
                </Button>
              )}
              {sessionData.status === "published" && (
                <Button
                  onClick={() =>
                    updateStatusMutation.mutate({
                      sessionId,
                      status: "completed",
                    })
                  }
                  disabled={updateStatusMutation.isPending}
                >
                  Mark Completed
                </Button>
              )}
              {(sessionData.status === "draft" ||
                sessionData.status === "published") && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    updateStatusMutation.mutate({
                      sessionId,
                      status: "cancelled",
                    })
                  }
                  disabled={updateStatusMutation.isPending}
                >
                  Cancel Session
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link
                  to="/dashboard/org/$orgId/sessions/$sessionId/roster"
                  params={{ orgId, sessionId }}
                >
                  View Roster
                </Link>
              </Button>
              {(sessionData.status === "draft" ||
                sessionData.status === "published") && (
                <Button variant="outline" asChild>
                  <Link
                    to="/dashboard/org/$orgId/sessions/$sessionId/edit"
                    params={{ orgId, sessionId }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>

            {/* Delete Section with Inline Confirmation */}
            <div className="w-full border-t pt-4 mt-2">
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                Danger Zone
              </h4>
              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Session
                </Button>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-md border border-destructive bg-destructive/10">
                  <span className="text-sm text-destructive">
                    Are you sure? This action cannot be undone.
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteMutation.mutate({ sessionId })}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
                  </Button>
                  <Button
                    variant="outline"
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

            {updateStatusMutation.error && (
              <p className="text-sm text-destructive">
                {updateStatusMutation.error.message}
              </p>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  )
}

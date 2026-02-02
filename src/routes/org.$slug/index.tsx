import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { useSession } from "@/auth/client"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, Lock, UserPlus, Clock, CheckCircle } from "lucide-react"

export const Route = createFileRoute("/org/$slug/")({
  component: PublicOrgPage,
})

function PublicOrgPage() {
  const { slug } = Route.useParams()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const utils = trpc.useUtils()

  // Get public org info
  const { data: org, isLoading: orgLoading, error: orgError } = trpc.organization.getPublicInfo.useQuery({ slug })

  // Check if user has a pending join request (only if authenticated)
  const { data: pendingRequest } = trpc.joinRequest.myPendingRequest.useQuery(
    { organizationId: org?.id ?? "" },
    { enabled: !!session?.user && !!org?.id }
  )

  // Check if user is already a member
  const { data: myOrgs } = trpc.user.myOrgs.useQuery(undefined, {
    enabled: !!session?.user,
  })
  const isMember = myOrgs?.some((m) => m.organization.id === org?.id)

  // Join org mutation (for open mode)
  const joinOrgMutation = trpc.organization.joinOrg.useMutation({
    onSuccess: () => {
      utils.user.myOrgs.invalidate()
      navigate({ to: "/dashboard" })
    },
  })

  // Request to join mutation (for approval mode)
  const requestJoinMutation = trpc.joinRequest.request.useMutation({
    onSuccess: () => {
      utils.joinRequest.myPendingRequest.invalidate()
    },
  })

  if (orgLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="mx-auto h-16 w-16 rounded-full" />
            <Skeleton className="mx-auto mt-4 h-8 w-48" />
            <Skeleton className="mx-auto mt-2 h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (orgError || !org) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Organization Not Found</CardTitle>
            <CardDescription>
              The organization you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button asChild>
              <Link to="/">Go Home</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const handleJoin = () => {
    if (!session?.user) {
      navigate({ to: "/login" })
      return
    }

    if (org.defaultJoinMode === "open") {
      joinOrgMutation.mutate({ organizationId: org.id })
    } else if (org.defaultJoinMode === "approval") {
      requestJoinMutation.mutate({ organizationId: org.id })
    }
  }

  const getJoinButton = () => {
    if (!session?.user) {
      return (
        <Button onClick={() => navigate({ to: "/login" })} className="w-full">
          <UserPlus className="mr-2 h-4 w-4" />
          Sign in to Join
        </Button>
      )
    }

    if (isMember) {
      return (
        <Button asChild className="w-full">
          <Link to="/dashboard">
            <CheckCircle className="mr-2 h-4 w-4" />
            Go to Dashboard
          </Link>
        </Button>
      )
    }

    if (pendingRequest) {
      return (
        <Button disabled className="w-full">
          <Clock className="mr-2 h-4 w-4" />
          Request Pending
        </Button>
      )
    }

    switch (org.defaultJoinMode) {
      case "open":
        return (
          <Button
            onClick={handleJoin}
            disabled={joinOrgMutation.isPending}
            className="w-full"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {joinOrgMutation.isPending ? "Joining..." : "Join Organization"}
          </Button>
        )
      case "approval":
        return (
          <Button
            onClick={handleJoin}
            disabled={requestJoinMutation.isPending}
            className="w-full"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            {requestJoinMutation.isPending ? "Requesting..." : "Request to Join"}
          </Button>
        )
      case "invite":
        return (
          <Button disabled className="w-full">
            <Lock className="mr-2 h-4 w-4" />
            Invite Only
          </Button>
        )
      default:
        return null
    }
  }

  const getJoinModeLabel = () => {
    switch (org.defaultJoinMode) {
      case "open":
        return <Badge variant="secondary">Open</Badge>
      case "approval":
        return <Badge variant="secondary">Requires Approval</Badge>
      case "invite":
        return <Badge variant="outline">Invite Only</Badge>
      default:
        return null
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Avatar className="mx-auto h-16 w-16">
            <AvatarImage src={org.logo ?? undefined} alt={org.name} />
            <AvatarFallback className="text-xl">
              {org.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="mt-4 text-2xl">{org.name}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
          </CardDescription>
          <div className="mt-2">{getJoinModeLabel()}</div>
        </CardHeader>
        <CardContent className="space-y-4">
          {getJoinButton()}

          {joinOrgMutation.error && (
            <p className="text-sm text-destructive text-center">
              {joinOrgMutation.error.message}
            </p>
          )}
          {requestJoinMutation.error && (
            <p className="text-sm text-destructive text-center">
              {requestJoinMutation.error.message}
            </p>
          )}
          {requestJoinMutation.isSuccess && (
            <p className="text-sm text-muted-foreground text-center">
              Your request has been submitted. You'll be notified when an admin reviews it.
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Button variant="ghost" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

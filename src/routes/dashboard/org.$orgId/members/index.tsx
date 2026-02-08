import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  MoreVertical,
  Shield,
  UserMinus,
  Crown,
  UserPlus,
  XCircle,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/dashboard/org/$orgId/members/")({
  component: MembersPage,
})

function MembersPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: members, isLoading: membersLoading } = trpc.organization.listMembers.useQuery(
    undefined,
    { enabled: isAdmin }
  )
  const { data: pendingJoinRequests } = trpc.joinRequest.listPending.useQuery(
    undefined,
    { enabled: isAdmin }
  )

  const pendingJoinRequestsCount = pendingJoinRequests?.length ?? 0

  const removeMutation = trpc.organization.removeMember.useMutation({
    onSuccess: () => {
      utils.organization.listMembers.invalidate()
    },
  })

  const updateRoleMutation = trpc.organization.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.organization.listMembers.invalidate()
    },
  })

  if (whoamiLoading) {
    return (
      <div className="space-y-8 py-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Only group owners and admins can view members.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId" params={{ orgId }}>
            Back to Overview
          </Link>
        </Button>
      </div>
    )
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return {
          icon: Crown,
          text: "Owner",
          className: "bg-primary/10 text-primary",
        }
      case "admin":
        return {
          icon: Shield,
          text: "Admin",
          className: "bg-yellow-500/10 text-yellow-600",
        }
      default:
        return {
          icon: Users,
          text: "Member",
          className: "bg-muted text-muted-foreground",
        }
    }
  }

  return (
    <div className="space-y-10 py-6">
      {/* Hero Section */}
      <div>
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <Users className="mr-2 h-3.5 w-3.5" />
          Members
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Manage{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Members
              </span>
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {members?.length || 0} member{members?.length !== 1 ? "s" : ""} in your group
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/org/$orgId/join-requests" params={{ orgId }} className="inline-flex items-center">
                <Mail className="mr-2 h-4 w-4" />
                Join Requests
                {pendingJoinRequestsCount > 0 && (
                  <Badge className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums">
                    {pendingJoinRequestsCount > 99 ? "99+" : pendingJoinRequestsCount}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard/org/$orgId/invitations" params={{ orgId }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        {membersLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border border-border/50 bg-background/50 p-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : members?.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium">No Members</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your group doesn't have any members yet.
            </p>
            <Button asChild className="mt-4">
              <Link to="/dashboard/org/$orgId/invitations" params={{ orgId }}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Members
              </Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {members?.map(({ member, user }) => {
              const role = getRoleBadge(member.role)
              const RoleIcon = role.icon

              return (
                <div
                  key={member.id}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/30",
                    isAdmin && "cursor-pointer"
                  )}
                  onClick={() => {
                    if (isAdmin) {
                      navigate({
                        to: "/dashboard/org/$orgId/members/$userId",
                        params: { orgId, userId: user.id },
                      })
                    }
                  }}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user.image ?? undefined} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {user.name}
                      {user.id === whoami?.user?.id && (
                        <span className="ml-2 text-sm text-muted-foreground">(You)</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      role.className
                    )}>
                      <RoleIcon className="h-3 w-3" />
                      {role.text}
                    </span>
                    {isAdmin && member.role !== "owner" && user.id !== whoami?.user?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.role === "member" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateRoleMutation.mutate({
                                  memberId: member.id,
                                  role: "admin",
                                })
                              }
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              Make Admin
                            </DropdownMenuItem>
                          )}
                          {member.role === "admin" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateRoleMutation.mutate({
                                  memberId: member.id,
                                  role: "member",
                                })
                              }
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Remove Admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              removeMutation.mutate({ memberId: member.id })
                            }
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Remove Member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {(removeMutation.error || updateRoleMutation.error) && (
          <p className="mt-4 text-sm text-destructive text-center">
            {removeMutation.error?.message || updateRoleMutation.error?.message}
          </p>
        )}
      </div>

    </div>
  )
}

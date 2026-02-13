import { useState } from "react"
import { Link, useParams, useRouterState } from "@tanstack/react-router"
import {
  LayoutDashboard,
  Calendar,
  User,
  Users,
  Settings,
  Shield,
  UserPlus,
  BarChart3,
  Layers,
  Check,
  LogIn,
  Clock,
  ClipboardList,
} from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { useActivityContext } from "@/hooks/use-activity-context"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type NavItem = {
  title: string
  url: string
  icon: React.ElementType
  adminOnly?: boolean
}

const mainNavItems: NavItem[] = [
  {
    title: "Overview",
    url: "/dashboard/org/$orgId",
    icon: LayoutDashboard,
  },
  {
    title: "Sessions",
    url: "/dashboard/org/$orgId/sessions",
    icon: Calendar,
  },
  {
    title: "Group Profile",
    url: "/dashboard/org/$orgId/profile",
    icon: User,
  },
]

const adminNavItems: NavItem[] = [
  {
    title: "Join Requests",
    url: "/dashboard/org/$orgId/join-requests",
    icon: UserPlus,
    adminOnly: true,
  },
  {
    title: "Activity Requests",
    url: "/dashboard/org/$orgId/activity-requests",
    icon: ClipboardList,
    adminOnly: true,
  },
  {
    title: "Members",
    url: "/dashboard/org/$orgId/members",
    icon: Users,
    adminOnly: true,
  },
  {
    title: "Activities",
    url: "/dashboard/org/$orgId/activities",
    icon: Layers,
    adminOnly: true,
  },
  {
    title: "Analytics",
    url: "/dashboard/org/$orgId/analytics",
    icon: BarChart3,
    adminOnly: true,
  },
  {
    title: "Settings",
    url: "/dashboard/org/$orgId/settings",
    icon: Settings,
    adminOnly: true,
  },
]

export function NavMain() {
  const { orgId } = useParams({ strict: false })
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const { setOpenMobile } = useSidebar()
  const [confirmJoinActivityId, setConfirmJoinActivityId] = useState<string | null>(null)

  const { activities, isMultiActivity, selectedActivityId, setSelectedActivity } =
    useActivityContext(orgId ?? "")
  const utils = trpc.useUtils()
  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"
  const { data: pendingJoinRequests } = trpc.joinRequest.listPending.useQuery(
    undefined,
    { enabled: isAdmin }
  )
  const { data: pendingApprovals } = trpc.participation.pendingApprovalsSummary.useQuery(
    { limit: 1 },
    { enabled: isAdmin }
  )
  const { data: pendingActivityRequestsCount } = trpc.activityMembership.countAllPendingRequests.useQuery(
    undefined,
    { enabled: isAdmin }
  )

  const joinActivity = trpc.activityMembership.join.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate()
      toast.success("Joined activity")
    },
    onError: (err) => toast.error(err.message),
  })
  const requestJoinActivity = trpc.activityMembership.requestJoin.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate()
      utils.activityMembership.countAllPendingRequests.invalidate()
      toast.success("Join request sent")
    },
    onError: (err) => toast.error(err.message),
  })

  const pendingJoinRequestsCount = pendingJoinRequests?.length ?? 0
  const pendingSessionApprovalsCount = pendingApprovals?.totalPending ?? 0
  const activityRequestsBadgeCount = pendingActivityRequestsCount ?? 0

  const handleNavClick = () => {
    setOpenMobile(false)
  }

  const isActive = (url: string) => {
    const resolvedUrl = url.replace("$orgId", orgId ?? "")
    // Check if current path starts with the nav item URL (for nested routes)
    // But exact match for overview
    if (url === "/dashboard/org/$orgId") {
      return currentPath === resolvedUrl
    }
    return currentPath.startsWith(resolvedUrl)
  }

  const getBadgeCount = (title: string) => {
    if (!isAdmin) return 0
    if (title === "Sessions") return pendingSessionApprovalsCount
    if (title === "Join Requests") return pendingJoinRequestsCount
    if (title === "Activity Requests") return activityRequestsBadgeCount
    return 0
  }

  if (!orgId) {
    return null
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          Navigation
        </SidebarGroupLabel>
        <SidebarMenu>
          {mainNavItems.map((item) => {
            const active = isActive(item.url)
            const badgeCount = getBadgeCount(item.title)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.title}
                  className={cn(
                    "transition-all duration-200",
                    active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  )}
                >
                  <Link
                    to={item.url}
                    params={{ orgId }}
                    onClick={handleNavClick}
                  >
                    <item.icon className={cn(
                      "size-4",
                      active && "text-primary"
                    )} />
                    <span>{item.title}</span>
                    {badgeCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums group-data-[collapsible=icon]:hidden">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </Badge>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>

      {isAdmin && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="size-3" />
            Admin
          </SidebarGroupLabel>
          <SidebarMenu>
            {adminNavItems.map((item) => {
              const active = isActive(item.url)
              const badgeCount = getBadgeCount(item.title)
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className={cn(
                      "transition-all duration-200",
                      active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    )}
                  >
                    <Link
                      to={item.url}
                      params={{ orgId }}
                      onClick={handleNavClick}
                    >
                      <item.icon className={cn(
                        "size-4",
                        active && "text-primary"
                      )} />
                      <span>{item.title}</span>
                      {badgeCount > 0 && (
                        <Badge className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums group-data-[collapsible=icon]:hidden">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      )}

      {/* Join Request Confirmation Dialog */}
      <AlertDialog
        open={confirmJoinActivityId !== null}
        onOpenChange={(open) => { if (!open) setConfirmJoinActivityId(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request to Join Activity</AlertDialogTitle>
            <AlertDialogDescription>
              This activity requires admin approval. Your request will be reviewed
              by an administrator. You&apos;ll be notified once it&apos;s been approved or declined.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmJoinActivityId) {
                  requestJoinActivity.mutate({ activityId: confirmJoinActivityId })
                  setConfirmJoinActivityId(null)
                }
              }}
            >
              Send Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isMultiActivity && (
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="size-3" />
            Activities
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="All Activities"
                isActive={selectedActivityId === null}
                onClick={() => {
                  setSelectedActivity(null)
                  handleNavClick()
                }}
                className={cn(
                  "transition-all duration-200 cursor-pointer",
                  selectedActivityId === null && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                )}
              >
                <Layers className={cn(
                  "size-4",
                  selectedActivityId === null && "text-primary"
                )} />
                <span>All Activities</span>
                {selectedActivityId === null && (
                  <Check className="ml-auto size-4 text-primary group-data-[collapsible=icon]:hidden" />
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            {activities.map((a) => {
              const isSelected = selectedActivityId === a.id
              const isMember = a.myMembershipStatus === "active"
              const hasPendingRequest = a.myJoinRequestStatus === "pending"
              const canJoin = !isAdmin && !isMember && !hasPendingRequest && a.joinMode === "open"
              const canRequest = !isAdmin && !isMember && !hasPendingRequest && a.joinMode === "require_approval"
              const isMutating = joinActivity.isPending || requestJoinActivity.isPending

              // Hide invite-only activities from non-admin non-members
              if (!isAdmin && !isMember && a.joinMode === "invite") {
                return null
              }

              // Admins can always select any activity, members can select their activities
              if (isMember || isAdmin) {
                return (
                  <SidebarMenuItem key={a.id}>
                    <SidebarMenuButton
                      tooltip={a.name}
                      isActive={isSelected}
                      onClick={() => {
                        setSelectedActivity(a.id)
                        handleNavClick()
                      }}
                      className={cn(
                        "transition-all duration-200 cursor-pointer",
                        isSelected && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                      )}
                    >
                      <span className={cn(
                        "size-4 flex items-center justify-center rounded text-[10px] font-bold shrink-0",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}>
                        {a.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{a.name}</span>
                      {isSelected && (
                        <Check className="ml-auto size-4 text-primary group-data-[collapsible=icon]:hidden" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              }

              return (
                <SidebarMenuItem key={a.id}>
                  <SidebarMenuButton
                    tooltip={
                      hasPendingRequest ? `${a.name} (request pending)`
                      : canJoin ? `Join ${a.name}`
                      : canRequest ? `Request to join ${a.name}`
                      : a.name
                    }
                    disabled={isMutating || hasPendingRequest}
                    onClick={() => {
                      if (hasPendingRequest) return
                      if (canJoin) {
                        joinActivity.mutate({ activityId: a.id })
                      } else if (canRequest) {
                        setConfirmJoinActivityId(a.id)
                      }
                    }}
                    className={cn(
                      "transition-all duration-200",
                      hasPendingRequest
                        ? "text-muted-foreground opacity-70 cursor-default"
                        : "cursor-pointer text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="size-4 flex items-center justify-center rounded text-[10px] font-bold shrink-0 bg-muted text-muted-foreground">
                      {a.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{a.name}</span>
                    {hasPendingRequest && (
                      <Clock className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                    )}
                    {canJoin && (
                      <LogIn className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                    )}
                    {canRequest && (
                      <UserPlus className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  )
}

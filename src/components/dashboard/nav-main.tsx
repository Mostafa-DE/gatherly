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
} from "lucide-react"
import { trpc } from "@/lib/trpc"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
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
    title: "Members",
    url: "/dashboard/org/$orgId/members",
    icon: Users,
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

  const pendingJoinRequestsCount = pendingJoinRequests?.length ?? 0
  const pendingSessionApprovalsCount = pendingApprovals?.totalPending ?? 0

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
    </>
  )
}

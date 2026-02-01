import { Link, useParams, useRouterState } from "@tanstack/react-router"
import { LayoutDashboard, Calendar, User, Users, Settings } from "lucide-react"
import { trpc } from "@/lib/trpc"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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
    title: "My Profile",
    url: "/dashboard/org/$orgId/profile",
    icon: User,
  },
]

const adminNavItems: NavItem[] = [
  {
    title: "Members",
    url: "/dashboard/org/$orgId/members",
    icon: Users,
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

  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const isActive = (url: string) => {
    const resolvedUrl = url.replace("$orgId", orgId ?? "")
    // Check if current path starts with the nav item URL (for nested routes)
    // But exact match for overview
    if (url === "/dashboard/org/$orgId") {
      return currentPath === resolvedUrl
    }
    return currentPath.startsWith(resolvedUrl)
  }

  if (!orgId) {
    return null
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarMenu>
          {mainNavItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
              >
                <Link
                  to={item.url}
                  params={{ orgId }}
                >
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      {isAdmin && (
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarMenu>
            {adminNavItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.url)}
                  tooltip={item.title}
                >
                  <Link
                    to={item.url}
                    params={{ orgId }}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      )}
    </>
  )
}

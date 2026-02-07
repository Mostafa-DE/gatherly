import { Link, useParams, useRouterState } from "@tanstack/react-router"
import { LayoutDashboard, Calendar, User, Users, Settings, Shield } from "lucide-react"
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
  const { setOpenMobile } = useSidebar()

  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

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

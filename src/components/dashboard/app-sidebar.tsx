import { Link, useRouterState } from "@tanstack/react-router"
import { Building2, Mail, Calendar } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar"
import { OrgSwitcher } from "./org-switcher"
import { NavMain } from "./nav-main"
import { UserMenu } from "./user-menu"
import { trpc } from "@/lib/trpc"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Use pathname to reliably detect if we're in an org context
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isOrgRoute = pathname.includes("/dashboard/org/")

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50" {...props}>
      <SidebarHeader className="border-b border-border/50">
        {isOrgRoute ? (
          <OrgSwitcher />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Dashboard">
                <Link to="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Calendar className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Gatherly</span>
                    <span className="truncate text-xs text-muted-foreground">Dashboard</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>
      <SidebarContent>
        {isOrgRoute ? (
          <NavMain />
        ) : (
          <DashboardNav />
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-border/50">
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function DashboardNav() {
  const { setOpenMobile } = useSidebar()
  const { data: orgs } = trpc.user.myOrgs.useQuery()
  const { data: invitations } = trpc.user.listMyInvitations.useQuery()
  const hasInvitations = invitations && invitations.length > 0

  const handleNavClick = () => {
    setOpenMobile(false)
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          Groups
        </SidebarGroupLabel>
        <SidebarMenu>
          {orgs?.map((org) => (
            <SidebarMenuItem key={org.organization.id}>
              <SidebarMenuButton
                asChild
                tooltip={org.organization.name}
                className="transition-all duration-200 hover:bg-primary/10 hover:text-primary"
              >
                <Link
                  to="/dashboard/org/$orgId"
                  params={{ orgId: org.organization.id }}
                  onClick={handleNavClick}
                >
                  <Building2 className="size-4" />
                  <span>{org.organization.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
          Account
        </SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="My Invitations"
              className="transition-all duration-200 hover:bg-primary/10 hover:text-primary"
            >
              <Link to="/dashboard/invitations" onClick={handleNavClick}>
                <Mail className="size-4" />
                <span className="flex items-center gap-2">
                  Invitations
                  {hasInvitations && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                      {invitations.length}
                    </span>
                  )}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </>
  )
}

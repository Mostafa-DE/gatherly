import { Link, useParams } from "@tanstack/react-router"
import { Building2, Home, Mail } from "lucide-react"
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
  const { orgId } = useParams({ strict: false })

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {orgId ? (
          <OrgSwitcher />
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="Dashboard">
                <Link to="/dashboard">
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Home className="size-4" />
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
        {orgId ? (
          <NavMain />
        ) : (
          <DashboardNav />
        )}
      </SidebarContent>
      <SidebarFooter>
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
        <SidebarGroupLabel>Organizations</SidebarGroupLabel>
        <SidebarMenu>
          {orgs?.map((org) => (
            <SidebarMenuItem key={org.organization.id}>
              <SidebarMenuButton asChild tooltip={org.organization.name}>
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
        <SidebarGroupLabel>Account</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="My Invitations">
              <Link to="/dashboard/invitations" onClick={handleNavClick}>
                <Mail className="size-4" />
                <span>
                  Invitations
                  {hasInvitations && (
                    <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
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

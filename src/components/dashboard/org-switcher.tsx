import { ChevronsUpDown, Plus, Building2, Home } from "lucide-react"
import { Link, useNavigate, useParams } from "@tanstack/react-router"
import { organization as orgClient } from "@/auth/client"
import { trpc } from "@/lib/trpc"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export function OrgSwitcher() {
  const navigate = useNavigate()
  const { orgId } = useParams({ strict: false })
  const { isMobile, setOpenMobile } = useSidebar()
  const utils = trpc.useUtils()

  const { data: orgs, isLoading } = trpc.user.myOrgs.useQuery()

  const activeOrg = orgs?.find((o) => o.organization.id === orgId)

  const handleSwitchOrg = async (newOrgId: string) => {
    if (newOrgId === orgId) {
      setOpenMobile(false)
      return
    }

    await orgClient.setActive({ organizationId: newOrgId })
    await utils.invalidate()
    setOpenMobile(false)
    navigate({
      to: ".",
      params: (previousParams) => ({
        ...previousParams,
        orgId: newOrgId,
      }),
    })
  }

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-14" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeOrg?.organization.name ?? "Select Organization"}
                </span>
                {activeOrg && (
                  <span className="truncate text-xs capitalize">
                    {activeOrg.role}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            {orgs?.map((item) => (
              <DropdownMenuItem
                key={item.organization.id}
                onClick={() => handleSwitchOrg(item.organization.id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Building2 className="size-4 shrink-0" />
                </div>
                <span className="flex-1 truncate">{item.organization.name}</span>
                {item.organization.id === orgId && (
                  <span className="text-xs text-muted-foreground">Active</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2 p-2">
              <Link to="/dashboard" onClick={() => setOpenMobile(false)}>
                <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Home className="size-4" />
                </div>
                <span>All Organizations</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

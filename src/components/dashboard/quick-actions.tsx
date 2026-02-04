import { Link, useParams, useRouterState } from "@tanstack/react-router"
import { Plus, Calendar, User, Users, MoreVertical, Settings, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trpc } from "@/lib/trpc"

export function QuickActions() {
  const { orgId } = useParams({ strict: false })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isOrgRoute = pathname.includes("/dashboard/org/")
  const isDashboardHome = pathname === "/dashboard" || pathname === "/dashboard/"
  const { data: whoami } = trpc.user.whoami.useQuery()

  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  // Show "Create Group" button on dashboard home
  if (isDashboardHome) {
    const handleCreateOrgClick = () => {
      const createOrgCard = document.getElementById("create-org-card")
      if (createOrgCard) {
        createOrgCard.scrollIntoView({ behavior: "smooth", block: "center" })
        createOrgCard.click()
      }
    }

    return (
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <Button variant="default" size="sm" onClick={handleCreateOrgClick}>
          <Plus className="size-4 mr-1" />
          <span className="hidden sm:inline">Create Group</span>
          <span className="sm:hidden">New Group</span>
        </Button>
      </div>
    )
  }

  // Only show org quick actions when actually in an org route
  if (!isOrgRoute || !orgId) {
    return null
  }

  return (
    <div className="ml-auto flex items-center gap-1 sm:gap-2">
      {/* Desktop/Tablet: Show buttons inline */}
      <div className="hidden sm:flex items-center gap-2">
        {isAdmin && (
          <Button variant="default" size="sm" asChild>
            <Link to="/dashboard/org/$orgId/sessions/create" params={{ orgId }}>
              <Plus className="size-4 mr-1" />
              Create Session
            </Link>
          </Button>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/org/$orgId/members" params={{ orgId }}>
              <Users className="size-4 mr-1" />
              Members
            </Link>
          </Button>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/org/$orgId/settings" params={{ orgId }}>
              <Settings className="size-4 mr-1" />
              Settings
            </Link>
          </Button>
        )}
      </div>

      {/* Mobile: Dropdown menu (admin only) */}
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 sm:hidden">
              <MoreVertical className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/dashboard/org/$orgId/sessions/create" params={{ orgId }}>
                <Plus className="mr-2 size-4" />
                Create Session
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard/org/$orgId/members" params={{ orgId }}>
                <Users className="mr-2 size-4" />
                Members
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/dashboard/org/$orgId/settings" params={{ orgId }}>
                <Settings className="mr-2 size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

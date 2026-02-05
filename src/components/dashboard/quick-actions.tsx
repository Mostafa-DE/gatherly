import { Link, useParams, useRouterState } from "@tanstack/react-router"
import { Plus, Users, MoreVertical, Settings } from "lucide-react"
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
  const { data: whoami } = trpc.user.whoami.useQuery()

  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  // Only show org quick actions when in an org route
  if (!isOrgRoute || !orgId) {
    return null
  }

  return (
    <div className="ml-auto flex items-center gap-1 sm:gap-2">
      {/* Desktop/Tablet: Show buttons inline */}
      <div className="hidden sm:flex items-center gap-2">
        {isAdmin && (
          <Button variant="default" size="sm" asChild className="shadow-sm">
            <Link to="/dashboard/org/$orgId/sessions/create" params={{ orgId }}>
              <Plus className="size-4 mr-1.5" />
              Create Session
            </Link>
          </Button>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" asChild className="border-border/50 hover:border-primary/50 hover:text-primary transition-colors">
            <Link to="/dashboard/org/$orgId/members" params={{ orgId }}>
              <Users className="size-4 mr-1.5" />
              Members
            </Link>
          </Button>
        )}
        {isAdmin && (
          <Button variant="outline" size="sm" asChild className="border-border/50 hover:border-primary/50 hover:text-primary transition-colors">
            <Link to="/dashboard/org/$orgId/settings" params={{ orgId }}>
              <Settings className="size-4 mr-1.5" />
              Settings
            </Link>
          </Button>
        )}
      </div>

      {/* Mobile: Dropdown menu (admin only) */}
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0 sm:hidden border-border/50">
              <MoreVertical className="size-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl border-border/50">
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/dashboard/org/$orgId/sessions/create" params={{ orgId }}>
                <Plus className="mr-2 size-4 text-primary" />
                Create Session
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link to="/dashboard/org/$orgId/members" params={{ orgId }}>
                <Users className="mr-2 size-4" />
                Members
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="cursor-pointer">
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

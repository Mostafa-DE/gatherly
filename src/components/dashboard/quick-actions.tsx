import { Link, useParams } from "@tanstack/react-router"
import { Plus, Calendar, User, Users, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { trpc } from "@/lib/trpc"

export function QuickActions() {
  const { orgId } = useParams({ strict: false })
  const { data: whoami } = trpc.user.whoami.useQuery()

  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  if (!orgId) {
    return null
  }

  return (
    <div className="ml-auto flex items-center gap-1 sm:gap-2">
      {/* Mobile: icon only, Desktop: icon + text */}
      <Button variant="default" size="sm" asChild className="h-8 w-8 p-0 sm:h-8 sm:w-auto sm:px-3">
        <Link to="/dashboard/org/$orgId/sessions/create" params={{ orgId }}>
          <Plus className="size-4 sm:mr-1" />
          <span className="hidden sm:inline">Create Session</span>
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 sm:h-8 sm:w-auto sm:px-3">
            <MoreVertical className="size-4 sm:hidden" />
            <span className="hidden sm:inline">Quick Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Navigation</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link to="/dashboard/org/$orgId/sessions" params={{ orgId }}>
              <Calendar className="mr-2 size-4" />
              Browse Sessions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/dashboard/org/$orgId/profile" params={{ orgId }}>
              <User className="mr-2 size-4" />
              Edit My Profile
            </Link>
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Admin</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/dashboard/org/$orgId/members" params={{ orgId }}>
                  <Users className="mr-2 size-4" />
                  Manage Members
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

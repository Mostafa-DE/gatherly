import { useState } from "react"
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router"
import { Trophy, Check } from "lucide-react"
import { useActivityContext } from "@/hooks/use-activity-context"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type EnabledPlugins = Record<string, boolean>
type ActivityWithMembership = {
  id: string
  name: string
  enabledPlugins: unknown
  myMembershipStatus: string | null
}

export function TournamentsNavItem() {
  const { orgId } = useParams({ strict: false })
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const navigate = useNavigate()
  const { setOpenMobile } = useSidebar()
  const [popoverOpen, setPopoverOpen] = useState(false)

  const {
    activities,
    selectedActivityId,
  } = useActivityContext(orgId ?? "")

  if (!orgId) return null

  const tournamentActivities = (activities as ActivityWithMembership[]).filter((a) => {
    const plugins = a.enabledPlugins as EnabledPlugins | null
    const isMember = a.myMembershipStatus === "active"
    return plugins?.["tournaments"] === true && isMember
  })

  if (tournamentActivities.length === 0) return null

  const isActive = currentPath.includes("/tournaments")

  const navigateToTournaments = (activityId: string) => {
    setPopoverOpen(false)
    setOpenMobile(false)
    navigate({
      to: "/dashboard/org/$orgId/activities/$activityId/tournaments",
      params: { orgId, activityId },
    })
  }

  const handleClick = () => {
    if (selectedActivityId) {
      const selected = tournamentActivities.find((a) => a.id === selectedActivityId)
      if (selected) {
        navigateToTournaments(selected.id)
        return
      }
    }

    if (tournamentActivities.length === 1) {
      navigateToTournaments(tournamentActivities[0].id)
      return
    }

    setPopoverOpen(true)
  }

  const needsPicker =
    tournamentActivities.length > 1 &&
    (!selectedActivityId || !tournamentActivities.some((a) => a.id === selectedActivityId))

  if (needsPicker) {
    return (
      <SidebarMenuItem>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              isActive={isActive}
              tooltip="Tournaments"
              className={cn(
                "transition-all duration-200",
                isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              )}
              onClick={handleClick}
            >
              <Trophy className={cn("size-4", isActive && "text-primary")} />
              <span>Tournaments</span>
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            className="w-56 p-1"
          >
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Select activity
            </div>
            {tournamentActivities.map((activity) => {
              const isCurrentActivity = currentPath.includes(`/activities/${activity.id}/tournaments`)
              return (
                <button
                  key={activity.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:bg-accent focus-visible:text-accent-foreground",
                    isCurrentActivity && "bg-accent"
                  )}
                  onClick={() => navigateToTournaments(activity.id)}
                >
                  {isCurrentActivity && <Check className="size-3.5 shrink-0" />}
                  <span className={cn(!isCurrentActivity && "pl-5.5")}>
                    {activity.name}
                  </span>
                </button>
              )
            })}
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip="Tournaments"
        className={cn(
          "transition-all duration-200",
          isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        )}
        onClick={handleClick}
      >
        <Trophy className={cn("size-4", isActive && "text-primary")} />
        <span>Tournaments</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

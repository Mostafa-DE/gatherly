import { useState } from "react"
import { useNavigate, useParams, useRouterState } from "@tanstack/react-router"
import { LayoutGrid, Check } from "lucide-react"
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

export function SmartGroupsNavItem() {
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

  const smartGroupActivities = activities.filter((a) => {
    const plugins = a.enabledPlugins as EnabledPlugins | null
    return plugins?.["smart-groups"] === true
  })

  // Nothing to show if no activities have smart groups enabled
  if (smartGroupActivities.length === 0) return null

  const isActive = currentPath.includes("/smart-groups")

  const navigateToSmartGroups = (activityId: string) => {
    setPopoverOpen(false)
    setOpenMobile(false)
    navigate({
      to: "/dashboard/org/$orgId/activities/$activityId/smart-groups",
      params: { orgId, activityId },
    })
  }

  const handleClick = () => {
    // If a specific activity is selected and has smart groups → go directly
    if (selectedActivityId) {
      const selected = smartGroupActivities.find((a) => a.id === selectedActivityId)
      if (selected) {
        navigateToSmartGroups(selected.id)
        return
      }
    }

    // If only one activity has smart groups → go directly
    if (smartGroupActivities.length === 1) {
      navigateToSmartGroups(smartGroupActivities[0].id)
      return
    }

    // Multiple activities, none specifically selected → show picker
    setPopoverOpen(true)
  }

  // If we need a picker (multiple activities, none selected), wrap in popover
  const needsPicker =
    smartGroupActivities.length > 1 &&
    (!selectedActivityId || !smartGroupActivities.some((a) => a.id === selectedActivityId))

  if (needsPicker) {
    return (
      <SidebarMenuItem>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              isActive={isActive}
              tooltip="Smart Grouping"
              className={cn(
                "transition-all duration-200",
                isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              )}
              onClick={handleClick}
            >
              <LayoutGrid className={cn("size-4", isActive && "text-primary")} />
              <span>Smart Grouping</span>
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
            {smartGroupActivities.map((activity) => {
              const isCurrentActivity = currentPath.includes(`/activities/${activity.id}/smart-groups`)
              return (
                <button
                  key={activity.id}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:bg-accent focus-visible:text-accent-foreground",
                    isCurrentActivity && "bg-accent"
                  )}
                  onClick={() => navigateToSmartGroups(activity.id)}
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

  // Direct navigation (single activity or selected activity has smart groups)
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip="Smart Grouping"
        className={cn(
          "transition-all duration-200",
          isActive && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
        )}
        onClick={handleClick}
      >
        <LayoutGrid className={cn("size-4", isActive && "text-primary")} />
        <span>Smart Grouping</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

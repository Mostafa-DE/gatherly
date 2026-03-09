import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/$username/$groupSlug/activities/$activitySlug"
)({
  component: ActivitySlugLayout,
})

function ActivitySlugLayout() {
  return <Outlet />
}

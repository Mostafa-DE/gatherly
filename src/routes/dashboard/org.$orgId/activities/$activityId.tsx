import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/activities/$activityId"
)({
  component: ActivityLayout,
})

function ActivityLayout() {
  return <Outlet />
}

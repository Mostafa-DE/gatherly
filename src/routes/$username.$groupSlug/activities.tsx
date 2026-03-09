import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/$username/$groupSlug/activities")({
  component: ActivitiesLayout,
})

function ActivitiesLayout() {
  return <Outlet />
}

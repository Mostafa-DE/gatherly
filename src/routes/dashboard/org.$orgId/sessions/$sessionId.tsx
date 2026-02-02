import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/sessions/$sessionId"
)({
  component: SessionLayout,
})

function SessionLayout() {
  return <Outlet />
}

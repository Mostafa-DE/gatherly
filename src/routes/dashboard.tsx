import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useSession } from "@/auth/client"
import { AppSidebar, BreadcrumbNav, QuickActions } from "@/components/dashboard"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { useEffect } from "react"

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
})


function DashboardLayout() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isPending && !session?.user) {
      navigate({ to: "/login" })
    }
  }, [isPending, session?.user, navigate])

  // Show loading while checking auth or redirecting
  if (isPending || !session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:h-16 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4 sm:mr-2" />
          <BreadcrumbNav />
          <QuickActions />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-3 sm:p-4">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

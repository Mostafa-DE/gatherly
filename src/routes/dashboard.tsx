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
import { Loader2 } from "lucide-react"

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">G</span>
          </div>
          <span className="text-2xl font-semibold tracking-tight">Gatherly</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
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

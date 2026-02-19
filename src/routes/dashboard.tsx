import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useSession } from "@/auth/client";
import {
  AppSidebar,
  BreadcrumbNav,
  QuickActions,
} from "@/components/dashboard";
import { MobileActivitySwitcher } from "@/components/dashboard/activity-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Calendar, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { data: session, isPending } = useSession();

  if (!isPending && !session?.user) {
    return <Navigate to="/login" />;
  }

  if (!isPending && session?.user && !session.user.onboardingCompleted) {
    return <Navigate to="/onboarding" />;
  }

  // Show loading while checking auth or redirecting
  if (isPending || !session?.user) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center gap-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

        {/* Grid pattern */}
        <div className="absolute inset-0 -z-10 opacity-[0.03]">
          <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Calendar className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">
            Gatherly
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="relative h-svh overflow-y-auto">
        {/* Background gradient matching landing page */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

        {/* Grid pattern */}
        <div className="absolute inset-0 -z-10 opacity-[0.02]">
          <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        </div>

        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-md px-2 sm:h-16 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4 sm:mr-2" />
          <div className="hidden lg:block">
            <BreadcrumbNav />
          </div>
          <MobileActivitySwitcher />
          <QuickActions />
          <ThemeToggle />
        </header>

        {/* Email verification warning banner */}
        {!session.user.emailVerified && (
          <div className="border-b border-yellow-500/20 bg-yellow-500/10 px-4 py-3">
            <div className="mx-auto flex max-w-5xl items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
              <p className="text-sm text-yellow-600">
                <span className="font-medium">
                  Your account will be suspended within 3 days
                </span>{" "}
                if you don't verify your email. Please check the verification
                email we sent to{" "}
                <span className="font-medium">{session.user.email}</span>
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col p-4 sm:p-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

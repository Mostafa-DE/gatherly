import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { DashboardMockup } from "./dashboard-mockup"

interface HeroSectionProps {
  isLoggedIn: boolean
}

export function HeroSection({ isLoggedIn }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden px-4 pb-16 pt-24 sm:px-6 sm:pb-24 sm:pt-32">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />

      {/* Grid pattern */}
      <div className="absolute inset-0 -z-10 opacity-[0.03]">
        <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
          <span className="mr-2 h-2 w-2 rounded-full bg-primary" />
          Session management for modern teams
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
          Run Sessions,{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Not Spreadsheets
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          The modern way to manage recurring group activities. Create sessions,
          handle capacity, track attendance — all in one place.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {isLoggedIn ? (
            <Button asChild size="lg" className="group w-full sm:w-auto">
              <Link to="/dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="group w-full sm:w-auto">
                <Link to="/register">
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to="/login">Sign In</Link>
              </Button>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary sm:text-3xl">1 Free</div>
            <div className="mt-1 text-sm text-muted-foreground">Group forever</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary sm:text-3xl">200</div>
            <div className="mt-1 text-sm text-muted-foreground">Members included</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary sm:text-3xl">$1</div>
            <div className="mt-1 text-sm text-muted-foreground">Then $10/mo</div>
          </div>
        </div>
      </div>

      {/* Dashboard Mockup */}
      <DashboardMockup />
    </section>
  )
}

import { Link } from "@tanstack/react-router"
import { ArrowRight, Zap } from "lucide-react"
import { DashboardMockup } from "@/components/landing/dashboard-mockup"

type HeroSectionProps = {
  isLoggedIn: boolean
  isAuthLoading: boolean
}

export function HeroSection({ isLoggedIn, isAuthLoading }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-background px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-40">
      {/* Diagonal accent */}
      <div
        className="absolute -right-32 bottom-0 top-0 w-[600px] opacity-5"
        style={{
          background: `repeating-linear-gradient(-45deg, transparent, transparent 40px, var(--color-primary) 40px, var(--color-primary) 42px)`,
        }}
      />

      {/* Geometric shapes */}
      <div className="absolute right-20 top-32 hidden h-20 w-20 rotate-12 border-[3px] border-primary opacity-10 lg:block" />
      <div className="absolute left-16 top-48 hidden h-12 w-12 rotate-45 bg-primary opacity-10 lg:block" />

      <div className="relative mx-auto max-w-5xl">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="landing-slide-right landing-body mb-6 inline-flex items-center gap-2 rounded border border-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            <Zap className="h-3 w-3" />
            People coordination source of truth
          </div>

          <h1 className="landing-display landing-slide-up landing-slide-up-1 text-5xl font-bold leading-none text-foreground sm:text-6xl lg:text-8xl">
            Run Sessions,{" "}
            <br className="hidden sm:block" />
            <span className="text-primary">With Clarity</span>
          </h1>

          <p className="landing-body landing-slide-up landing-slide-up-2 mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Gatherly helps organizers, trainers, and teams run recurring activities
            with one reliable record for commitments, capacity, and attendance.
            AI assistance is evolving alongside the core workflow.
          </p>

          <div className="landing-slide-up landing-slide-up-3 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {isAuthLoading ? (
              <span
                className="inline-flex items-center justify-center gap-2 bg-primary/60 px-8 py-4 text-base font-bold text-primary-foreground/90"
                style={{ clipPath: "polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%, 5% 50%)" }}
              >
                CHECKING SESSION...
              </span>
            ) : isLoggedIn ? (
              <Link
                to="/dashboard"
                className="group inline-flex items-center justify-center gap-2 bg-primary px-8 py-4 text-base font-bold text-primary-foreground transition-all"
                style={{ clipPath: "polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%, 5% 50%)" }}
              >
                GO TO DASHBOARD
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="group inline-flex items-center justify-center gap-2 bg-primary px-8 py-4 text-base font-bold text-primary-foreground transition-all"
                  style={{ clipPath: "polygon(0% 0%, 95% 0%, 100% 50%, 95% 100%, 0% 100%, 5% 50%)" }}
                >
                  START FREE
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 border border-[var(--color-primary-border)] px-8 py-4 text-base font-semibold text-primary transition-colors"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Stats bar */}
          <div className="landing-slide-up landing-slide-up-4 mx-auto mt-14 grid max-w-2xl grid-cols-3 border-y border-[var(--color-primary-border)]">
            {[
              { val: "1 HUB", label: "Shared source of truth" },
              { val: "200", label: "Members in free group" },
              { val: "AI+", label: "Enhancing over time" },
            ].map((s) => (
            <div key={s.label} className="py-5 text-center">
              <div className="landing-display text-2xl font-bold text-primary sm:text-3xl">
                {s.val}
              </div>
              <div className="landing-body mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <DashboardMockup />
      </div>
    </section>
  )
}

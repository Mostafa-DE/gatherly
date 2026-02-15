import { Link } from "@tanstack/react-router"
import { ArrowRight, Sparkles } from "lucide-react"

type CTASectionProps = {
  isLoggedIn: boolean
  isAuthLoading: boolean
}

export function CTASection({ isLoggedIn, isAuthLoading }: CTASectionProps) {
  return (
    <section className="bg-card px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <div className="border border-border bg-background p-8 sm:p-14">
          <div className="landing-body mb-4 inline-flex items-center gap-2 rounded border border-[var(--color-primary-border)] px-3 py-1 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            First group free forever
          </div>

          <h2 className="landing-display text-4xl font-bold text-foreground sm:text-6xl">
            {isAuthLoading ? (
              "Checking Your Session"
            ) : isLoggedIn ? (
              "Back to Your Dashboard"
            ) : (
              <>
                Ready to Coordinate{" "}
                <span className="text-primary">with Clarity</span>
                ?
              </>
            )}
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-lg text-base text-muted-foreground">
            {isAuthLoading
              ? "Hold on for a moment while we verify your account."
              : isLoggedIn
              ? "Continue running your recurring workflows with a reliable source of truth."
              : "Start with your first group free forever for up to 200 members. AI assistant enhancements are rolling out iteratively as the platform grows."}
          </p>
          {isAuthLoading ? (
            <span className="landing-glow mt-8 inline-flex items-center gap-2 bg-primary/60 px-10 py-4 text-base font-bold text-primary-foreground/90">
              CHECKING SESSION...
            </span>
          ) : (
            <Link
              to={isLoggedIn ? "/dashboard" : "/register"}
              className="landing-glow group mt-8 inline-flex items-center gap-2 bg-primary px-10 py-4 text-base font-bold text-primary-foreground transition-all"
            >
              {isLoggedIn ? "GO TO DASHBOARD" : "GET STARTED FREE"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

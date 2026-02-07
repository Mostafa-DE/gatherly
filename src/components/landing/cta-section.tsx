import { Link } from "@tanstack/react-router"
import { ArrowRight, Sparkles } from "lucide-react"

interface CTASectionProps {
  isLoggedIn: boolean
}

export function CTASection({ isLoggedIn }: CTASectionProps) {
  return (
    <section className="bg-card px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <div className="border border-border bg-background p-8 sm:p-14">
          <div className="landing-body mb-4 inline-flex items-center gap-2 rounded border border-[var(--color-primary-border)] px-3 py-1 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            First group free forever
          </div>

          <h2 className="landing-display text-4xl font-bold text-foreground sm:text-6xl">
            {isLoggedIn ? (
              "Back to Your Dashboard"
            ) : (
              <>
                Ready to{" "}
                <span className="text-primary">Simplify</span>
                {" "}Your Sessions?
              </>
            )}
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-lg text-base text-muted-foreground">
            {isLoggedIn
              ? "Continue managing your groups and sessions."
              : "Your first group is free forever with up to 200 members. Extra groups just $1 for 3 months, then $10/mo. No hidden fees."}
          </p>
          <Link
            to={isLoggedIn ? "/dashboard" : "/register"}
            className="landing-glow group mt-8 inline-flex items-center gap-2 bg-primary px-10 py-4 text-base font-bold text-primary-foreground transition-all"
          >
            {isLoggedIn ? "GO TO DASHBOARD" : "GET STARTED FREE"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}

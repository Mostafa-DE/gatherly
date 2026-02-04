import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

interface CTASectionProps {
  isLoggedIn: boolean
}

export function CTASection({ isLoggedIn }: CTASectionProps) {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      {/* Grid pattern background */}
      <div className="absolute inset-0 -z-10 opacity-[0.02]">
        <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border bg-card p-8 shadow-lg sm:p-12">
          <div className="relative text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
              <Sparkles className="h-4 w-4" />
              First group free forever
            </div>

            <h2 className="text-2xl font-bold sm:text-3xl">
              {isLoggedIn ? "Back to Your Dashboard" : "Ready to Simplify Your Sessions?"}
            </h2>
            <p className="mt-3 text-muted-foreground">
              {isLoggedIn
                ? "Continue managing your groups and sessions."
                : "Your first group is free forever with up to 200 members. Extra groups just $1 for 3 months, then $10/mo. No hidden fees."}
            </p>
            <div className="mt-8">
              <Button asChild size="lg" className="group shadow-lg">
                <Link to={isLoggedIn ? "/dashboard" : "/register"}>
                  {isLoggedIn ? "Go to Dashboard" : "Get Started Free"}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

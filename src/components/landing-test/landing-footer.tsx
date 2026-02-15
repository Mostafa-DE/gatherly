import { Link } from "@tanstack/react-router"
import { Zap } from "lucide-react"

export function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-background px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div
                className="flex h-6 w-6 items-center justify-center bg-primary"
                style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
              >
                <Zap className="h-3 w-3 text-primary-foreground" />
              </div>
              <span className="landing-display text-sm font-bold text-foreground">
                Gatherly
              </span>
            </div>
            <p className="landing-body mt-3 text-sm text-muted-foreground">
              People coordination for organizers, trainers, and teams.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="landing-body text-sm font-semibold text-foreground">Product</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link to="/register" className="landing-body text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Get Started
                </Link>
              </li>
              <li>
                <Link to="/login" className="landing-body text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="landing-body text-sm font-semibold text-foreground">Resources</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="landing-body text-sm text-[var(--color-text-disabled)]">Documentation (Coming Soon)</span></li>
              <li><span className="landing-body text-sm text-[var(--color-text-disabled)]">API (Coming Soon)</span></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="landing-body text-sm font-semibold text-foreground">Legal</h3>
            <ul className="mt-3 space-y-2">
              <li><span className="landing-body text-sm text-[var(--color-text-disabled)]">Privacy Policy (Coming Soon)</span></li>
              <li><span className="landing-body text-sm text-[var(--color-text-disabled)]">Terms of Service (Coming Soon)</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="landing-body text-sm text-muted-foreground">
            &copy; {year} Gatherly. All rights reserved.
          </p>
          <p className="landing-body text-sm text-muted-foreground">
            Built to keep recurring participation clear and reliable.
          </p>
        </div>
      </div>
    </footer>
  )
}

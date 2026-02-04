import { Link } from "@tanstack/react-router"
import { Calendar } from "lucide-react"

export function LandingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/50 bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Calendar className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Gatherly</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Session management for modern teams. Simple, focused, effective.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  to="/register"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Get Started
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold">Resources</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-sm text-muted-foreground/50">
                  Documentation (Coming Soon)
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground/50">
                  API (Coming Soon)
                </span>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="mt-3 space-y-2">
              <li>
                <span className="text-sm text-muted-foreground/50">
                  Privacy Policy (Coming Soon)
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground/50">
                  Terms of Service (Coming Soon)
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Gatherly. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built for organizers who want simplicity.
          </p>
        </div>
      </div>
    </footer>
  )
}

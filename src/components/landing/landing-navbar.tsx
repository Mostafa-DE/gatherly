import { Link } from "@tanstack/react-router"
import { ArrowRight, Zap } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

type LandingNavbarProps = {
  isLoggedIn: boolean
  isAuthLoading: boolean
}

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Compare", href: "#comparison" },
]

export function LandingNavbar({ isLoggedIn, isAuthLoading }: LandingNavbarProps) {
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-[var(--color-nav-bg)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center bg-primary"
            style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
          >
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="landing-display text-xl font-bold tracking-tight text-foreground">
            Gatherly
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => scrollToSection(e, link.href)}
              className="landing-body rounded px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <nav className="flex items-center gap-3">
          <ThemeToggle />
          {isAuthLoading ? (
            <span className="landing-body flex items-center gap-1.5 rounded bg-primary/60 px-5 py-2.5 text-sm font-bold text-primary-foreground/90">
              Loading...
            </span>
          ) : isLoggedIn ? (
            <Link
              to="/dashboard"
              className="landing-body flex items-center gap-1.5 rounded bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all"
            >
              Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="landing-body hidden rounded px-4 py-2 text-sm font-medium text-muted-foreground transition-colors sm:inline-flex"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="landing-body flex items-center gap-1.5 rounded bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all"
              >
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

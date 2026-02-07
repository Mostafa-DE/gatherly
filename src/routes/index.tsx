import { createFileRoute } from "@tanstack/react-router"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { HeroSection } from "@/components/landing/hero-section"
import { ProblemSection } from "@/components/landing/problem-section"
import { FeaturesSection } from "@/components/landing/features-section"
import { HowItWorksSection } from "@/components/landing/how-it-works-section"
import { UseCasesSection } from "@/components/landing/use-cases-section"
import { ComparisonSection } from "@/components/landing/comparison-section"
import { CTASection } from "@/components/landing/cta-section"
import { LandingFooter } from "@/components/landing/landing-footer"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  const isLoggedIn = true
  const isAuthLoading = false

  return (
    <div className="landing-body">
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading} />
      <HeroSection isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading} />
      <ProblemSection />
      <FeaturesSection />
      <HowItWorksSection />
      <UseCasesSection />
      <ComparisonSection />
      <CTASection isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading} />
      <LandingFooter />
    </div>
  )
}

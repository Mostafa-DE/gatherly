import { createFileRoute } from "@tanstack/react-router"
import { useSession } from "@/auth/client"
import { LandingNavbar } from "@/components/landing-test/landing-navbar"
import { HeroSection } from "@/components/landing-test/hero-section"
import { PositioningSection } from "@/components/landing-test/positioning-section"
import { HowItWorksSection } from "@/components/landing-test/how-it-works-section"
import { FeaturesSection } from "@/components/landing-test/features-section"
import { UseCasesSection } from "@/components/landing-test/use-cases-section"
import { ProblemSection } from "@/components/landing-test/problem-section"
import { CTASection } from "@/components/landing-test/cta-section"
import { LandingFooter } from "@/components/landing-test/landing-footer"
import { DashboardAISimulatorSection } from "@/components/landing-test/dashboard-ai-simulator-section"
import { WorkflowCoverageSection } from "@/components/landing-test/workflow-coverage-section"

export const Route = createFileRoute("/test")({
  component: TestHomePage,
})

function TestHomePage() {
  const { data: session, isPending } = useSession()
  const isLoggedIn = !!session?.user
  const isAuthLoading = isPending

  return (
    <div className="landing-body">
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading} />
      <HeroSection isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading} />
      <PositioningSection />
      <HowItWorksSection />
      <FeaturesSection />
      <WorkflowCoverageSection />
      <DashboardAISimulatorSection />
      <UseCasesSection />
      <ProblemSection />
      <CTASection isLoggedIn={isLoggedIn} isAuthLoading={isAuthLoading} />
      <LandingFooter />
    </div>
  )
}

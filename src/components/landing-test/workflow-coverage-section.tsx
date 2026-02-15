import {
  CalendarDays,
  Users,
  UserRound,
  Link2,
  BarChart3,
  Sparkles,
} from "lucide-react"

const capabilities = [
  {
    icon: CalendarDays,
    title: "Session Operations",
    description:
      "Create recurring sessions with capacity and waitlist control.",
    route: "/dashboard/org/$orgId/sessions",
  },
  {
    icon: Users,
    title: "Attendance Tracking",
    description:
      "Track confirmed participants and attendance history per session.",
    route: "/dashboard/org/$orgId/sessions/$sessionId/participants",
  },
  {
    icon: UserRound,
    title: "Member Management",
    description:
      "Manage member profiles, roles, and custom data in one place.",
    route: "/dashboard/org/$orgId/members",
  },
  {
    icon: Link2,
    title: "Access Flows",
    description:
      "Handle invite links, join requests, and activity requests from dashboard.",
    route: "/dashboard/org/$orgId/invite-links",
  },
  {
    icon: BarChart3,
    title: "Analytics Summary",
    description:
      "View participation and trend summaries without spreadsheet exports.",
    route: "/dashboard/org/$orgId/analytics",
  },
  {
    icon: Sparkles,
    title: "AI Insights (Current)",
    description:
      "Generate analytics insights from the same implemented AI workflow.",
    route: "/dashboard/org/$orgId/analytics",
  },
]

export function WorkflowCoverageSection() {
  return (
    <section className="bg-card px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="landing-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
            /test Direction
          </span>
          <h2 className="landing-display mt-2 text-3xl font-bold text-foreground sm:text-5xl">
            Built to Fit Almost Any Recurring Workflow
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-3xl text-base text-muted-foreground">
            For communities, classes, teams, and internal programs. These are real,
            already-implemented dashboard capabilities.
          </p>
        </div>

        <div className="mt-12 grid gap-px bg-[var(--color-primary-subtle)] sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability) => (
            <div key={capability.title} className="bg-card p-7">
              <capability.icon className="h-7 w-7 text-primary" />
              <h3 className="landing-display mt-4 text-base font-bold text-foreground">
                {capability.title}
              </h3>
              <p className="landing-body mt-2 text-sm leading-relaxed text-muted-foreground">
                {capability.description}
              </p>
              <p className="landing-body mt-3 text-xs font-semibold uppercase tracking-wide text-primary">
                {capability.route}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

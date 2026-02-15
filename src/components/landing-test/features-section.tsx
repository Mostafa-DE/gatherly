import {
  Calendar,
  Users,
  ArrowUpCircle,
  CheckCircle,
  UserCog,
  Link as LinkIcon,
} from "lucide-react"

const features = [
  { icon: Calendar, title: "Session Planning", desc: "Create repeatable sessions with date, time, location, and capacity in minutes." },
  { icon: Users, title: "Unified Roster", desc: "Track joined, waitlisted, and cancelled members in one consistent place." },
  { icon: ArrowUpCircle, title: "Auto-Promote Waitlist", desc: "When someone cancels, capacity is rebalanced automatically based on waitlist order." },
  { icon: CheckCircle, title: "Attendance Memory", desc: "Mark attendance and build long-term participation history your team can trust." },
  { icon: UserCog, title: "Profile Data That Fits", desc: "Capture only the member details your workflow needs, from basic info to custom fields." },
  { icon: LinkIcon, title: "Shareable Access", desc: "Send one link and keep participation updates synced without spreadsheet cleanup." },
]

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="scroll-mt-20 bg-background px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="landing-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Features
          </span>
          <h2 className="landing-display mt-2 text-3xl font-bold text-foreground sm:text-5xl">
            Coordination Primitives That Scale with Your Group
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            Focused capabilities for recurring activity operations, with AI-assisted
            enhancements being rolled out over time.
          </p>
        </div>

        <div className="mt-14 grid gap-px bg-[var(--color-primary-subtle)] sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group bg-background p-7 transition-colors"
            >
              <f.icon className="h-7 w-7 text-primary" />
              <h3 className="landing-display mt-4 text-base font-bold text-foreground">
                {f.title}
              </h3>
              <p className="landing-body mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

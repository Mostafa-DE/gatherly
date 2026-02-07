import {
  Calendar,
  Users,
  ArrowUpCircle,
  CheckCircle,
  UserCog,
  Link as LinkIcon,
} from "lucide-react"

const features = [
  { icon: Calendar, title: "Session Management", desc: "Create sessions with date, time, location, and capacity. Publish when ready." },
  { icon: Users, title: "Smart Capacity", desc: "Set limits and automatic waitlist. No overbooking, no manual tracking." },
  { icon: ArrowUpCircle, title: "Auto-Promote", desc: "When someone cancels, the next person on waitlist gets the spot automatically." },
  { icon: CheckCircle, title: "Attendance Tracking", desc: "Mark who showed up. Build reliable attendance history over time." },
  { icon: UserCog, title: "Custom Fields", desc: "Collect the member info you need. Phone, emergency contact, skill level — anything." },
  { icon: LinkIcon, title: "One Link", desc: "Share a single link. Members sign up. You see participants update in real-time." },
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
            Everything You Need, Nothing You Don't
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            Built for one thing: running great sessions. Simple, focused, effective.
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

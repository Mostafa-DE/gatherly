import {
  Calendar,
  Users,
  ArrowUpCircle,
  CheckCircle,
  UserCog,
  Link as LinkIcon
} from "lucide-react"

const features = [
  {
    icon: Calendar,
    title: "Session Management",
    description: "Create sessions with date, time, location, and capacity. Publish when ready.",
  },
  {
    icon: Users,
    title: "Smart Capacity",
    description: "Set limits and automatic waitlist. No overbooking, no manual tracking.",
  },
  {
    icon: ArrowUpCircle,
    title: "Auto-Promote",
    description: "When someone cancels, the next person on waitlist gets the spot automatically.",
  },
  {
    icon: CheckCircle,
    title: "Attendance Tracking",
    description: "Mark who showed up. Build reliable attendance history over time.",
  },
  {
    icon: UserCog,
    title: "Custom Fields",
    description: "Collect the member info you need. Phone, emergency contact, skill level — anything.",
  },
  {
    icon: LinkIcon,
    title: "One Link",
    description: "Share a single link. Members sign up. You see the roster update in real-time.",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative scroll-mt-20 overflow-hidden py-16 sm:py-24">
      {/* Grid pattern background */}
      <div className="absolute inset-0 -z-10 opacity-[0.02]">
        <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-wider text-primary">
            Features
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            Everything You Need, Nothing You Don't
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Built for one thing: running great sessions. Simple, focused, effective.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

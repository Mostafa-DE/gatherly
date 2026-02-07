import { Users, CalendarPlus, Share2 } from "lucide-react"

const steps = [
  { icon: Users, num: "01", title: "Create Your Group", desc: "Set up your group in seconds. Add custom fields if you need them." },
  { icon: CalendarPlus, num: "02", title: "Create a Session", desc: "Pick a date, set the capacity, and publish when ready." },
  { icon: Share2, num: "03", title: "Share the Link", desc: "Members join with one click. You see who's coming in real-time." },
]

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 bg-card px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="landing-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Process
            </span>
            <h2 className="landing-display mt-2 text-3xl font-bold text-foreground sm:text-5xl">
              Get Started in 3 Steps
            </h2>
          </div>
          <p className="landing-body max-w-sm text-sm text-muted-foreground">
            No complicated setup. No steep learning curve. Just create and go.
          </p>
        </div>

        <div className="mt-14 grid gap-px bg-[var(--color-primary-subtle)] md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.num}
              className="group bg-card p-8 transition-colors"
            >
              <div className="flex items-start justify-between">
                <step.icon className="h-8 w-8 text-primary" />
                <span className="landing-display text-4xl font-bold text-foreground opacity-20">
                  {step.num}
                </span>
              </div>
              <h3 className="landing-display mt-6 text-xl font-bold text-foreground">
                {step.title}
              </h3>
              <p className="landing-body mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

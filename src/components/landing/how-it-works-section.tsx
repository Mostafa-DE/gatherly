import { Users, CalendarPlus, Share2 } from "lucide-react"

const steps = [
  {
    number: "1",
    icon: Users,
    title: "Create Your Group",
    description: "Set up your group in seconds. Add custom fields if you need them.",
  },
  {
    number: "2",
    icon: CalendarPlus,
    title: "Create a Session",
    description: "Pick a date, set the capacity, and publish when ready.",
  },
  {
    number: "3",
    icon: Share2,
    title: "Share the Link",
    description: "Members join with one click. You see who's coming in real-time.",
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative scroll-mt-20 overflow-hidden bg-muted/30 py-16 sm:py-24">
      {/* Grid pattern */}
      <div className="absolute inset-0 -z-10 opacity-[0.02]">
        <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-wider text-primary">
            How It Works
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            Get Started in 3 Steps
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            No complicated setup. No steep learning curve. Just create and go.
          </p>
        </div>

        <div className="mt-12">
          {/* Desktop horizontal layout */}
          <div className="hidden md:block">
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-[16.67%] right-[16.67%] top-[4.5rem] h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

              <div className="relative grid grid-cols-3 gap-8">
                {steps.map((step) => (
                  <div
                    key={step.number}
                    className="group flex flex-col items-center text-center"
                  >
                    {/* Icon box */}
                    <div className="relative z-10 flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-primary/20 bg-card shadow-lg transition-all group-hover:border-primary/40 group-hover:shadow-xl">
                      <step.icon className="h-14 w-14 text-primary transition-transform group-hover:scale-110" />
                    </div>

                    {/* Step number */}
                    <div className="mt-4 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-md">
                      {step.number}
                    </div>

                    <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile vertical layout */}
          <div className="space-y-6 md:hidden">
            {steps.map((step, index) => (
              <div key={step.number} className="relative flex gap-4">
                {/* Vertical line */}
                {index !== steps.length - 1 && (
                  <div className="absolute left-6 top-14 h-[calc(100%+1.5rem)] w-0.5 bg-gradient-to-b from-primary to-primary/20" />
                )}

                {/* Icon */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-primary/20 bg-card shadow-md">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>

                <div className="pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                      {step.number}
                    </span>
                    <h3 className="font-semibold">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

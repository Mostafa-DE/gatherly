import {
  Dumbbell,
  BookOpen,
  Gamepad2,
  Coffee,
  GraduationCap,
  Music,
  Bike,
  Briefcase,
} from "lucide-react"

const cases = [
  { icon: Dumbbell, label: "Fitness Programs" },
  { icon: BookOpen, label: "Learning Cohorts" },
  { icon: Gamepad2, label: "Community Groups" },
  { icon: GraduationCap, label: "Training Ops" },
  { icon: Coffee, label: "Professional Circles" },
  { icon: Music, label: "Workshop Series" },
  { icon: Bike, label: "Sports Clubs" },
  { icon: Briefcase, label: "Internal Teams" },
]

export function UseCasesSection() {
  return (
    <section className="border-y border-border bg-card px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="landing-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Use Cases
          </span>
          <h2 className="landing-display mt-2 text-2xl font-bold text-foreground sm:text-3xl">
            Built for Organizers, Trainers, and Teams
          </h2>
          <p className="landing-body mt-3 text-muted-foreground">
            If your activity repeats and people commit to it, Gatherly fits your workflow.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {cases.map((c) => (
            <div
              key={c.label}
              className="group flex items-center gap-3 border border-[var(--color-primary-border)] bg-background p-4 transition-all"
            >
              <c.icon className="h-5 w-5 shrink-0 text-primary" />
              <span className="landing-body text-sm font-semibold text-foreground">
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

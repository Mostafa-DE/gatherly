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

const useCases = [
  { icon: Dumbbell, label: "Fitness Classes" },
  { icon: BookOpen, label: "Book Clubs" },
  { icon: Gamepad2, label: "Gaming Groups" },
  { icon: GraduationCap, label: "Training Sessions" },
  { icon: Coffee, label: "Networking Events" },
  { icon: Music, label: "Workshop Series" },
  { icon: Bike, label: "Sports Groups" },
  { icon: Briefcase, label: "Team Meetings" },
]

export function UseCasesSection() {
  return (
    <section className="relative overflow-hidden py-12 sm:py-16">
      {/* Gradient line top */}
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      {/* Gradient line bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-wider text-primary">
            Use Cases
          </span>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
            Built for Recurring Activities
          </h2>
          <p className="mt-3 text-muted-foreground">
            From weekly training sessions to monthly meetups — if it repeats, Gatherly helps.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {useCases.map((useCase) => (
            <div
              key={useCase.label}
              className="group relative flex items-center gap-2.5 overflow-hidden rounded-full border bg-card px-5 py-2.5 text-sm font-medium shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
            >
              {/* Hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <useCase.icon className="relative h-4 w-4 text-primary transition-transform group-hover:scale-110" />
              <span className="relative">{useCase.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

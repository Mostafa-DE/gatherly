import { CheckCircle2, XCircle } from "lucide-react"

const isList = [
  "A people-coordination hub for recurring real-world activities",
  "The source of truth for commitments, capacity, and attendance history",
  "Built for organizers, trainers, and teams who need reliable participation tracking",
]

const isNotList = [
  "A chat app replacing WhatsApp or Discord",
  "A social feed or discovery platform",
  "A spreadsheet workflow disguised as software",
]

export function PositioningSection() {
  return (
    <section
      id="why-gatherly"
      className="scroll-mt-20 bg-card px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="landing-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Why Gatherly
          </span>
          <h2 className="landing-display mt-2 text-3xl font-bold text-foreground sm:text-5xl">
            Built for People Coordination, Not Busywork
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-3xl text-base text-muted-foreground">
            Conversation can stay in your existing channels. Gatherly becomes the
            system of record for who joined, who is waitlisted, and what happened
            over time.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <div className="border border-[var(--color-primary-border)] bg-background p-6 sm:p-7">
            <h3 className="landing-display text-xl font-bold text-foreground">
              What It Is
            </h3>
            <div className="mt-5 space-y-3">
              {isList.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  <p className="landing-body text-sm leading-relaxed text-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-background p-6 sm:p-7">
            <h3 className="landing-display text-xl font-bold text-foreground">
              What It Is Not
            </h3>
            <div className="mt-5 space-y-3">
              {isNotList.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <p className="landing-body text-sm leading-relaxed text-muted-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

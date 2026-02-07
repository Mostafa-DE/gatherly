import { FormInput, FileSpreadsheet, MessageCircle, ClipboardList } from "lucide-react"

const painPoints = [
  { icon: FormInput, title: "Google Forms limitations", desc: "Responses pile up. No real-time participant list. Manual work to track who's actually coming." },
  { icon: FileSpreadsheet, title: "Spreadsheet overhead", desc: "Copy-paste from forms, update manually, share links. Repeat every session." },
  { icon: MessageCircle, title: "Group chat confusion", desc: "RSVPs scattered across messages. No clear count. Constant back-and-forth." },
  { icon: ClipboardList, title: "No attendance history", desc: "Who's reliable? Who always cancels? You're guessing without data." },
]

export function ProblemSection() {
  return (
    <section className="bg-card px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="landing-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
            The Problem
          </span>
          <h2 className="landing-display mt-2 text-3xl font-bold text-foreground sm:text-5xl">
            Managing Sessions Shouldn't Be This Hard
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            You're not alone. Most organizations piece together tools that weren't built for this.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {painPoints.map((p) => (
            <div
              key={p.title}
              className="group flex gap-4 border-l-[3px] border-primary bg-background p-6 transition-all"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[var(--color-primary-subtle)]">
                <p.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="landing-body font-semibold text-foreground">{p.title}</h3>
                <p className="landing-body mt-1 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

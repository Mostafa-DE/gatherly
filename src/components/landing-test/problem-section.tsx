import { FormInput, FileSpreadsheet, MessageCircle, ClipboardList } from "lucide-react"

const painPoints = [
  { icon: FormInput, title: "Form-first workflows break fast", desc: "Registrations collect data, but they do not maintain a living participant roster as things change." },
  { icon: FileSpreadsheet, title: "Operations live in spreadsheets", desc: "Every session needs manual edits, recaps, and status fixes. Teams end up doing admin instead of organizing." },
  { icon: MessageCircle, title: "Commitments are scattered", desc: "Updates are buried across chats and DMs. Organizers and trainers lose confidence in who is actually coming." },
  { icon: ClipboardList, title: "No memory across sessions", desc: "Without attendance history, teams cannot spot patterns, improve turnout, or follow up consistently." },
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
            Most Teams Lack a Reliable Coordination Layer
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            Organizers, trainers, and team leads often stitch together chat, forms,
            and sheets. The result is ambiguity and repeated manual work.
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

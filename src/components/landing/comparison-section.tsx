import { Check, X, Minus } from "lucide-react"

const data = [
  { feature: "Free tier available", gatherly: true, meetup: false, forms: true, sheets: true },
  { feature: "Session scheduling", gatherly: true, meetup: true, forms: false, sheets: "partial" as const },
  { feature: "Automatic waitlist", gatherly: true, meetup: true, forms: false, sheets: false },
  { feature: "Auto-promote on cancel", gatherly: true, meetup: false, forms: false, sheets: false },
  { feature: "Attendance tracking", gatherly: true, meetup: false, forms: false, sheets: "partial" as const },
  { feature: "Real-time roster", gatherly: true, meetup: true, forms: false, sheets: false },
  { feature: "No manual data entry", gatherly: true, meetup: true, forms: false, sheets: false },
  { feature: "Custom member fields", gatherly: true, meetup: false, forms: true, sheets: true },
]

function Icon({ value }: { value: boolean | "partial" }) {
  if (value === true)
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-green-600/10">
        <Check className="h-4 w-4 text-green-600" />
      </div>
    )
  if (value === false)
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600/[0.08]">
        <X className="h-4 w-4 text-red-600" />
      </div>
    )
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded bg-muted-foreground/15">
      <Minus className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

export function ComparisonSection() {
  return (
    <section
      id="comparison"
      className="scroll-mt-20 bg-background px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="landing-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Comparison
          </span>
          <h2 className="landing-display mt-2 text-3xl font-bold text-foreground sm:text-5xl">
            Why Gatherly?
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-2xl text-base text-muted-foreground">
            Purpose-built for session management. Not a form builder, not a social network.
          </p>
        </div>

        {/* Desktop table */}
        <div className="mt-12 hidden overflow-hidden border border-border md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-popover">
                <th className="landing-body px-6 py-4 text-left font-medium text-muted-foreground">Feature</th>
                <th className="landing-body px-6 py-4 text-center font-semibold text-primary">Gatherly</th>
                <th className="landing-body px-6 py-4 text-center font-medium text-muted-foreground">Meetup</th>
                <th className="landing-body px-6 py-4 text-center font-medium text-muted-foreground">Google Forms</th>
                <th className="landing-body px-6 py-4 text-center font-medium text-muted-foreground">Spreadsheets</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`bg-card ${i !== data.length - 1 ? "border-b border-border" : ""}`}
                >
                  <td className="landing-body px-6 py-4 text-sm font-medium text-foreground">{row.feature}</td>
                  <td className="bg-[var(--color-primary-highlight)] px-6 py-4">
                    <div className="flex justify-center"><Icon value={row.gatherly} /></div>
                  </td>
                  <td className="px-6 py-4"><div className="flex justify-center"><Icon value={row.meetup} /></div></td>
                  <td className="px-6 py-4"><div className="flex justify-center"><Icon value={row.forms} /></div></td>
                  <td className="px-6 py-4"><div className="flex justify-center"><Icon value={row.sheets} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-12 space-y-3 md:hidden">
          {data.map((row) => (
            <div
              key={row.feature}
              className="border border-border bg-card p-4"
            >
              <p className="landing-body mb-3 font-medium text-foreground">{row.feature}</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex flex-col items-center gap-1.5 rounded bg-[var(--color-primary-highlight)] p-2">
                  <Icon value={row.gatherly} />
                  <span className="landing-body font-medium text-primary">Gatherly</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <Icon value={row.meetup} />
                  <span className="landing-body text-muted-foreground">Meetup</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <Icon value={row.forms} />
                  <span className="landing-body text-muted-foreground">Forms</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <Icon value={row.sheets} />
                  <span className="landing-body text-muted-foreground">Sheets</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Callout */}
        <div className="mt-8 border border-[var(--color-primary-border)] bg-[var(--color-primary-highlight)] p-6 text-center">
          <p className="landing-body text-sm sm:text-base">
            <span className="font-semibold text-foreground">Stop duct-taping solutions.</span>{" "}
            <span className="text-muted-foreground">
              Gatherly replaces the Google Forms → Spreadsheet → WhatsApp workflow with one simple tool.
            </span>
          </p>
          <p className="landing-body mt-2 text-sm font-medium text-primary">
            First group free forever · Up to 200 members · Extra groups $1 for 3 months, then $10/mo
          </p>
        </div>
      </div>
    </section>
  )
}

import { Check, X, Minus } from "lucide-react"

const comparisonData = [
  {
    feature: "Free tier available",
    gatherly: true,
    meetup: false,
    googleForms: true,
    spreadsheet: true,
  },
  {
    feature: "Session scheduling",
    gatherly: true,
    meetup: true,
    googleForms: false,
    spreadsheet: "partial",
  },
  {
    feature: "Automatic waitlist",
    gatherly: true,
    meetup: true,
    googleForms: false,
    spreadsheet: false,
  },
  {
    feature: "Auto-promote on cancellation",
    gatherly: true,
    meetup: false,
    googleForms: false,
    spreadsheet: false,
  },
  {
    feature: "Attendance tracking",
    gatherly: true,
    meetup: false,
    googleForms: false,
    spreadsheet: "partial",
  },
  {
    feature: "Real-time roster",
    gatherly: true,
    meetup: true,
    googleForms: false,
    spreadsheet: false,
  },
  {
    feature: "No manual data entry",
    gatherly: true,
    meetup: true,
    googleForms: false,
    spreadsheet: false,
  },
  {
    feature: "Custom member fields",
    gatherly: true,
    meetup: false,
    googleForms: true,
    spreadsheet: true,
  },
]

function FeatureIcon({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-green-500/10">
        <Check className="h-4 w-4 text-green-500" />
      </div>
    )
  }
  if (value === false) {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/10">
        <X className="h-4 w-4 text-red-400" />
      </div>
    )
  }
  return (
    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
      <Minus className="h-4 w-4 text-muted-foreground" />
    </div>
  )
}

export function ComparisonSection() {
  return (
    <section id="comparison" className="relative scroll-mt-20 overflow-hidden bg-muted/30 py-16 sm:py-24">
      {/* Grid pattern */}
      <div className="absolute inset-0 -z-10 opacity-[0.02]">
        <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-wider text-primary">
            Comparison
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            Why Gatherly?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Purpose-built for session management. Not a form builder, not a social network.
          </p>
        </div>

        {/* Desktop table */}
        <div className="mt-12 hidden overflow-hidden rounded-2xl border bg-card shadow-lg md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-6 py-4 text-left font-medium">Feature</th>
                <th className="px-6 py-4 text-center">
                  <span className="font-semibold text-primary">Gatherly</span>
                </th>
                <th className="px-6 py-4 text-center font-medium text-muted-foreground">
                  Meetup
                </th>
                <th className="px-6 py-4 text-center font-medium text-muted-foreground">
                  Google Forms
                </th>
                <th className="px-6 py-4 text-center font-medium text-muted-foreground">
                  Spreadsheets
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row, index) => (
                <tr
                  key={row.feature}
                  className={`transition-colors hover:bg-muted/30 ${index !== comparisonData.length - 1 ? "border-b" : ""}`}
                >
                  <td className="px-6 py-4 text-sm font-medium">{row.feature}</td>
                  <td className="bg-primary/5 px-6 py-4">
                    <div className="flex justify-center">
                      <FeatureIcon value={row.gatherly} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <FeatureIcon value={row.meetup} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <FeatureIcon value={row.googleForms} />
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <FeatureIcon value={row.spreadsheet} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-12 space-y-3 md:hidden">
          {comparisonData.map((row) => (
            <div
              key={row.feature}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <p className="mb-3 font-medium">{row.feature}</p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="flex flex-col items-center gap-1.5 rounded-lg bg-primary/5 p-2">
                  <FeatureIcon value={row.gatherly} />
                  <span className="font-medium text-primary">Gatherly</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <FeatureIcon value={row.meetup} />
                  <span className="text-muted-foreground">Meetup</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <FeatureIcon value={row.googleForms} />
                  <span className="text-muted-foreground">Forms</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2">
                  <FeatureIcon value={row.spreadsheet} />
                  <span className="text-muted-foreground">Sheets</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Callout */}
        <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-sm sm:text-base">
            <span className="font-semibold text-foreground">Stop duct-taping solutions.</span>{" "}
            <span className="text-muted-foreground">
              Gatherly replaces the Google Forms → Spreadsheet → WhatsApp workflow with one simple tool.
            </span>
          </p>
          <p className="mt-2 text-sm text-primary font-medium">
            First group free forever · Up to 200 members · Extra groups $1 for 3 months, then $10/mo
          </p>
        </div>
      </div>
    </section>
  )
}

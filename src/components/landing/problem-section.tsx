import { Card, CardContent } from "@/components/ui/card"
import { FileSpreadsheet, FormInput, MessageCircle, ClipboardList } from "lucide-react"

const painPoints = [
  {
    icon: FormInput,
    title: "Google Forms limitations",
    description: "Responses pile up. No real-time roster. Manual work to track who's actually coming.",
  },
  {
    icon: FileSpreadsheet,
    title: "Spreadsheet overhead",
    description: "Copy-paste from forms, update manually, share links. Repeat every session.",
  },
  {
    icon: MessageCircle,
    title: "Group chat confusion",
    description: "RSVPs scattered across messages. No clear count. Constant back-and-forth.",
  },
  {
    icon: ClipboardList,
    title: "No attendance history",
    description: "Who's reliable? Who always cancels? You're guessing without data.",
  },
]

export function ProblemSection() {
  return (
    <section className="relative overflow-hidden bg-muted/30 py-16 sm:py-24">
      {/* Grid pattern */}
      <div className="absolute inset-0 -z-10 opacity-[0.02]">
        <div className="h-full w-full bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <span className="text-sm font-medium uppercase tracking-wider text-primary">
            The Problem
          </span>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
            Managing Sessions Shouldn't Be This Hard
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            You're not alone. Most organizations piece together tools that weren't built for this.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:gap-6">
          {painPoints.map((point) => (
            <Card
              key={point.title}
              className="group relative overflow-hidden border-none bg-card shadow-sm transition-all hover:shadow-lg"
            >
              <CardContent className="relative flex gap-4 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive/10 transition-transform group-hover:scale-110">
                  <point.icon className="h-6 w-6 text-destructive/80" />
                </div>
                <div>
                  <h3 className="font-semibold">{point.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {point.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

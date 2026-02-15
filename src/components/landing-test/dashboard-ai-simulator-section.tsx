import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  DollarSign,
  Eye,
  Sparkles,
  Users,
} from "lucide-react"
import type { TimeRange } from "@/plugins/analytics/types"
import { AnalyticsInsights } from "@/plugins/analytics/components/analytics-insights"

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
]

const SUMMARY_BY_RANGE: Record<
  TimeRange,
  {
    totalMembers: string
    avgCapacity: string
    showRate: string
    revenue: string
  }
> = {
  "7": {
    totalMembers: "214",
    avgCapacity: "73%",
    showRate: "78%",
    revenue: "$1,420",
  },
  "30": {
    totalMembers: "238",
    avgCapacity: "76%",
    showRate: "81%",
    revenue: "$5,860",
  },
  "90": {
    totalMembers: "291",
    avgCapacity: "74%",
    showRate: "79%",
    revenue: "$16,940",
  },
}

const SIMULATED_INSIGHTS: Record<TimeRange, string[]> = {
  "7": [
    "[STRENGTH] Consistent demand | Most sessions stayed above 70% fill this week.",
    "[CONCERN] Late cancellations | Last-minute drops increased on weekday evening slots.",
    "[ACTION] Protect key sessions | Add a short waitlist buffer for high-demand time windows.",
    "[TREND] Better show behavior | Show rate is trending upward versus the previous week.",
  ],
  "30": [
    "[STRENGTH] Stable participation | Core member attendance remained steady across the month.",
    "[CONCERN] Capacity imbalance | A few sessions are overfull while others run below target.",
    "[ACTION] Rebalance schedule | Shift one low-demand slot and expand top-performing sessions.",
    "[TREND] Revenue momentum | Collection trend improved with higher average fill rate.",
  ],
  "90": [
    "[STRENGTH] Healthy growth | Member count and repeat attendance both increased quarter-over-quarter.",
    "[CONCERN] Drop-off pocket | New member retention dips after the second attended session.",
    "[ACTION] Improve follow-up | Add an automatic check-in after each member's second visit.",
    "[TREND] Long-term stability | Participation variability narrowed as schedule cadence matured.",
  ],
}

export function DashboardAISimulatorSection() {
  const [days, setDays] = useState<TimeRange>("30")
  const [cachedInsights, setCachedInsights] = useState<Record<TimeRange, string>>({
    "7": "",
    "30": "",
    "90": "",
  })
  const [streamedText, setStreamedText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState("")
  const simulationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasAutoStartedRef = useRef(false)

  const summary = useMemo(() => SUMMARY_BY_RANGE[days], [days])

  const clearSimulationTimer = useCallback(() => {
    if (!simulationTimerRef.current) return
    clearInterval(simulationTimerRef.current)
    simulationTimerRef.current = null
  }, [])

  const runSimulation = useCallback(
    (range: TimeRange) => {
      clearSimulationTimer()
      setError("")
      setStreamedText("")
      setIsPending(true)
      setIsStreaming(true)

      const lines = SIMULATED_INSIGHTS[range]
      let index = 0

      simulationTimerRef.current = setInterval(() => {
        if (index >= lines.length) {
          clearSimulationTimer()
          setIsStreaming(false)
          setIsPending(false)
          setCachedInsights((prev) => ({ ...prev, [range]: lines.join("\n") }))
          return
        }

        setStreamedText((prev) => `${prev}${lines[index]}\n`)
        index += 1
      }, 700)
    },
    [clearSimulationTimer]
  )

  useEffect(() => {
    if (hasAutoStartedRef.current) return
    hasAutoStartedRef.current = true
    runSimulation("30")
  }, [runSimulation])

  useEffect(() => {
    return () => clearSimulationTimer()
  }, [clearSimulationTimer])

  return (
    <section
      id="ai-assistant"
      className="scroll-mt-20 bg-background px-5 py-20 sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="landing-body inline-flex items-center gap-2 rounded border border-[var(--color-primary-border)] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Interactive Preview
          </span>
          <h2 className="landing-display mt-3 text-3xl font-bold text-foreground sm:text-5xl">
            See AI Insights Before You Enter the Dashboard
          </h2>
          <p className="landing-body mx-auto mt-4 max-w-3xl text-base text-muted-foreground">
            This demo uses sample analytics signals to simulate how Gatherly AI
            explains participation trends and recommended actions.
          </p>
        </div>

        <div className="mt-10 rounded-xl border bg-card p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Analytics + AI Insights Preview</h3>
                <p className="text-sm text-muted-foreground">
                  Sample data with simulated streaming response
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total Members", value: summary.totalMembers, icon: Users },
                { label: "Avg Capacity", value: summary.avgCapacity, icon: BarChart3 },
                { label: "Show Rate", value: summary.showRate, icon: Eye },
                { label: "Revenue", value: summary.revenue, icon: DollarSign },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">
                      {item.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold font-mono tabular-nums text-primary">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => {
                    if (isPending) return
                    setDays(range.value)
                  }}
                  disabled={isPending}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    days === range.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>

            <AnalyticsInsights
              days={days}
              rawText={cachedInsights[days] ?? ""}
              streamedText={streamedText}
              isStreaming={isStreaming}
              isPending={isPending}
              error={error}
              isAvailable
              onGenerate={(range) => runSimulation(range)}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

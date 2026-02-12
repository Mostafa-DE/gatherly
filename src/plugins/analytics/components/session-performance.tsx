import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Calendar, TrendingUp, UserX, Trophy, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import type { TimeRange } from "../types"

const chartConfig = {
  utilization: {
    label: "Capacity %",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig

export function SessionPerformance({ days }: { days: TimeRange }) {
  const { data, isLoading } =
    trpc.plugin.analytics.sessionPerformance.useQuery({ days })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const stats = [
    {
      label: "Sessions Held",
      value: data.totalSessions.toLocaleString(),
      icon: Calendar,
      className: "text-primary",
      info: "Total number of published or completed sessions during the selected period.",
    },
    {
      label: "Avg Capacity",
      value: `${data.avgCapacityUtilization}%`,
      icon: TrendingUp,
      className:
        data.avgCapacityUtilization >= 70
          ? "text-[var(--color-status-success)]"
          : data.avgCapacityUtilization >= 40
            ? "text-[var(--color-status-warning)]"
            : "text-[var(--color-status-danger)]",
      info: "Average percentage of session capacity filled across all sessions. Calculated as (joined members / max capacity) averaged over all sessions.",
    },
    {
      label: "Avg No-Show Rate",
      value: `${data.avgNoShowRate}%`,
      icon: UserX,
      className:
        data.avgNoShowRate <= 10
          ? "text-[var(--color-status-success)]"
          : data.avgNoShowRate <= 25
            ? "text-[var(--color-status-warning)]"
            : "text-[var(--color-status-danger)]",
      info: "Average percentage of members who were marked as 'no-show' out of all members with attendance marked, averaged across sessions.",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm"
            >
              <div className="mb-2 flex items-center gap-1.5">
                <Icon className={cn("h-4 w-4 shrink-0", item.className)} />
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                      aria-label={`How ${item.label} is calculated`}
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" className="w-64 p-3 text-xs leading-relaxed">
                    {item.info}
                  </PopoverContent>
                </Popover>
              </div>
              <p
                className={cn(
                  "text-2xl font-bold font-mono tabular-nums",
                  item.className
                )}
              >
                {item.value}
              </p>
            </div>
          )
        })}
      </div>

      {/* Capacity trend chart */}
      {data.capacityTrend.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Capacity Utilization per Session
          </h3>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <BarChart data={data.capacityTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis
                dataKey="title"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) =>
                  v.length > 12 ? `${v.slice(0, 12)}…` : v
                }
              />
              <YAxis
                domain={[0, 100]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="utilization"
                fill="var(--color-utilization)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No sessions in this period
          </p>
        </div>
      )}

      {/* Top sessions */}
      {data.topSessions.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[var(--color-status-warning)]" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Top Sessions by Fill Rate
            </h3>
          </div>
          <div className="space-y-2">
            {data.topSessions.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border/30 bg-background/60 px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.date}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold font-mono tabular-nums">
                    {s.fillRate}%
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {s.joinedCount}/{s.maxCapacity}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

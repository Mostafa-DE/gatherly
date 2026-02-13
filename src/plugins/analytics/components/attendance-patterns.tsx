import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Eye, Repeat, CalendarDays, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import type { TimeRange } from "../types"

const showRateConfig = {
  rate: {
    label: "Show Rate %",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig

const peakDaysConfig = {
  count: {
    label: "Attendees",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig

export function AttendancePatterns({ days, activityId }: { days: TimeRange; activityId?: string }) {
  const { data, isLoading } =
    trpc.plugin.analytics.attendancePatterns.useQuery({ days, activityId })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[250px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const stats = [
    {
      label: "Show Rate",
      value: `${data.overallShowRate}%`,
      icon: Eye,
      className:
        data.overallShowRate >= 70
          ? "text-[var(--color-status-success)]"
          : data.overallShowRate >= 50
            ? "text-[var(--color-status-warning)]"
            : "text-[var(--color-status-danger)]",
      info: "Percentage of members who showed up out of all members whose attendance was marked (show + no-show).",
    },
    {
      label: "Repeat Rate",
      value: `${data.repeatRate}%`,
      subtext: "attended 2+ sessions",
      icon: Repeat,
      className: "text-[var(--color-chart-1)]",
      info: "Percentage of attendees who attended 2 or more sessions during the selected period.",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
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
              {"subtext" in item && item.subtext && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.subtext}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Show rate trend */}
      {data.showRateTrend.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Show Rate Trend
          </h3>
          <ChartContainer config={showRateConfig} className="h-[220px] w-full">
            <LineChart data={data.showRateTrend}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return d.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                domain={[0, 100]}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke="var(--color-rate)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      )}

      {/* Peak days bar chart */}
      {data.peakDays.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">
              Attendance by Day of Week
            </h3>
          </div>
          <ChartContainer
            config={peakDaysConfig}
            className="h-[200px] w-full"
          >
            <BarChart data={data.peakDays}>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis
                dataKey="day"
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => v.slice(0, 3)}
              />
              <YAxis
                allowDecimals={false}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </div>
      )}

    </div>
  )
}

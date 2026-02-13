import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Users, UserPlus, Activity, RotateCcw, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import type { TimeRange } from "../types"

const chartConfig = {
  count: {
    label: "New Members",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig

export function GroupHealth({ days, activityId }: { days: TimeRange; activityId?: string }) {
  const { data, isLoading } = trpc.plugin.analytics.groupHealth.useQuery({
    days,
    activityId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
      label: "Total Members",
      value: data.totalMembers.toLocaleString(),
      icon: Users,
      className: "text-primary",
      info: "Total number of members currently in this group.",
    },
    {
      label: "New Members",
      value: data.newMembers.toLocaleString(),
      icon: UserPlus,
      className: "text-[var(--color-chart-1)]",
      info: "Members who joined the group during the selected time period.",
    },
    {
      label: "Active Members",
      value: data.activeMembers.toLocaleString(),
      subtext: `${data.inactiveMembers} inactive`,
      icon: Activity,
      className: "text-[var(--color-status-success)]",
      info: "Members who attended at least one session (marked as 'show') during the selected period. Inactive = total minus active.",
    },
    {
      label: "Retention Rate",
      value: `${data.retentionRate}%`,
      icon: RotateCcw,
      className:
        data.retentionRate >= 70
          ? "text-[var(--color-status-success)]"
          : data.retentionRate >= 40
            ? "text-[var(--color-status-warning)]"
            : "text-[var(--color-status-danger)]",
      info: "Percentage of members who were active in the previous period and remained active in the current period.",
    },
  ]

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

      {/* Member growth chart */}
      {data.memberGrowth.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Member Growth
          </h3>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <LineChart data={data.memberGrowth}>
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
                allowDecimals={false}
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ChartContainer>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No new members in this period
          </p>
        </div>
      )}
    </div>
  )
}

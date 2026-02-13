import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { DollarSign, TrendingUp, CheckCircle, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import type { TimeRange } from "../types"

const chartConfig = {
  amount: {
    label: "Revenue",
    color: "var(--color-chart-3)",
  },
} satisfies ChartConfig

function formatMoney(
  amount: number,
  currency: string | null | undefined
): string {
  if (!currency) return amount.toFixed(2)

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function RevenueOverview({ days, activityId }: { days: TimeRange; activityId?: string }) {
  const { data, isLoading } = trpc.plugin.analytics.revenue.useQuery({ days, activityId })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[250px] rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const currency = data.currency
  const hasRevenueData =
    data.revenueTrend.length > 0 ||
    data.totalRevenue > 0 ||
    data.avgRevenuePerSession > 0 ||
    data.outstandingCount > 0 ||
    data.outstandingAmount > 0

  const stats = [
    {
      label: "Total Revenue",
      value: hasRevenueData ? formatMoney(data.totalRevenue, currency) : "—",
      icon: DollarSign,
      className: hasRevenueData
        ? "text-[var(--color-chart-3)]"
        : "text-muted-foreground",
      info: "Sum of session prices for all paid, joined participants in priced sessions during the selected period.",
    },
    {
      label: "Avg / Session",
      value: hasRevenueData ? formatMoney(data.avgRevenuePerSession, currency) : "—",
      icon: TrendingUp,
      className: hasRevenueData ? "text-primary" : "text-muted-foreground",
      info: "Total revenue divided by the number of priced sessions (sessions with a price greater than zero).",
    },
    {
      label: "Collection Rate",
      value: hasRevenueData ? `${data.collectionRate}%` : "—",
      icon: CheckCircle,
      className: hasRevenueData
        ? data.collectionRate >= 80
          ? "text-[var(--color-status-success)]"
          : data.collectionRate >= 50
            ? "text-[var(--color-status-warning)]"
            : "text-[var(--color-status-danger)]"
        : "text-muted-foreground",
      info: "Percentage of joined participants in priced sessions who have paid, out of all joined participants in priced sessions.",
    },
    {
      label: "Outstanding",
      value: hasRevenueData ? data.outstandingCount.toLocaleString() : "—",
      subtext: hasRevenueData
        ? formatMoney(data.outstandingAmount, currency)
        : undefined,
      icon: AlertTriangle,
      className: hasRevenueData
        ? data.outstandingCount > 0
          ? "text-[var(--color-status-warning)]"
          : "text-[var(--color-status-success)]"
        : "text-muted-foreground",
      info: "Number of joined participants in priced sessions who have not yet paid, and the total amount owed.",
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

      {/* Revenue trend chart */}
      {data.revenueTrend.length > 0 ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">
            Revenue Trend
          </h3>
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            <LineChart data={data.revenueTrend}>
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
                className="text-xs"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="var(--color-amount)"
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
            No revenue data in this period
          </p>
        </div>
      )}
    </div>
  )
}

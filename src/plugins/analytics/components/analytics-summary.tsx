import { Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, BarChart3, Eye, DollarSign, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/format-price"

export function AnalyticsSummaryWidget({ orgId }: { orgId: string }) {
  const { data, isLoading } = trpc.plugin.analytics.summary.useQuery({
    days: "30",
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
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
    },
    {
      label: "Avg Capacity",
      value: `${data.avgCapacityUtilization}%`,
      icon: BarChart3,
      className: "text-[var(--color-chart-1)]",
    },
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
    },
    {
      label: "Revenue (30d)",
      value: formatPrice(
        data.totalRevenue > 0 ? String(data.totalRevenue) : null,
        data.currency
      ),
      icon: DollarSign,
      className: "text-[var(--color-chart-3)]",
    },
  ]

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">At a Glance</h2>
        <Link
          to="/dashboard/org/$orgId/analytics"
          params={{ orgId }}
          className="group inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
        >
          View Analytics
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm"
            >
              <div className="mb-2 flex items-center gap-2">
                <Icon className={cn("h-4 w-4", item.className)} />
                <span className="text-xs text-muted-foreground">
                  {item.label}
                </span>
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
    </div>
  )
}

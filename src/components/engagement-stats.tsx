import { CalendarCheck, Percent, AlertTriangle, CalendarClock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EngagementStats } from "@/data-access/engagement-stats"

function rateColor(rate: number) {
  if (rate >= 80) return "text-green-600 dark:text-green-400"
  if (rate >= 50) return "text-yellow-600 dark:text-yellow-400"
  return "text-red-600 dark:text-red-400"
}

export function EngagementStatsCard({ stats }: { stats: EngagementStats }) {
  const items = [
    {
      label: "Sessions Attended",
      value: stats.sessionsAttended,
      icon: CalendarCheck,
      className: "text-primary",
    },
    {
      label: "Attendance Rate",
      value: `${stats.attendanceRate}%`,
      icon: Percent,
      className: rateColor(stats.attendanceRate),
    },
    {
      label: "No-Shows",
      value: stats.noShows,
      icon: AlertTriangle,
      className: stats.noShows > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
    },
    {
      label: "Upcoming Sessions",
      value: stats.upcomingSessions,
      icon: CalendarClock,
      className: "text-primary",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className={cn("h-4 w-4", item.className)} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </div>
            <p className={cn("text-2xl font-bold", item.className)}>
              {item.value}
            </p>
          </div>
        )
      })}
    </div>
  )
}

import { useCallback, useEffect, useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Users,
  Calendar,
  Eye,
  DollarSign,
  XCircle,
  BarChart3,
  Trophy,
  Medal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { GroupHealth } from "@/plugins/analytics/components/group-health"
import { SessionPerformance } from "@/plugins/analytics/components/session-performance"
import { AttendancePatterns } from "@/plugins/analytics/components/attendance-patterns"
import { RevenueOverview } from "@/plugins/analytics/components/revenue-overview"
import { AnalyticsInsights } from "@/plugins/analytics/components/analytics-insights"
import { useAIAnalyzeAnalytics } from "@/plugins/ai/hooks/use-ai-suggestion"
import { useActivityContext } from "@/hooks/use-activity-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TimeRange } from "@/plugins/analytics/types"

export const Route = createFileRoute("/dashboard/org/$orgId/analytics")({
  component: AnalyticsPage,
})

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
]

function getInsightsCacheKey(orgId: string, days: TimeRange) {
  return `gatherly:ai-analytics:${orgId}:${days}`
}

function readCachedInsights(orgId: string): Record<TimeRange, string> {
  try {
    return {
      "7": localStorage.getItem(getInsightsCacheKey(orgId, "7")) ?? "",
      "30": localStorage.getItem(getInsightsCacheKey(orgId, "30")) ?? "",
      "90": localStorage.getItem(getInsightsCacheKey(orgId, "90")) ?? "",
    }
  } catch {
    return { "7": "", "30": "", "90": "" }
  }
}

function AnalyticsPage() {
  const { orgId } = Route.useParams()
  const [days, setDays] = useState<TimeRange>("30")
  const [cachedInsights, setCachedInsights] = useState<Record<TimeRange, string>>(
    () => readCachedInsights(orgId)
  )
  const { activities, isMultiActivity, selectedActivityId, setSelectedActivity } =
    useActivityContext(orgId)
  const { data: whoami, isLoading: whoamiLoading } =
    trpc.user.whoami.useQuery()

  useEffect(() => {
    setCachedInsights(readCachedInsights(orgId))
  }, [orgId])

  const onInsightsComplete = useCallback(
    (text: string) => {
      setCachedInsights((prev) => ({ ...prev, [days]: text }))
      try {
        localStorage.setItem(getInsightsCacheKey(orgId, days), text)
      } catch {
        // localStorage unavailable/full
      }
    },
    [days, orgId]
  )

  const {
    analyze,
    streamedText,
    isStreaming: isInsightsStreaming,
    isPending: isGeneratingInsights,
    error: insightsError,
    isAvailable: isInsightsAvailable,
  } = useAIAnalyzeAnalytics({ onComplete: onInsightsComplete })

  const handleGenerateInsights = useCallback(
    (range: TimeRange) => {
      analyze({ days: range })
    },
    [analyze]
  )

  const isAdmin =
    whoami?.membership?.role === "owner" ||
    whoami?.membership?.role === "admin"

  const activityId = selectedActivityId ?? undefined

  const {
    data: sessionPerformanceData,
    isLoading: sessionPerformanceLoading,
  } = trpc.plugin.analytics.sessionPerformance.useQuery(
    { days, activityId },
    { enabled: isAdmin }
  )
  const {
    data: attendancePatternsData,
    isLoading: attendancePatternsLoading,
  } = trpc.plugin.analytics.attendancePatterns.useQuery(
    { days, activityId },
    { enabled: isAdmin }
  )

  if (whoamiLoading) {
    return (
      <div className="space-y-6 py-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Access Denied</h2>
        <p className="mb-6 max-w-md text-muted-foreground">
          Only group owners and admins can access analytics.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId" params={{ orgId }}>
            Back to Overview
          </Link>
        </Button>
      </div>
    )
  }

  const sections = [
    {
      id: "group-health",
      title: "Group Health",
      description: "Member growth, activity, and retention",
      icon: Users,
      component: <GroupHealth days={days} activityId={activityId} />,
    },
    {
      id: "revenue",
      title: "Revenue",
      description: "Earnings, collection rates, and trends",
      icon: DollarSign,
      component: <RevenueOverview days={days} activityId={activityId} />,
    },
    {
      id: "session-performance",
      title: "Session Performance",
      description: "Capacity utilization and no-show rates",
      icon: Calendar,
      component: <SessionPerformance days={days} activityId={activityId} />,
    },
    {
      id: "attendance-patterns",
      title: "Attendance Patterns",
      description: "Show rates, peak days, and top attendees",
      icon: Eye,
      component: <AttendancePatterns days={days} activityId={activityId} />,
    },
  ]

  const topSessions = sessionPerformanceData?.topSessions ?? []
  const topAttendees = attendancePatternsData?.topAttendees ?? []
  const shouldShowTopListsRow =
    sessionPerformanceLoading ||
    attendancePatternsLoading ||
    topSessions.length > 0 ||
    topAttendees.length > 0

  return (
    <div className="space-y-8 py-6">
      {/* Header + time range selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
            <p className="text-sm text-muted-foreground">
              Group insights and performance metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isMultiActivity && (
            <Select
              value={selectedActivityId ?? "all"}
              onValueChange={(v) => setSelectedActivity(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[180px] bg-popover">
                <SelectValue placeholder="All Activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                {activities.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => {
                  if (isGeneratingInsights) return
                  setDays(range.value)
                }}
                disabled={isGeneratingInsights}
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
        </div>
      </div>

      {/* AI Insights */}
      <AnalyticsInsights
        days={days}
        rawText={cachedInsights[days] ?? ""}
        streamedText={streamedText}
        isStreaming={isInsightsStreaming}
        isPending={isGeneratingInsights}
        error={insightsError}
        isAvailable={isInsightsAvailable}
        onGenerate={handleGenerateInsights}
      />

      {/* Analytics sections */}
      {sections.map((section) => {
        const Icon = section.icon
        return (
          <div key={section.id}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold">{section.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </div>
            </div>
            {section.component}
          </div>
        )
      })}

      {/* Top lists */}
      {shouldShowTopListsRow && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Trophy className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Top Contributors</h2>
              <p className="text-sm text-muted-foreground">
                Top attendees and highest-fill sessions
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sessionPerformanceLoading ? (
              <Skeleton className="h-[220px] rounded-xl" />
            ) : (
              <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-[var(--color-status-warning)]" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Top Sessions by Fill Rate
                  </h3>
                </div>
                {topSessions.length > 0 ? (
                  <div className="space-y-2">
                    {topSessions.map((s, i) => (
                      <Link
                        key={s.id}
                        to="/dashboard/org/$orgId/sessions/$sessionId"
                        params={{ orgId, sessionId: s.id }}
                        className="group flex items-center justify-between rounded-lg border border-border/30 bg-background/60 px-3 py-2 transition-colors hover:bg-muted/40 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.title}</p>
                            <p className="text-xs text-muted-foreground">{s.date}</p>
                          </div>
                        </div>
                        <div className="ml-2 shrink-0 text-right">
                          <p className="text-sm font-bold font-mono tabular-nums">
                            {s.fillRate}%
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {s.joinedCount}/{s.maxCapacity}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                    No session data in this period
                  </div>
                )}
              </div>
            )}

            {attendancePatternsLoading ? (
              <Skeleton className="h-[220px] rounded-xl" />
            ) : (
              <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4 text-[var(--color-status-warning)]" />
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Top Attendees
                  </h3>
                </div>
                {topAttendees.length > 0 ? (
                  <div className="space-y-2">
                    {topAttendees.map((a, i) => (
                      <Link
                        key={a.userId}
                        to="/dashboard/org/$orgId/members/$userId"
                        params={{ orgId, userId: a.userId }}
                        className="group flex items-center justify-between rounded-lg border border-border/30 bg-background/60 px-3 py-2 transition-colors hover:bg-muted/40 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {i + 1}
                          </span>
                          <div className="flex min-w-0 items-center gap-2">
                            {a.image ? (
                              <img
                                src={a.image}
                                alt={a.name}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                                {a.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .toUpperCase()
                                  .slice(0, 2)}
                              </div>
                            )}
                            <span className="truncate text-sm font-medium">
                              {a.name}
                            </span>
                          </div>
                        </div>
                        <span className="ml-2 shrink-0 text-sm font-bold font-mono tabular-nums text-primary">
                          {a.count} sessions
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                    No attendee data in this period
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

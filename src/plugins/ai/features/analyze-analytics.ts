import { z } from "zod"
import {
  getGroupHealthStats,
  getSessionPerformanceStats,
  getAttendancePatternStats,
  getRevenueStats,
} from "@/plugins/analytics/queries"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import type {
  GroupHealthStats,
  SessionPerformanceStats,
  AttendancePatternStats,
  RevenueStats,
} from "@/plugins/analytics/types"

const inputSchema = z.object({
  days: z.enum(["7", "30", "90"]),
})

type FeatureContext = {
  orgName: string
  days: number
  health: GroupHealthStats
  sessions: SessionPerformanceStats
  attendance: AttendancePatternStats
  revenue: RevenueStats
}

function formatTrend(points: { date: string; [key: string]: unknown }[], valueKey: string, max = 10): string {
  const sliced = points.slice(-max)
  if (sliced.length === 0) return "No data"
  return sliced.map((p) => `${p.date}:${p[valueKey]}`).join(", ")
}

export const analyzeAnalytics: AIFeature<typeof inputSchema> = {
  id: "analyzeAnalytics",
  inputSchema,
  model: "mistral:7b",
  temperature: 0.3,
  access: "admin",

  fetchContext: async (ctx: AIFeatureContext, input) => {
    const orgId = ctx.activeOrganization.id
    const days = Number(input.days)

    const [health, sessions, attendance, revenue] = await Promise.all([
      getGroupHealthStats(orgId, days),
      getSessionPerformanceStats(orgId, days),
      getAttendancePatternStats(orgId, days),
      getRevenueStats(orgId, days),
    ])

    return {
      orgName: ctx.activeOrganization.name,
      days,
      health,
      sessions,
      attendance,
      revenue,
    } satisfies FeatureContext
  },

  buildPrompt: (_input, context) => {
    const ctx = context as FeatureContext
    const { health, sessions, attendance, revenue } = ctx

    const hasData =
      health.totalMembers > 0 ||
      sessions.totalSessions > 0

    let task = `Analyze the following data for "${ctx.orgName}" over the last ${ctx.days} days and provide actionable insights.`

    task += "\n\n=== GROUP HEALTH ==="
    task += `\nTotal members: ${health.totalMembers}`
    task += `\nNew members: ${health.newMembers}`
    task += `\nActive members: ${health.activeMembers}`
    task += `\nInactive members: ${health.inactiveMembers}`
    task += `\nRetention rate: ${health.retentionRate}%`
    task += `\nGrowth trend: ${formatTrend(health.memberGrowth, "count")}`

    task += "\n\n=== SESSION PERFORMANCE ==="
    task += `\nTotal sessions: ${sessions.totalSessions}`
    task += `\nAvg capacity utilization: ${sessions.avgCapacityUtilization}%`
    task += `\nAvg no-show rate: ${sessions.avgNoShowRate}%`
    if (sessions.topSessions.length > 0) {
      task += `\nTop sessions: ${sessions.topSessions.map((s) => `${s.title} (${s.fillRate}% fill)`).join(", ")}`
    }
    task += `\nCapacity trend: ${formatTrend(sessions.capacityTrend, "utilization")}`

    task += "\n\n=== ATTENDANCE PATTERNS ==="
    task += `\nOverall show rate: ${attendance.overallShowRate}%`
    task += `\nRepeat attendance rate: ${attendance.repeatRate}%`
    if (attendance.peakDays.length > 0) {
      task += `\nPeak days: ${attendance.peakDays.map((d) => `${d.day} (${d.count})`).join(", ")}`
    }
    task += `\nShow rate trend: ${formatTrend(attendance.showRateTrend, "rate")}`

    task += "\n\n=== REVENUE ==="
    const currencyLabel = revenue.currency ?? "USD"
    task += `\nTotal revenue: ${currencyLabel} ${revenue.totalRevenue.toFixed(2)}`
    task += `\nAvg revenue per session: ${currencyLabel} ${revenue.avgRevenuePerSession.toFixed(2)}`
    task += `\nCollection rate: ${revenue.collectionRate}%`
    task += `\nOutstanding: ${revenue.outstandingCount} unpaid (${currencyLabel} ${revenue.outstandingAmount.toFixed(2)})`
    task += `\nRevenue trend: ${formatTrend(revenue.revenueTrend, "amount")}`

    task += "\n\n=== END DATA ==="

    if (!hasData) {
      task +=
        "\n\nNote: There is very limited or no data available for this period."
    }

    return {
      role: "You are a data analyst helping group administrators understand their analytics.",
      task,
      rules: [
        "Provide exactly 3-5 insights",
        "Each insight MUST follow this exact format on its own line:",
        "[CATEGORY] Title | Description",
        "CATEGORY must be one of: STRENGTH, CONCERN, ACTION, TREND",
        "- STRENGTH = something positive in the data (high retention, good growth, etc.)",
        "- CONCERN = a metric that needs attention (declining, low, problematic)",
        "- ACTION = a specific recommendation the admin should take",
        "- TREND = a notable pattern or trend worth watching",
        "Title must be 2-6 words, concise",
        "Description must be 1-2 sentences referencing specific numbers from the data",
        "Each insight must be on its own line, no blank lines between them",
        "Do not add any text before or after the insights — only output the insight lines",
        "If data is empty or insufficient, output a single line: [CONCERN] Insufficient Data | Not enough activity data is available for this period. Try selecting a longer time range.",
      ],
      examples: [
        "[STRENGTH] Strong Member Retention | Your 85% retention rate shows members are consistently coming back between periods.",
        "[CONCERN] Rising No-Show Rate | The average no-show rate of 32% is above the healthy threshold. Consider sending reminders before sessions.",
        "[ACTION] Optimize Session Timing | Tuesday and Thursday see 3x more attendance than weekends. Consider scheduling more sessions on these peak days.",
        "[TREND] Revenue Growth Momentum | Weekly revenue has increased from $120 to $340 over the period, showing a strong upward trajectory.",
      ],
    }
  },
}

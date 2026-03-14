import { z } from "zod"
import { getEngagementStats, getOrgAverageEngagement, getMemberLastActivityDate } from "@/data-access/engagement-stats"
import { getUserHistory, getMemberPaymentStats, getMemberCancellationStats, getMemberActivityEngagementDepth } from "@/data-access/participations"
import { getProfileByOrgAndUser } from "@/data-access/group-member-profiles"
import { getUserById } from "@/data-access/users"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import { getUserActivityFormAnswers } from "@/data-access/activity-join-requests"
import { listUserActivityMemberships } from "@/data-access/activity-members"
import { getMemberRanksByUser, getUserRecentIndividualStats } from "@/plugins/ranking/data-access/member-ranks"
import { getUserTournamentSummary } from "@/plugins/tournaments/data-access/entries"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import { withAIFeatureScope } from "@/plugins/ai/org-scope"
import type { FormField } from "@/types/form"

const inputSchema = z.object({
  userId: z.string().min(1),
})

type FeatureContext = {
  memberName: string
  memberRole: string
  joinDate: string
  engagementStats: {
    sessionsAttended: number
    noShows: number
    attendanceRate: number
    upcomingSessions: number
  }
  orgAverages: {
    activeMemberCount: number
    avgSessionsAttended: number
    avgAttendanceRate: number
  }
  daysSinceLastActivity: number | null
  paymentStats: {
    unpaidCount: number
    paidCount: number
    totalWithPayment: number
  }
  cancellationStats: {
    cancelledCount: number
    waitlistedCount: number
  }
  activityDepth: Array<{ activityName: string; sessionsLast30Days: number }>
  dormantActivities: string[]
  recentHistory: string[]
  profileAnswers: string[]
  activityMemberships: string[]
  activityFormAnswers: string[]
  rankings: string[]
  individualStats: string[]
  tournamentSummary: {
    tournamentsEntered: number
    matchWins: number
    matchLosses: number
    bestPlacement: number | null
  } | null
}

export const summarizeMemberProfile: AIFeature<typeof inputSchema> = {
  id: "summarizeMemberProfile",
  inputSchema,
  temperature: 0.3,
  access: "admin",
  collectPII: (context) => {
    const ctx = context as FeatureContext
    return [ctx.memberName]
  },

  fetchContext: async (ctx: AIFeatureContext, input) => {
    return withAIFeatureScope(
      ctx.activeOrganization.id,
      async (scope) => {
        const userId = input.userId
        const membership = await scope.requireMember(userId)

        const [
          userRecord,
          stats,
          orgAverages,
          lastActivityDate,
          history,
          paymentStats,
          cancellationStats,
          activityDepth,
          profile,
          settings,
          activityForms,
          memberships,
          ranks,
          recentIndividualStats,
          tournamentSummary,
        ] = await Promise.all([
          getUserById(userId),
          getEngagementStats(userId, scope.organizationId),
          getOrgAverageEngagement(scope.organizationId),
          getMemberLastActivityDate(userId, scope.organizationId),
          getUserHistory(scope.organizationId, userId, { limit: 10, offset: 0 }),
          getMemberPaymentStats(userId, scope.organizationId),
          getMemberCancellationStats(userId, scope.organizationId),
          getMemberActivityEngagementDepth(userId, scope.organizationId),
          getProfileByOrgAndUser(scope.organizationId, userId),
          getOrCreateOrgSettings(scope.organizationId),
          getUserActivityFormAnswers(userId, scope.organizationId),
          listUserActivityMemberships(userId, scope.organizationId),
          getMemberRanksByUser(userId, scope.organizationId),
          getUserRecentIndividualStats(userId, scope.organizationId, 10),
          getUserTournamentSummary(userId, scope.organizationId),
        ])

        const joinFormSchema = settings.joinFormSchema as {
          fields?: FormField[]
        } | null
        const formFields = joinFormSchema?.fields || []
        const answers = (profile?.answers as Record<string, unknown>) || {}

        const profileAnswers = formFields
          .map((f) => {
            const val = answers[f.id]
            if (val === undefined || val === null || val === "") return null
            return `${f.label}: ${Array.isArray(val) ? val.join(", ") : String(val)}`
          })
          .filter((x): x is string => x !== null)

        const recentHistory = history.map(
          (h) =>
            `${h.session.title} (${new Date(h.session.dateTime).toLocaleDateString()}) - ${h.participation.attendance}${h.participation.payment === "unpaid" ? " [UNPAID]" : ""}`
        )

        const activityMemberships = memberships.map((m) => m.activity.name)

        const activityFormAnswers = activityForms.flatMap((af) => {
          const schema = af.joinFormSchema as { fields?: FormField[] } | null
          const fields = schema?.fields ?? []
          const afAnswers = (af.formAnswers as Record<string, unknown>) ?? {}
          const lines = fields
            .map((f) => {
              const val = afAnswers[f.id]
              if (val === undefined || val === null || val === "") return null
              return `${f.label}: ${Array.isArray(val) ? val.join(", ") : String(val)}`
            })
            .filter((x): x is string => x !== null)
          if (lines.length === 0) return []
          return [`[${af.activityName}] ${lines.join(", ")}`]
        })

        const rankings = ranks.map((r) => {
          const rankStats = r.stats as Record<string, unknown> | null
          const statParts = rankStats
            ? Object.entries(rankStats)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "no stats"
          const level = r.levelName ? `Level: ${r.levelName}` : ""
          return `${r.definitionName}${level ? ` (${level})` : ""} — ${statParts}`
        })

        // Format individual stats (goals, assists, MOTM, etc.)
        const individualStats = recentIndividualStats.map((s) => {
          const statParts = Object.entries(s.stats)
            .filter(([, v]) => v !== 0 && v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")
          return `${s.definitionName} — ${statParts || "no notable stats"}`
        })

        // Compute dormant activities (member but 0 sessions in 30 days)
        const dormantActivities = activityDepth
          .filter((a) => a.sessionsLast30Days === 0)
          .map((a) => a.activityName)

        // Days since last activity
        const daysSinceLastActivity = lastActivityDate
          ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
          : null

        // Tournament summary (null if no entries)
        const tournamentData = tournamentSummary.tournamentsEntered > 0
          ? {
              tournamentsEntered: tournamentSummary.tournamentsEntered,
              matchWins: tournamentSummary.matchWins,
              matchLosses: tournamentSummary.matchLosses,
              bestPlacement: tournamentSummary.bestPlacement,
            }
          : null

        return {
          memberName: userRecord?.name ?? "Unknown",
          memberRole: membership.role,
          joinDate: membership.createdAt
            ? new Date(membership.createdAt).toLocaleDateString()
            : "unknown",
          engagementStats: {
            sessionsAttended: stats.sessionsAttended,
            noShows: stats.noShows,
            attendanceRate: stats.attendanceRate,
            upcomingSessions: stats.upcomingSessions,
          },
          orgAverages: {
            activeMemberCount: orgAverages.activeMemberCount,
            avgSessionsAttended: Math.round(orgAverages.avgSessionsAttended * 10) / 10,
            avgAttendanceRate: Math.round(orgAverages.avgAttendanceRate),
          },
          daysSinceLastActivity,
          paymentStats,
          cancellationStats,
          activityDepth: activityDepth.map((a) => ({
            activityName: a.activityName,
            sessionsLast30Days: a.sessionsLast30Days,
          })),
          dormantActivities,
          recentHistory,
          profileAnswers,
          activityMemberships,
          activityFormAnswers,
          rankings,
          individualStats,
          tournamentSummary: tournamentData,
        } satisfies FeatureContext
      }
    )
  },

  buildPrompt: (_input, context) => {
    const ctx = context as FeatureContext
    const hasHistory = ctx.recentHistory.length > 0
    const hasProfile = ctx.profileAnswers.length > 0
    const hasActivityForms = ctx.activityFormAnswers.length > 0
    const hasMemberships = ctx.activityMemberships.length > 0
    const hasRankings = ctx.rankings.length > 0
    const hasIndividualStats = ctx.individualStats.length > 0
    const hasTournament = ctx.tournamentSummary !== null
    const hasDormantActivities = ctx.dormantActivities.length > 0
    const hasCancellations = ctx.cancellationStats.cancelledCount > 0 || ctx.cancellationStats.waitlistedCount > 0
    const hasNoData =
      ctx.engagementStats.sessionsAttended === 0 &&
      ctx.engagementStats.noShows === 0 &&
      !hasProfile && !hasRankings && !hasTournament

    let task = `Analyze member "${ctx.memberName}" (role: ${ctx.memberRole}, joined: ${ctx.joinDate}).`

    task += "\n\n=== MEMBER STATS ==="
    task += `\nSessions attended: ${ctx.engagementStats.sessionsAttended}, No-shows: ${ctx.engagementStats.noShows}, Attendance rate: ${ctx.engagementStats.attendanceRate}%, Upcoming: ${ctx.engagementStats.upcomingSessions}`

    task += "\n\n=== GROUP AVERAGES (for comparison) ==="
    task += `\nActive members in group: ${ctx.orgAverages.activeMemberCount}`
    task += `\nGroup avg sessions attended: ${ctx.orgAverages.avgSessionsAttended}`
    task += `\nGroup avg attendance rate: ${ctx.orgAverages.avgAttendanceRate}%`

    if (ctx.daysSinceLastActivity !== null) {
      task += `\n\n=== RECENCY ===`
      task += `\nDays since last attended session: ${ctx.daysSinceLastActivity}`
    }

    if (ctx.paymentStats.totalWithPayment > 0) {
      task += `\n\n=== PAYMENT DATA ===`
      task += `\nPaid sessions: ${ctx.paymentStats.paidCount}, Unpaid sessions: ${ctx.paymentStats.unpaidCount}, Total paid sessions: ${ctx.paymentStats.totalWithPayment}`
    }

    if (hasCancellations) {
      task += `\n\n=== CANCELLATION PATTERNS ===`
      task += `\nCancelled: ${ctx.cancellationStats.cancelledCount}, Currently waitlisted: ${ctx.cancellationStats.waitlistedCount}`
    }

    if (ctx.activityDepth.length > 0) {
      task += `\n\n=== ACTIVITY ENGAGEMENT (last 30 days) ===`
      for (const a of ctx.activityDepth) {
        task += `\n${a.activityName}: ${a.sessionsLast30Days} sessions`
      }
      if (hasDormantActivities) {
        task += `\nDormant (member but 0 sessions in 30 days): ${ctx.dormantActivities.join(", ")}`
      }
    }

    if (hasRankings) {
      task += `\n\n=== RANKINGS ===`
      task += `\n${ctx.rankings.map((r) => `- ${r}`).join("\n")}`
    }

    if (hasIndividualStats) {
      task += `\n\n=== RECENT INDIVIDUAL STATS ===`
      task += `\n${ctx.individualStats.map((s) => `- ${s}`).join("\n")}`
    }

    if (hasTournament) {
      const t = ctx.tournamentSummary!
      task += `\n\n=== TOURNAMENT PERFORMANCE ===`
      task += `\nTournaments entered: ${t.tournamentsEntered}, Wins: ${t.matchWins}, Losses: ${t.matchLosses}`
      if (t.bestPlacement) {
        task += `, Best placement: #${t.bestPlacement}`
      }
    }

    if (hasHistory) {
      task += `\n\n=== RECENT SESSIONS ===`
      task += `\n${ctx.recentHistory.map((h) => `- ${h}`).join("\n")}`
    }

    if (hasProfile) {
      task += `\n\nGroup profile:\n${ctx.profileAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (hasActivityForms) {
      task += `\nActivity profiles:\n${ctx.activityFormAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (hasMemberships) {
      task += `\nMember of activities: ${ctx.activityMemberships.join(", ")}`
    }

    if (hasNoData) {
      task += "\n\nThis member has no recorded activity, rankings, or profile information."
    }

    task += "\n\n=== END DATA ==="

    return {
      role: "You are a data analyst helping group administrators understand their members. Your job is to surface NON-OBVIOUS insights — patterns, comparisons, and risks that an admin would NOT see by glancing at the member's profile page.",
      task,
      rules: [
        "Provide exactly 3-5 insights about this member",
        "Each insight MUST follow this exact format on its own line:",
        "[CATEGORY] Title | Description",
        "CATEGORY must be one of: STRENGTH, CONCERN, ACTION, TREND",
        "- STRENGTH = something genuinely positive that sets this member apart",
        "- CONCERN = a risk or problem that needs admin attention",
        "- ACTION = a specific, actionable recommendation the admin should take",
        "- TREND = a pattern over time worth monitoring",
        "Title must be 2-6 words, concise",
        "Description must be 1 sentence with specific numbers from the data",
        "CRITICAL: Do NOT just restate raw stats the admin can already see on the profile page",
        "INSTEAD: Compare to group averages, identify patterns across activities, flag payment issues, detect inactivity risks, highlight competitive achievements",
        "If their attendance rate is within 10% of the group average, do NOT call it remarkable — focus on more interesting data",
        "Prioritize these insight types (in order): payment issues > inactivity risks > cross-activity patterns > comparative performance > tournament achievements > engagement trends",
        "If the member has dormant activities, this is more interesting than listing activities they are active in",
        "If there is very limited data, output 1-2 insights about onboarding this new member",
        "Each insight must be on its own line, no blank lines between them",
        "Do not add any text before or after the insights — only output the insight lines",
      ],
      examples: [
        "[CONCERN] Outstanding Payments | Has 4 unpaid sessions out of 7 attended — follow up on payment collection.",
        "[TREND] Fading Engagement | Active in 11 activities but attended 0 sessions in Badminton and Tennis in the last 30 days.",
        "[STRENGTH] Above-Average Commitment | Attended 18 sessions vs the group average of 9, placing in the top tier of engagement.",
        "[STRENGTH] Tournament Competitor | Won 8 of 12 tournament matches with a best placement of 2nd.",
        "[ACTION] Re-engage Dormant Member | Last attended 45 days ago despite having 5 upcoming sessions scheduled.",
        "[CONCERN] Rising Cancellations | Cancelled 3 sessions recently after previously consistent attendance — check if something changed.",
      ],
    }
  },
}

import { z } from "zod"
import { getEngagementStats } from "@/data-access/engagement-stats"
import { getUserHistory } from "@/data-access/participations"
import { getProfileByOrgAndUser } from "@/data-access/group-member-profiles"
import { getUserById } from "@/data-access/users"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import { getUserActivityFormAnswers } from "@/data-access/activity-join-requests"
import { listUserActivityMemberships } from "@/data-access/activity-members"
import { getMemberRanksByUser } from "@/plugins/ranking/data-access/member-ranks"
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
  recentHistory: string[]
  profileAnswers: string[]
  activityMemberships: string[]
  activityFormAnswers: string[]
  rankings: string[]
}

export const summarizeMemberProfile: AIFeature<typeof inputSchema> = {
  id: "summarizeMemberProfile",
  inputSchema,
  model: "mistral:7b",
  temperature: 0.3,
  access: "admin",

  fetchContext: async (ctx: AIFeatureContext, input) => {
    return withAIFeatureScope(
      ctx.activeOrganization.id,
      async (scope) => {
        const userId = input.userId
        const membership = await scope.requireMember(userId)

        const [userRecord, stats, history, profile, settings, activityForms, memberships, ranks] =
          await Promise.all([
            getUserById(userId),
            getEngagementStats(userId, scope.organizationId),
            getUserHistory(scope.organizationId, userId, { limit: 5, offset: 0 }),
            getProfileByOrgAndUser(scope.organizationId, userId),
            getOrCreateOrgSettings(scope.organizationId),
            getUserActivityFormAnswers(userId, scope.organizationId),
            listUserActivityMemberships(userId, scope.organizationId),
            getMemberRanksByUser(userId, scope.organizationId),
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
            `${h.session.title} (${new Date(h.session.dateTime).toLocaleDateString()}) - ${h.participation.attendance}`
        )

        // Activity memberships
        const activityMemberships = memberships.map(
          (m) => m.activity.name
        )

        // Activity form answers (per activity, with labels from schema)
        const activityFormAnswers = activityForms.flatMap((af) => {
          const schema = af.joinFormSchema as { fields?: FormField[] } | null
          const fields = schema?.fields ?? []
          const answers = (af.formAnswers as Record<string, unknown>) ?? {}
          const lines = fields
            .map((f) => {
              const val = answers[f.id]
              if (val === undefined || val === null || val === "") return null
              return `${f.label}: ${Array.isArray(val) ? val.join(", ") : String(val)}`
            })
            .filter((x): x is string => x !== null)
          if (lines.length === 0) return []
          return [`[${af.activityName}] ${lines.join(", ")}`]
        })

        // Ranking data
        const rankings = ranks.map((r) => {
          const stats = r.stats as Record<string, unknown> | null
          const statParts = stats
            ? Object.entries(stats)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "no stats"
          const level = r.levelName ? `Level: ${r.levelName}` : ""
          return `${r.definitionName}${level ? ` (${level})` : ""} — ${statParts}`
        })

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
          recentHistory,
          profileAnswers,
          activityMemberships,
          activityFormAnswers,
          rankings,
        } satisfies FeatureContext
      }
    )
  },

  buildPrompt: (_input, context) => {
    const ctx = context as FeatureContext
    const hasHistory = ctx.recentHistory.length > 0
    const hasProfile = ctx.profileAnswers.length > 0
    const hasActivity =
      ctx.engagementStats.sessionsAttended > 0 ||
      ctx.engagementStats.noShows > 0 ||
      ctx.engagementStats.upcomingSessions > 0
    const hasActivityForms = ctx.activityFormAnswers.length > 0
    const hasMemberships = ctx.activityMemberships.length > 0
    const hasRankings = ctx.rankings.length > 0

    let task = `Summarize the profile of member "${ctx.memberName}" (role: ${ctx.memberRole}, joined: ${ctx.joinDate}).`

    task += "\n\n=== PROVIDED DATA ==="
    task += `\nEngagement: ${ctx.engagementStats.sessionsAttended} sessions attended, ${ctx.engagementStats.noShows} no-shows, ${ctx.engagementStats.attendanceRate}% attendance rate, ${ctx.engagementStats.upcomingSessions} upcoming sessions.`

    if (hasProfile) {
      task += `\nGroup profile:\n${ctx.profileAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (hasActivityForms) {
      task += `\nActivity profiles:\n${ctx.activityFormAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (hasMemberships) {
      task += `\nActive in activities: ${ctx.activityMemberships.join(", ")}`
    }

    if (hasRankings) {
      task += `\nRankings:\n${ctx.rankings.map((r) => `- ${r}`).join("\n")}`
    }

    if (hasHistory) {
      task += `\nRecent sessions:\n${ctx.recentHistory.map((h) => `- ${h}`).join("\n")}`
    }

    if (!hasActivity && !hasProfile && !hasHistory && !hasActivityForms && !hasRankings) {
      task += "\nThis member has no recorded activity or profile information."
    }

    task += "\n=== END DATA ==="

    return {
      role: "You are helping group admins understand their members at a glance.",
      task,
      rules: [
        "Provide exactly 3-5 insights about this member",
        "Each insight MUST follow this exact format on its own line:",
        "[CATEGORY] Title | Description",
        "CATEGORY must be one of: STRENGTH, CONCERN, ACTION, TREND",
        "- STRENGTH = something positive (reliable attendance, active participation, good ranking, etc.)",
        "- CONCERN = something that needs attention (no-shows, declining engagement, inactivity)",
        "- ACTION = a specific recommendation for the admin regarding this member",
        "- TREND = a notable pattern worth watching (improving, new member, consistent, etc.)",
        "Title must be 2-6 words, concise",
        "Description must be 1 sentence referencing specific data provided above",
        "Each insight must be on its own line, no blank lines between them",
        "Do not add any text before or after the insights — only output the insight lines",
        "Only describe what the data shows — do not speculate",
        "If there is very limited data, output 1-2 insights noting what is available",
        "Use profile, activity, and ranking data to provide rich, personalized insights",
      ],
      examples: [
        "[STRENGTH] Consistent Attendance Record | Attended 12 of 14 sessions with an 86% attendance rate.",
        "[TREND] Active Across Activities | Member of Badminton and Tennis with regular participation in both.",
        "[STRENGTH] Strong Ranking Performance | Ranked at Gold level with 15 wins and 3 losses in Badminton.",
        "[CONCERN] Recent Attendance Drop | No-show for the last 2 sessions after previously consistent attendance.",
        "[ACTION] Welcome New Member | Joined 3 days ago with no sessions yet — consider reaching out.",
      ],
    }
  },
}

import { z } from "zod"
import { getUserHistory } from "@/data-access/participations"
import { getEngagementStats } from "@/data-access/engagement-stats"
import { getUserById } from "@/data-access/users"
import { getProfileByOrgAndUser } from "@/data-access/group-member-profiles"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import { getUserActivityFormAnswers } from "@/data-access/activity-join-requests"
import { getMemberRanksByUser } from "@/plugins/ranking/data-access/member-ranks"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import { withAIFeatureScope } from "@/plugins/ai/org-scope"
import type { FormField } from "@/types/form"

const inputSchema = z.object({
  participationId: z.string().min(1),
  sessionId: z.string().min(1),
})

type FeatureContext = {
  memberName: string
  sessionTitle: string
  sessionDate: string
  attendance: string
  payment: string
  existingNotes: string | null
  engagementStats: {
    sessionsAttended: number
    noShows: number
    attendanceRate: number
  }
  recentHistory: string[]
  profileAnswers: string[]
  activityFormAnswers: string[]
  rankings: string[]
}

export const suggestParticipationNote: AIFeature<typeof inputSchema> = {
  id: "suggestParticipationNote",
  inputSchema,
  model: "mistral:7b",
  temperature: 0.3,
  access: "admin",

  fetchContext: async (ctx: AIFeatureContext, input) => {
    return withAIFeatureScope(
      ctx.activeOrganization.id,
      async (scope) => {
        const [currentParticipation, session] = await Promise.all([
          scope.requireParticipationForSession(input.participationId, input.sessionId),
          scope.requireSession(input.sessionId),
        ])

        const userId = currentParticipation.userId

        const [userRecord, stats, history, profile, settings, activityForms, ranks] =
          await Promise.all([
            getUserById(userId),
            getEngagementStats(userId, scope.organizationId),
            getUserHistory(scope.organizationId, userId, {
              limit: 5,
              offset: 0,
            }),
            getProfileByOrgAndUser(scope.organizationId, userId),
            getOrCreateOrgSettings(scope.organizationId),
            getUserActivityFormAnswers(userId, scope.organizationId),
            getMemberRanksByUser(userId, scope.organizationId),
          ])

        const recentHistory = history
          .filter((h) => h.participation.id !== input.participationId)
          .map(
            (h) =>
              `${h.session.title} (${new Date(h.session.dateTime).toLocaleDateString()}) - ${h.participation.attendance}`
          )

        // Org-level profile answers
        const joinFormSchema = settings.joinFormSchema as {
          fields?: FormField[]
        } | null
        const formFields = joinFormSchema?.fields ?? []
        const answers = (profile?.answers as Record<string, unknown>) ?? {}
        const profileAnswers = formFields
          .map((f) => {
            const val = answers[f.id]
            if (val === undefined || val === null || val === "") return null
            return `${f.label}: ${Array.isArray(val) ? val.join(", ") : String(val)}`
          })
          .filter((x): x is string => x !== null)

        // Activity form answers — prioritize the activity this session belongs to
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
          const prefix = af.activityId === session.activityId ? "[Current activity" : `[${af.activityName}`
          return [`${prefix}] ${lines.join(", ")}`]
        })

        // Ranking data — prioritize the activity this session belongs to
        const rankings = ranks.map((r) => {
          const rankStats = r.stats as Record<string, unknown> | null
          const statParts = rankStats
            ? Object.entries(rankStats)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "no stats"
          const level = r.levelName ? `Level: ${r.levelName}` : ""
          const activityTag = r.activityId === session.activityId ? " (current activity)" : ""
          return `${r.definitionName}${level ? ` (${level})` : ""}${activityTag} — ${statParts}`
        })

        return {
          memberName: userRecord?.name ?? "Unknown",
          sessionTitle: session.title,
          sessionDate: new Date(session.dateTime).toLocaleDateString(),
          attendance: currentParticipation.attendance,
          payment: currentParticipation.payment,
          existingNotes: currentParticipation.notes,
          engagementStats: {
            sessionsAttended: stats.sessionsAttended,
            noShows: stats.noShows,
            attendanceRate: stats.attendanceRate,
          },
          recentHistory,
          profileAnswers,
          activityFormAnswers,
          rankings,
        } satisfies FeatureContext
      }
    )
  },

  buildPrompt: (_input, context) => {
    const ctx = context as FeatureContext
    const hasProfile = ctx.profileAnswers.length > 0
    const hasActivityForms = ctx.activityFormAnswers.length > 0
    const hasRankings = ctx.rankings.length > 0

    let task = `Write a brief note for "${ctx.memberName}" in session "${ctx.sessionTitle}" (${ctx.sessionDate}).`

    task += "\n\n=== PROVIDED DATA ==="
    task += `\nAttendance: ${ctx.attendance}, Payment: ${ctx.payment}`
    task += `\nOverall stats: ${ctx.engagementStats.sessionsAttended} sessions attended, ${ctx.engagementStats.noShows} no-shows, ${ctx.engagementStats.attendanceRate}% attendance rate`

    if (ctx.existingNotes) {
      task += `\nExisting notes: "${ctx.existingNotes}"`
    }

    if (hasProfile) {
      task += `\nGroup profile:\n${ctx.profileAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (hasActivityForms) {
      task += `\nActivity profiles:\n${ctx.activityFormAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (hasRankings) {
      task += `\nRankings:\n${ctx.rankings.map((r) => `- ${r}`).join("\n")}`
    }

    if (ctx.recentHistory.length > 0) {
      task += `\nRecent history:\n${ctx.recentHistory.map((h) => `- ${h}`).join("\n")}`
    }

    task += "\n=== END DATA ==="

    return {
      role: "You are a data analyst helping group administrators understand individual participant profiles.",
      task,
      rules: [
        "Provide exactly 2-4 insights about this participant",
        "Each insight MUST follow this exact format on its own line:",
        "[CATEGORY] Title | Description",
        "CATEGORY must be one of: STRENGTH, CONCERN, ACTION, TREND",
        "- STRENGTH = something positive (reliable attendance, consistent payment, ranking performance, etc.)",
        "- CONCERN = something that needs attention (no-shows, unpaid, declining engagement or ranking)",
        "- ACTION = a specific recommendation the admin should take for this participant",
        "- TREND = a notable pattern worth watching (improving, new member, ranking changes, etc.)",
        "Title must be 2-6 words, concise",
        "Description must be 1 sentence referencing specific data provided above",
        "Each insight must be on its own line, no blank lines between them",
        "Do not add any text before or after the insights — only output the insight lines",
        "If there is no prior history, output 1-2 insights based on current session data only",
        "If existing notes are provided, incorporate them as context but do not repeat them",
        "Use profile and ranking data to provide richer, more personalized insights",
      ],
      examples: [
        "[STRENGTH] Reliable Attendance Record | Attended 8 of 9 sessions with a 89% attendance rate.",
        "[CONCERN] Recent No-Show Pattern | Marked as no-show for this session despite consistent prior attendance.",
        "[ACTION] Follow Up on Payment | Payment is still pending — consider sending a reminder.",
        "[TREND] New Active Member | First session attendance, monitor engagement in upcoming sessions.",
      ],
    }
  },
}

import { z } from "zod"
import { getUserHistory } from "@/data-access/participations"
import { getEngagementStats } from "@/data-access/engagement-stats"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import { withAIFeatureScope } from "@/plugins/ai/org-scope"

const inputSchema = z.object({
  participationId: z.string().min(1),
  sessionId: z.string().min(1),
})

type FeatureContext = {
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

        const [stats, history] = await Promise.all([
          getEngagementStats(currentParticipation.userId, scope.organizationId),
          getUserHistory(scope.organizationId, currentParticipation.userId, {
            limit: 5,
            offset: 0,
          }),
        ])

        const recentHistory = history
          .filter((h) => h.participation.id !== input.participationId)
          .map(
            (h) =>
              `${h.session.title} (${new Date(h.session.dateTime).toLocaleDateString()}) - ${h.participation.attendance}`
          )

        return {
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
        } satisfies FeatureContext
      }
    )
  },

  buildPrompt: (_input, context) => {
    const ctx = context as FeatureContext

    let task = `Write a brief note for a participant in session "${ctx.sessionTitle}" (${ctx.sessionDate}).`

    task += "\n\n=== PROVIDED DATA ==="
    task += `\nAttendance: ${ctx.attendance}, Payment: ${ctx.payment}`
    task += `\nOverall stats: ${ctx.engagementStats.sessionsAttended} sessions attended, ${ctx.engagementStats.noShows} no-shows, ${ctx.engagementStats.attendanceRate}% attendance rate`

    if (ctx.existingNotes) {
      task += `\nExisting notes: "${ctx.existingNotes}"`
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
        "- STRENGTH = something positive (reliable attendance, consistent payment, etc.)",
        "- CONCERN = something that needs attention (no-shows, unpaid, declining engagement)",
        "- ACTION = a specific recommendation the admin should take for this participant",
        "- TREND = a notable pattern worth watching (improving, new member, etc.)",
        "Title must be 2-6 words, concise",
        "Description must be 1 sentence referencing specific data provided above",
        "Each insight must be on its own line, no blank lines between them",
        "Do not add any text before or after the insights — only output the insight lines",
        "If there is no prior history, output 1-2 insights based on current session data only",
        "If existing notes are provided, incorporate them as context but do not repeat them",
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

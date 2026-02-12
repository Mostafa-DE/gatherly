import { z } from "zod"
import { getEngagementStats } from "@/data-access/engagement-stats"
import { getUserHistory } from "@/data-access/participations"
import { listMemberNotes } from "@/data-access/member-notes"
import { getProfileByOrgAndUser } from "@/data-access/group-member-profiles"
import { getUserById } from "@/data-access/users"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import { withAIFeatureScope } from "@/plugins/ai/org-scope"
import type { FormField } from "@/types/form"

const inputSchema = z.object({
  targetUserId: z.string().min(1),
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
  existingNotes: string[]
  profileAnswers: string[]
}

export const suggestMemberNote: AIFeature<typeof inputSchema> = {
  id: "suggestMemberNote",
  inputSchema,
  model: "mistral:7b",
  temperature: 0.3,
  access: "admin",

  fetchContext: async (ctx: AIFeatureContext, input) => {
    return withAIFeatureScope(
      ctx.activeOrganization.id,
      async (scope) => {
        const userId = input.targetUserId
        const membership = await scope.requireMember(userId)

        const [userRecord, stats, history, notes, profile, settings] =
          await Promise.all([
            getUserById(userId),
            getEngagementStats(userId, scope.organizationId),
            getUserHistory(scope.organizationId, userId, { limit: 10, offset: 0 }),
            listMemberNotes(scope.organizationId, userId),
            getProfileByOrgAndUser(scope.organizationId, userId),
            getOrCreateOrgSettings(scope.organizationId),
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

        const existingNotes = notes.map((n) => n.note.content)

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
          existingNotes,
          profileAnswers,
        } satisfies FeatureContext
      }
    )
  },

  buildPrompt: (input, context) => {
    const ctx = context as FeatureContext
    const hasHistory = ctx.recentHistory.length > 0
    const hasProfile = ctx.profileAnswers.length > 0
    const hasActivity =
      ctx.engagementStats.sessionsAttended > 0 ||
      ctx.engagementStats.noShows > 0 ||
      ctx.engagementStats.upcomingSessions > 0

    let task = `Write a brief admin note about member "${ctx.memberName}" (role: ${ctx.memberRole}, joined: ${ctx.joinDate}).`

    task += "\n\n=== PROVIDED DATA ==="
    task += `\nEngagement: ${ctx.engagementStats.sessionsAttended} sessions attended, ${ctx.engagementStats.noShows} no-shows, ${ctx.engagementStats.attendanceRate}% attendance rate, ${ctx.engagementStats.upcomingSessions} upcoming.`

    if (hasHistory) {
      task += `\nRecent activity:\n${ctx.recentHistory.map((h) => `- ${h}`).join("\n")}`
    }

    if (hasProfile) {
      task += `\nProfile:\n${ctx.profileAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (!hasActivity && !hasProfile && !hasHistory) {
      task += "\nThis member has no recorded engagement data or profile information."
    }

    task += "\n=== END DATA ==="

    return {
      role: `You are an assistant helping group admins write notes about their members in the group "${input.targetUserId}".`,
      task,
      examples:
        ctx.existingNotes.length > 0 ? ctx.existingNotes.slice(0, 3) : undefined,
      rules: [
        "Write 1-3 factual, action-oriented sentences",
        "Only reference data points explicitly listed above",
        "If there is no engagement data or profile information to base a note on, state that there is not enough data to suggest a meaningful note",
        "Base the note on the member's actual engagement data and profile",
        "Do NOT repeat or paraphrase existing notes",
        "Mention notable patterns (e.g. consistent attendance, recent no-shows)",
        "Return only the note text, no quotes or labels",
      ],
    }
  },
}

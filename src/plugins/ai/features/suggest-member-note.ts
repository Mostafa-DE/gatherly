import { z } from "zod"
import { getEngagementStats } from "@/data-access/engagement-stats"
import { getUserHistory } from "@/data-access/participations"
import { listMemberNotes } from "@/data-access/member-notes"
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
  activityMemberships: string[]
  activityFormAnswers: string[]
  rankings: string[]
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

        const [userRecord, stats, history, notes, profile, settings, activityForms, memberships, ranks] =
          await Promise.all([
            getUserById(userId),
            getEngagementStats(userId, scope.organizationId),
            getUserHistory(scope.organizationId, userId, { limit: 10, offset: 0 }),
            listMemberNotes(scope.organizationId, userId),
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

        const existingNotes = notes.map((n) => n.note.content)

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
          const rankStats = r.stats as Record<string, unknown> | null
          const statParts = rankStats
            ? Object.entries(rankStats)
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
          existingNotes,
          profileAnswers,
          activityMemberships,
          activityFormAnswers,
          rankings,
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
    const hasActivityForms = ctx.activityFormAnswers.length > 0
    const hasMemberships = ctx.activityMemberships.length > 0
    const hasRankings = ctx.rankings.length > 0

    let task = `Write a brief admin note about member "${ctx.memberName}" (role: ${ctx.memberRole}, joined: ${ctx.joinDate}).`

    task += "\n\n=== PROVIDED DATA ==="
    task += `\nEngagement: ${ctx.engagementStats.sessionsAttended} sessions attended, ${ctx.engagementStats.noShows} no-shows, ${ctx.engagementStats.attendanceRate}% attendance rate, ${ctx.engagementStats.upcomingSessions} upcoming.`

    if (hasHistory) {
      task += `\nRecent activity:\n${ctx.recentHistory.map((h) => `- ${h}`).join("\n")}`
    }

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

    if (!hasActivity && !hasProfile && !hasHistory && !hasActivityForms && !hasRankings) {
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
        "Base the note on the member's actual engagement data, profile, and ranking performance",
        "Do NOT repeat or paraphrase existing notes",
        "Mention notable patterns (e.g. consistent attendance, recent no-shows, ranking trends)",
        "Return only the note text, no quotes or labels",
      ],
    }
  },
}

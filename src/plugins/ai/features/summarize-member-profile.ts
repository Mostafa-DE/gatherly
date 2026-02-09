import { z } from "zod"
import { getEngagementStats } from "@/data-access/engagement-stats"
import { getUserHistory } from "@/data-access/participations"
import { getProfileByOrgAndUser } from "@/data-access/group-member-profiles"
import { getOrganizationMemberByUserId } from "@/data-access/organizations"
import { getUserById } from "@/data-access/users"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
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
}

export const summarizeMemberProfile: AIFeature<typeof inputSchema> = {
  id: "summarizeMemberProfile",
  inputSchema,
  model: "mistral:7b",
  temperature: 0.3,
  access: "admin",

  fetchContext: async (ctx: AIFeatureContext, input) => {
    const orgId = ctx.activeOrganization.id
    const userId = input.userId

    const [userRecord, membership, stats, history, profile, settings] =
      await Promise.all([
        getUserById(userId),
        getOrganizationMemberByUserId(orgId, userId),
        getEngagementStats(userId, orgId),
        getUserHistory(orgId, userId, { limit: 5, offset: 0 }),
        getProfileByOrgAndUser(orgId, userId),
        getOrCreateOrgSettings(orgId),
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

    return {
      memberName: userRecord?.name ?? "Unknown",
      memberRole: membership?.role ?? "member",
      joinDate: membership?.createdAt
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
    } satisfies FeatureContext
  },

  buildPrompt: (_input, context) => {
    const ctx = context as FeatureContext
    const hasHistory = ctx.recentHistory.length > 0
    const hasProfile = ctx.profileAnswers.length > 0
    const hasActivity =
      ctx.engagementStats.sessionsAttended > 0 ||
      ctx.engagementStats.noShows > 0 ||
      ctx.engagementStats.upcomingSessions > 0

    let task = `Summarize the profile of member "${ctx.memberName}" (role: ${ctx.memberRole}, joined: ${ctx.joinDate}).`

    task += "\n\n=== PROVIDED DATA ==="
    task += `\nEngagement: ${ctx.engagementStats.sessionsAttended} sessions attended, ${ctx.engagementStats.noShows} no-shows, ${ctx.engagementStats.attendanceRate}% attendance rate, ${ctx.engagementStats.upcomingSessions} upcoming sessions.`

    if (hasProfile) {
      task += `\nProfile info:\n${ctx.profileAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    if (hasHistory) {
      task += `\nRecent sessions:\n${ctx.recentHistory.map((h) => `- ${h}`).join("\n")}`
    }

    if (!hasActivity && !hasProfile && !hasHistory) {
      task += "\nThis member has no recorded activity or profile information."
    }

    task += "\n=== END DATA ==="

    return {
      role: "You are helping group admins understand their members at a glance.",
      task,
      rules: [
        "Write 2-4 sentences covering who they are, their engagement level, and any notable patterns",
        "Only describe what the data shows — do not speculate about the member's interests, personality, or behavior",
        "If the member has no session history and no profile information, state that limited data is available for this member",
        "Use profile information to add personal context where available",
        "Mention attendance trends (improving, declining, consistent)",
        "Be factual and concise — this is an overview summary",
        "Return only the summary text, no quotes or labels",
      ],
    }
  },
}

import { z } from "zod"
import { getParticipationById } from "@/data-access/participations"
import { getUserHistory } from "@/data-access/participations"
import { getEngagementStats } from "@/data-access/engagement-stats"
import { getSessionById } from "@/data-access/sessions"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"

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
    const orgId = ctx.activeOrganization.id

    const [currentParticipation, session] = await Promise.all([
      getParticipationById(input.participationId),
      getSessionById(input.sessionId),
    ])

    if (!currentParticipation || !session) {
      return {
        sessionTitle: "Unknown Session",
        sessionDate: "unknown",
        attendance: "pending",
        payment: "unpaid",
        existingNotes: null,
        engagementStats: {
          sessionsAttended: 0,
          noShows: 0,
          attendanceRate: 0,
        },
        recentHistory: [],
      } satisfies FeatureContext
    }

    const [stats, history] = await Promise.all([
      getEngagementStats(currentParticipation.userId, orgId),
      getUserHistory(orgId, currentParticipation.userId, {
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
      role: "You are helping group admins write brief notes about session participants.",
      task,
      rules: [
        "Write 1-2 factual sentences",
        "Only reference the attendance, payment, and history data provided above",
        "If there is no prior history, do not speculate about the participant's patterns",
        "Mention attendance pattern if notable (e.g. consistent shows, recent no-show)",
        "If existing notes are provided, complement them rather than repeat",
        "Return only the note text, no quotes or labels",
      ],
    }
  },
}

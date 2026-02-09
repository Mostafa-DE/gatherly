import { z } from "zod"
import { listPastSessions } from "@/data-access/sessions"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"

const inputSchema = z.object({
  sessionTitle: z.string().min(1).max(200),
  location: z.string().max(500).optional(),
  dateTime: z.coerce.date().optional(),
})

type FeatureContext = {
  orgName: string
  pastDescriptions: string[]
}

export const suggestSessionDescription: AIFeature<typeof inputSchema> = {
  id: "suggestSessionDescription",
  inputSchema,
  model: "mistral:7b",
  temperature: 0.5,
  access: "admin",

  fetchContext: async (ctx: AIFeatureContext) => {
    const pastSessions = await listPastSessions(ctx.activeOrganization.id, {
      limit: 5,
      offset: 0,
    })

    const pastDescriptions = pastSessions
      .map((s) => s.description)
      .filter((d): d is string => d !== null && d.trim().length > 0)
      .slice(0, 3)

    return {
      orgName: ctx.activeOrganization.name,
      pastDescriptions,
    } satisfies FeatureContext
  },

  buildPrompt: (input, context) => {
    const { orgName, pastDescriptions } = context as FeatureContext

    let task = `Session title: "${input.sessionTitle}"`
    if (input.location) {
      task += `\nLocation: ${input.location}`
    }
    if (input.dateTime) {
      task += `\nDate/Time: ${input.dateTime.toLocaleString()}`
    }

    return {
      role: `You are writing a short description for an event session in the group "${orgName}".`,
      task,
      examples: pastDescriptions.length > 0 ? pastDescriptions : undefined,
      rules: [
        "Write a concise, engaging description (2-4 sentences)",
        "Match the tone of past descriptions if provided",
        "Include relevant details about what participants can expect",
        "Do not fabricate specific details about the session content that are not implied by the title",
        "Do not include the title, date, or location in the description (they are shown separately)",
        "Return only the description text, no quotes or labels",
      ],
    }
  },
}

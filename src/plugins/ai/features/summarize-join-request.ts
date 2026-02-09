import { z } from "zod"
import { getJoinRequestWithDetails } from "@/data-access/join-requests"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import type { FormField } from "@/types/form"

const inputSchema = z.object({
  requestId: z.string().min(1),
})

type FeatureContext = {
  orgName: string
  applicantName: string
  message: string | null
  formAnswers: string[]
  requestDate: string
}

export const summarizeJoinRequest: AIFeature<typeof inputSchema> = {
  id: "summarizeJoinRequest",
  inputSchema,
  model: "mistral:7b",
  temperature: 0.5,
  access: "admin",

  fetchContext: async (ctx: AIFeatureContext, input) => {
    const [requestDetails, settings] = await Promise.all([
      getJoinRequestWithDetails(input.requestId),
      getOrCreateOrgSettings(ctx.activeOrganization.id),
    ])

    if (!requestDetails) {
      return {
        orgName: ctx.activeOrganization.name,
        applicantName: "Unknown",
        message: null,
        formAnswers: [],
        requestDate: "unknown",
      } satisfies FeatureContext
    }

    const joinFormSchema = settings.joinFormSchema as {
      fields?: FormField[]
    } | null
    const formFields = joinFormSchema?.fields || []
    const answers =
      (requestDetails.request.formAnswers as Record<string, unknown>) || {}

    const formAnswers = formFields
      .map((f) => {
        const val = answers[f.id]
        if (val === undefined || val === null || val === "") return null
        return `${f.label}: ${Array.isArray(val) ? val.join(", ") : String(val)}`
      })
      .filter((x): x is string => x !== null)

    return {
      orgName: requestDetails.organization.name,
      applicantName: requestDetails.user.name ?? "Unknown",
      message: requestDetails.request.message,
      formAnswers,
      requestDate: new Date(
        requestDetails.request.createdAt
      ).toLocaleDateString(),
    } satisfies FeatureContext
  },

  buildPrompt: (_input, context) => {
    const ctx = context as FeatureContext

    let task = `Summarize the join request from "${ctx.applicantName}" to join "${ctx.orgName}" (submitted ${ctx.requestDate}).`

    if (ctx.message) {
      task += `\n\nMessage from applicant: "${ctx.message}"`
    }

    if (ctx.formAnswers.length > 0) {
      task += `\n\nForm answers:\n${ctx.formAnswers.map((a) => `- ${a}`).join("\n")}`
    }

    return {
      role: `You are helping group admins review join requests for "${ctx.orgName}".`,
      task,
      rules: [
        "Write 2-3 concise, objective sentences",
        "Highlight the most relevant information from the form answers",
        "If there is a personal message, mention its key point",
        "Be factual and neutral — do not recommend approval or rejection",
        "Return only the summary text, no quotes or labels",
      ],
    }
  },
}

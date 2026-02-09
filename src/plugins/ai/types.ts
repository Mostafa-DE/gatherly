import type { z } from "zod"
import type { Database } from "@/db"
import type { Organization, Member } from "@/db/types"

export type PromptSections = {
  role: string
  task: string
  examples?: string[]
  rules: string[]
}

export type AIFeatureContext = {
  db: Database
  activeOrganization: Organization
  membership: Member
  user: { id: string; name: string; email: string }
}

export type AIFeature<TInput extends z.ZodType> = {
  id: string
  inputSchema: TInput
  model: string
  temperature?: number
  topP?: number
  access: "admin" | "member"
  fetchContext: (ctx: AIFeatureContext, input: z.infer<TInput>) => Promise<unknown>
  buildPrompt: (input: z.infer<TInput>, context: unknown) => PromptSections
}

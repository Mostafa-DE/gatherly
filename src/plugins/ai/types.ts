import type { z } from "zod"
import type { Database } from "@/db"
import type { Organization, Member } from "@/db/types"

export type AIProvider = "groq" | "cerebras" | "openrouter" | "together" | "openai" | "custom"

export type ChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type AIGenerateRequest = {
  model: string
  messages: ChatMessage[]
  temperature?: number
  topP?: number
  maxTokens?: number
}

export type AIClient = {
  checkHealth: () => Promise<boolean>
  generateText: (request: AIGenerateRequest) => Promise<string>
  generateTextStream: (request: AIGenerateRequest) => AsyncGenerator<string>
}

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
  model?: string
  temperature?: number
  topP?: number
  access: "admin" | "member"
  collectPII?: (context: unknown) => string[]
  fetchContext: (ctx: AIFeatureContext, input: z.infer<TInput>) => Promise<unknown>
  buildPrompt: (input: z.infer<TInput>, context: unknown) => PromptSections
}

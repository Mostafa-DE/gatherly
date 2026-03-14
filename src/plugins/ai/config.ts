import type { AIProvider } from "@/plugins/ai/types"

const DEFAULT_AI_NUM_PREDICT = 256

export type AIProviderConfig = {
  provider: AIProvider
  apiKey: string
  baseUrl: string
  model: string
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  cerebras: "https://api.cerebras.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  together: "https://api.together.xyz/v1",
  openai: "https://api.openai.com/v1",
}

const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  cerebras: "llama-3.3-70b",
  openrouter: "meta-llama/llama-3.3-70b-instruct",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  openai: "gpt-4o-mini",
}

function getEnvValue(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

export function resolveProvider(): AIProvider {
  const provider = getEnvValue("AI_PROVIDER")
  if (provider) return provider as AIProvider
  return "groq"
}

export function resolveProviderConfig(
  feature: { id: string; model?: string }
): AIProviderConfig {
  const provider = resolveProvider()

  const apiKey = getEnvValue("AI_API_KEY")
  if (!apiKey) {
    throw new Error(`AI_API_KEY is required for provider "${provider}"`)
  }

  return {
    provider,
    apiKey,
    baseUrl:
      getEnvValue("AI_BASE_URL") ?? PROVIDER_BASE_URLS[provider] ?? "",
    model: resolveAIModel(feature),
  }
}

export function resolveAIModel(feature: { id: string; model?: string }): string {
  const explicit = getEnvValue("AI_MODEL")
  if (explicit) return explicit

  const provider = resolveProvider()
  return DEFAULT_PROVIDER_MODELS[provider] ?? feature.model ?? "llama-3.3-70b-versatile"
}

export function resolveAINumPredict(): number {
  return DEFAULT_AI_NUM_PREDICT
}

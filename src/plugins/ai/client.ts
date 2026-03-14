import { resolveProviderConfig } from "@/plugins/ai/config"
import { createOpenAICompatibleClient } from "@/plugins/ai/clients/openai-compatible"

type AIRequest = {
  model: string
  prompt: string
  stream: boolean
  options?: {
    temperature?: number
    top_p?: number
    num_predict?: number
  }
}

function getClient() {
  const config = resolveProviderConfig({ id: "" })
  return createOpenAICompatibleClient(config.baseUrl, config.apiKey)
}

export async function generateText(request: AIRequest): Promise<string> {
  return getClient().generateText({
    model: request.model,
    messages: [{ role: "user", content: request.prompt }],
    temperature: request.options?.temperature,
    topP: request.options?.top_p,
    maxTokens: request.options?.num_predict,
  })
}

export async function* generateTextStream(
  request: Omit<AIRequest, "stream">
): AsyncGenerator<string> {
  yield* getClient().generateTextStream({
    model: request.model,
    messages: [{ role: "user", content: request.prompt }],
    temperature: request.options?.temperature,
    topP: request.options?.top_p,
    maxTokens: request.options?.num_predict,
  })
}

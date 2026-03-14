import type { AIClient, AIGenerateRequest } from "@/plugins/ai/types"

type SSEChunk = {
  choices: Array<{
    delta: { content?: string; role?: string }
    finish_reason: string | null
  }>
}

export function createOpenAICompatibleClient(
  baseUrl: string,
  apiKey: string
): AIClient {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }

  async function checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers,
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async function generateText(request: AIGenerateRequest): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.9,
        max_tokens: request.maxTokens ?? 256,
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(
        `AI request failed: ${response.status} ${response.statusText} ${text}`
      )
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
    }

    return (data.choices[0]?.message.content ?? "").trim()
  }

  async function* generateTextStream(
    request: AIGenerateRequest
  ): AsyncGenerator<string> {
    const idleTimeoutMs = 30000
    const maxDurationMs = 60000

    const controller = new AbortController()
    let timer = setTimeout(() => controller.abort(), idleTimeoutMs)
    const maxTimer = setTimeout(() => controller.abort(), maxDurationMs)

    const resetTimer = () => {
      clearTimeout(timer)
      timer = setTimeout(() => controller.abort(), idleTimeoutMs)
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP ?? 0.9,
          max_tokens: request.maxTokens ?? 256,
          stream: true,
        }),
        signal: controller.signal,
      })

      resetTimer()

      if (!response.ok) {
        const text = await response.text().catch(() => "")
        throw new Error(
          `AI request failed: ${response.status} ${response.statusText} ${text}`
        )
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No response body from AI provider")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          resetTimer()

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith("data: ")) continue

            const data = trimmed.slice(6)
            if (data === "[DONE]") return

            try {
              const chunk = JSON.parse(data) as SSEChunk
              const content = chunk.choices[0]?.delta.content
              if (content) {
                yield content
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        if (buffer.trim()) {
          const remaining = buffer.split("\n")
          for (const line of remaining) {
            const trimmed = line.trim()
            if (!trimmed || !trimmed.startsWith("data: ")) continue
            const data = trimmed.slice(6)
            if (data === "[DONE]") return
            try {
              const chunk = JSON.parse(data) as SSEChunk
              const content = chunk.choices[0]?.delta.content
              if (content) {
                yield content
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } finally {
      clearTimeout(timer)
      clearTimeout(maxTimer)
    }
  }

  return { checkHealth, generateText, generateTextStream }
}

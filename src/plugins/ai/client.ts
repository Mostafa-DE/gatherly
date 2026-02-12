type OllamaGenerateRequest = {
  model: string
  prompt: string
  stream: boolean
  options?: {
    temperature?: number
    top_p?: number
  }
}

type OllamaGenerateResponse = {
  model: string
  created_at: string
  response: string
  done: boolean
  total_duration?: number
}

function getOllamaUrl(): string {
  return process.env.OLLAMA_URL || "http://localhost:11434"
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getOllamaUrl()}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function generateText(
  request: OllamaGenerateRequest,
  timeoutMs = 120000
): Promise<string> {
  const response = await fetch(`${getOllamaUrl()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as OllamaGenerateResponse
  return data.response.trim()
}

type OllamaStreamChunk = {
  response: string
  done: boolean
}

export async function* generateTextStream(
  request: Omit<OllamaGenerateRequest, "stream">,
  idleTimeoutMs = 90000
): AsyncGenerator<string> {
  // Idle timeout: aborts if no data arrives within the window.
  // The timer resets on every chunk so active streams run freely,
  // but a stuck model gets killed after idleTimeoutMs of silence.
  const controller = new AbortController()
  let timer = setTimeout(() => controller.abort(), idleTimeoutMs)

  const resetTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(), idleTimeoutMs)
  }

  try {
    const response = await fetch(`${getOllamaUrl()}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, stream: true }),
      signal: controller.signal,
    })

    // Connection established — reset so the model has a full window to
    // process the prompt and emit the first token.
    resetTimer()

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error("No response body from Ollama")
    }

    const decoder = new TextDecoder()
    let buffer = ""

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Got data — model is alive, reset idle timer.
        resetTimer()

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          const chunk = JSON.parse(line) as OllamaStreamChunk
          if (chunk.response) {
            yield chunk.response
          }
        }
      }

      if (buffer.trim()) {
        const chunk = JSON.parse(buffer) as OllamaStreamChunk
        if (chunk.response) {
          yield chunk.response
        }
      }
    } finally {
      reader.releaseLock()
    }
  } finally {
    clearTimeout(timer)
  }
}

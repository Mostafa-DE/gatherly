import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createOpenAICompatibleClient } from "@/plugins/ai/clients/openai-compatible"
import type { AIGenerateRequest } from "@/plugins/ai/types"

const BASE_URL = "https://api.example.com/v1"
const API_KEY = "test-api-key-123"

const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("fetch", mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function createMockSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]))
        index++
      } else {
        controller.close()
      }
    },
  })
}

function sseChunk(content: string): string {
  return `data: {"choices":[{"delta":{"content":"${content}"},"finish_reason":null}]}\n\n`
}

const defaultRequest: AIGenerateRequest = {
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello" },
  ],
}

describe("checkHealth", () => {
  it("returns true when /models responds OK", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const result = await client.checkHealth()

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_URL}/models`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${API_KEY}`,
        }),
      })
    )
  })

  it("returns false when /models responds with non-OK status", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const result = await client.checkHealth()

    expect(result).toBe(false)
  })

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"))

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const result = await client.checkHealth()

    expect(result).toBe(false)
  })

  it("sends correct Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    const client = createOpenAICompatibleClient(BASE_URL, "my-secret-key")
    await client.checkHealth()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-secret-key",
          "Content-Type": "application/json",
        }),
      })
    )
  })
})

describe("generateText", () => {
  it("sends correct request body with model, messages, temperature, etc.", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello back!" } }],
      }),
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const request: AIGenerateRequest = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0.5,
      topP: 0.8,
      maxTokens: 512,
    }

    await client.generateText(request)

    const fetchCall = mockFetch.mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)

    expect(fetchCall[0]).toBe(`${BASE_URL}/chat/completions`)
    expect(body).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      temperature: 0.5,
      top_p: 0.8,
      max_tokens: 512,
      stream: false,
    })
  })

  it("uses default values for temperature, topP, and maxTokens when not provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Response" } }],
      }),
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    await client.generateText({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hi" }],
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)

    expect(body.temperature).toBe(0.7)
    expect(body.top_p).toBe(0.9)
    expect(body.max_tokens).toBe(256)
  })

  it("returns the content from the response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Generated text here" } }],
      }),
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const result = await client.generateText(defaultRequest)

    expect(result).toBe("Generated text here")
  })

  it("trims whitespace from response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "  trimmed text  " } }],
      }),
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const result = await client.generateText(defaultRequest)

    expect(result).toBe("trimmed text")
  })

  it("returns empty string when choices array is empty", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [] }),
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const result = await client.generateText(defaultRequest)

    expect(result).toBe("")
  })

  it("throws on non-OK response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "Rate limit exceeded",
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)

    await expect(client.generateText(defaultRequest)).rejects.toThrow(
      "AI request failed: 429 Too Many Requests Rate limit exceeded"
    )
  })

  it("throws on non-OK response even when text() fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => {
        throw new Error("body unavailable")
      },
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)

    await expect(client.generateText(defaultRequest)).rejects.toThrow(
      "AI request failed: 500 Internal Server Error"
    )
  })

  it("uses correct Authorization header", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "ok" } }],
      }),
    })

    const client = createOpenAICompatibleClient(BASE_URL, "secret-key-456")
    await client.generateText(defaultRequest)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret-key-456",
        }),
      })
    )
  })
})

describe("generateTextStream", () => {
  it("yields content from SSE chunks", async () => {
    vi.useRealTimers()

    const stream = createMockSSEStream([
      sseChunk("Hello"),
      sseChunk(" world"),
      "data: [DONE]\n\n",
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const chunks: string[] = []

    for await (const chunk of client.generateTextStream(defaultRequest)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["Hello", " world"])
  })

  it("stops on data: [DONE] sentinel", async () => {
    vi.useRealTimers()

    const stream = createMockSSEStream([
      sseChunk("Before"),
      "data: [DONE]\n\n",
      sseChunk("After"),
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const chunks: string[] = []

    for await (const chunk of client.generateTextStream(defaultRequest)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["Before"])
    expect(chunks).not.toContain("After")
  })

  it("handles multiple chunks in a single read", async () => {
    vi.useRealTimers()

    const combined = sseChunk("One") + sseChunk("Two") + sseChunk("Three")
    const stream = createMockSSEStream([combined, "data: [DONE]\n\n"])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const chunks: string[] = []

    for await (const chunk of client.generateTextStream(defaultRequest)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["One", "Two", "Three"])
  })

  it("skips empty lines", async () => {
    vi.useRealTimers()

    const stream = createMockSSEStream([
      "\n\n\n" + sseChunk("Content") + "\n\n\ndata: [DONE]\n\n",
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const chunks: string[] = []

    for await (const chunk of client.generateTextStream(defaultRequest)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["Content"])
  })

  it("skips malformed SSE data gracefully", async () => {
    vi.useRealTimers()

    const stream = createMockSSEStream([
      "data: {not valid json}\n\n",
      sseChunk("Valid"),
      "data: [DONE]\n\n",
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const chunks: string[] = []

    for await (const chunk of client.generateTextStream(defaultRequest)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["Valid"])
  })

  it("throws on non-OK response", async () => {
    vi.useRealTimers()

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "Server overloaded",
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)

    await expect(async () => {
      for await (const _ of client.generateTextStream(defaultRequest)) {
        // should not reach here
      }
    }).rejects.toThrow(
      "AI request failed: 503 Service Unavailable Server overloaded"
    )
  })

  it("throws when response body is null", async () => {
    vi.useRealTimers()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: null,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)

    await expect(async () => {
      for await (const _ of client.generateTextStream(defaultRequest)) {
        // should not reach here
      }
    }).rejects.toThrow("No response body from AI provider")
  })

  it("sends stream: true in request body", async () => {
    vi.useRealTimers()

    const stream = createMockSSEStream(["data: [DONE]\n\n"])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)

    for await (const _ of client.generateTextStream(defaultRequest)) {
      // consume
    }

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.stream).toBe(true)
  })

  it("skips lines that do not start with 'data: '", async () => {
    vi.useRealTimers()

    const stream = createMockSSEStream([
      "event: message\n",
      sseChunk("Real"),
      "id: 42\n",
      "data: [DONE]\n\n",
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const chunks: string[] = []

    for await (const chunk of client.generateTextStream(defaultRequest)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["Real"])
  })

  it("skips chunks where delta.content is absent", async () => {
    vi.useRealTimers()

    const stream = createMockSSEStream([
      'data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}\n\n',
      sseChunk("Actual content"),
      "data: [DONE]\n\n",
    ])

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: stream,
    })

    const client = createOpenAICompatibleClient(BASE_URL, API_KEY)
    const chunks: string[] = []

    for await (const chunk of client.generateTextStream(defaultRequest)) {
      chunks.push(chunk)
    }

    expect(chunks).toEqual(["Actual content"])
  })
})

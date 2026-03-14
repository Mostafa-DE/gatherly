import { describe, it, expect, afterEach } from "vitest"
import {
  resolveProvider,
  resolveAIModel,
  resolveProviderConfig,
  resolveAINumPredict,
} from "@/plugins/ai/config"

const envBackup: Record<string, string | undefined> = {}

function setEnv(key: string, value: string) {
  envBackup[key] = process.env[key]
  process.env[key] = value
}

afterEach(() => {
  for (const [key, value] of Object.entries(envBackup)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  for (const key of Object.keys(envBackup)) {
    delete envBackup[key]
  }
})

describe("resolveProvider", () => {
  it("returns 'groq' by default when no env vars are set", () => {
    expect(resolveProvider()).toBe("groq")
  })

  it("returns explicit AI_PROVIDER when set", () => {
    setEnv("AI_PROVIDER", "cerebras")
    expect(resolveProvider()).toBe("cerebras")
  })

  it("returns explicit AI_PROVIDER even when set to openai", () => {
    setEnv("AI_PROVIDER", "openai")
    setEnv("AI_API_KEY", "test-key-123")
    expect(resolveProvider()).toBe("openai")
  })

  it("treats whitespace-only AI_PROVIDER as unset", () => {
    setEnv("AI_PROVIDER", "   ")
    expect(resolveProvider()).toBe("groq")
  })
})

describe("resolveAIModel", () => {
  const defaultFeature = { id: "test-feature" }

  it("returns groq default model when no env vars set", () => {
    expect(resolveAIModel(defaultFeature)).toBe("llama-3.3-70b-versatile")
  })

  it("returns AI_MODEL env var when explicitly set", () => {
    setEnv("AI_MODEL", "custom-model:latest")
    expect(resolveAIModel(defaultFeature)).toBe("custom-model:latest")
  })

  it("returns provider-specific default for groq", () => {
    setEnv("AI_PROVIDER", "groq")
    expect(resolveAIModel(defaultFeature)).toBe("llama-3.3-70b-versatile")
  })

  it("returns provider-specific default for cerebras", () => {
    setEnv("AI_PROVIDER", "cerebras")
    expect(resolveAIModel(defaultFeature)).toBe("llama-3.3-70b")
  })

  it("returns provider-specific default for openai", () => {
    setEnv("AI_PROVIDER", "openai")
    expect(resolveAIModel(defaultFeature)).toBe("gpt-4o-mini")
  })

  it("falls back to feature.model when no provider default", () => {
    setEnv("AI_PROVIDER", "custom")
    const feature = { id: "test-feature", model: "feature-specific-model" }
    expect(resolveAIModel(feature)).toBe("feature-specific-model")
  })

  it("gives AI_MODEL priority over provider-specific default", () => {
    setEnv("AI_PROVIDER", "groq")
    setEnv("AI_MODEL", "override-model")
    expect(resolveAIModel(defaultFeature)).toBe("override-model")
  })
})

describe("resolveProviderConfig", () => {
  const defaultFeature = { id: "test-feature" }

  it("returns groq config by default", () => {
    setEnv("AI_API_KEY", "groq-key-123")
    const config = resolveProviderConfig(defaultFeature)
    expect(config).toEqual({
      provider: "groq",
      apiKey: "groq-key-123",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
    })
  })

  it("returns openai config with correct baseUrl", () => {
    setEnv("AI_PROVIDER", "openai")
    setEnv("AI_API_KEY", "openai-key-123")
    const config = resolveProviderConfig(defaultFeature)
    expect(config).toEqual({
      provider: "openai",
      apiKey: "openai-key-123",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    })
  })

  it("throws when no API key is provided", () => {
    expect(() => resolveProviderConfig(defaultFeature)).toThrow(
      'AI_API_KEY is required for provider "groq"'
    )
  })

  it("uses AI_BASE_URL override when set", () => {
    setEnv("AI_API_KEY", "groq-key-123")
    setEnv("AI_BASE_URL", "https://custom-proxy.example.com/v1")
    const config = resolveProviderConfig(defaultFeature)
    expect(config.baseUrl).toBe("https://custom-proxy.example.com/v1")
  })
})

describe("resolveAINumPredict", () => {
  it("returns default value 256", () => {
    expect(resolveAINumPredict()).toBe(256)
  })
})

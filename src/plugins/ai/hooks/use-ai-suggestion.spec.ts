/** @vitest-environment jsdom */

import { skipToken } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  useAIAnalyzeAnalytics,
  useAISuggestion,
} from "@/plugins/ai/hooks/use-ai-suggestion"
import { trpc } from "@/lib/trpc"

vi.mock("@/lib/trpc", () => ({
  trpc: {
    plugin: {
      ai: {
        checkAvailability: {
          useQuery: vi.fn(),
        },
        suggestSessionDescription: {
          useQuery: vi.fn(),
        },
        analyzeAnalytics: {
          useQuery: vi.fn(),
        },
      },
    },
  },
}))

type SuggestQueryState = {
  data?: unknown
  status: "pending" | "success" | "error"
  fetchStatus: "idle" | "fetching" | "paused"
  error: Error | null
}

describe("useAISuggestion", () => {
  let suggestState: SuggestQueryState
  let analyticsState: SuggestQueryState

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(trpc.plugin.ai.checkAvailability.useQuery).mockReturnValue({
      data: { available: true },
    } as ReturnType<typeof trpc.plugin.ai.checkAvailability.useQuery>)

    suggestState = {
      data: undefined,
      status: "pending",
      fetchStatus: "idle",
      error: null,
    }
    analyticsState = {
      data: undefined,
      status: "pending",
      fetchStatus: "idle",
      error: null,
    }

    vi.mocked(trpc.plugin.ai.suggestSessionDescription.useQuery).mockImplementation(
      (input) => {
        if (input === skipToken) {
          return {
            data: undefined,
            status: "pending",
            fetchStatus: "idle",
            error: null,
          } as ReturnType<typeof trpc.plugin.ai.suggestSessionDescription.useQuery>
        }

        return suggestState as ReturnType<
          typeof trpc.plugin.ai.suggestSessionDescription.useQuery
        >
      }
    )

    vi.mocked(trpc.plugin.ai.analyzeAnalytics.useQuery).mockImplementation((input) => {
      if (input === skipToken) {
        return {
          data: undefined,
          status: "pending",
          fetchStatus: "idle",
          error: null,
        } as ReturnType<typeof trpc.plugin.ai.analyzeAnalytics.useQuery>
      }

      return analyticsState as ReturnType<
        typeof trpc.plugin.ai.analyzeAnalytics.useQuery
      >
    })
  })

  it("exposes AI availability and streaming state", () => {
    const { result } = renderHook(() =>
      useAISuggestion({
        onComplete: vi.fn(),
      })
    )

    expect(result.current.isAvailable).toBe(true)
    expect(result.current.isPending).toBe(false)
    expect(result.current.isStreaming).toBe(false)
  })

  it("sets and clears query error", () => {
    const { result, rerender } = renderHook(() =>
      useAISuggestion({
        onComplete: vi.fn(),
      })
    )

    suggestState = {
      data: undefined,
      status: "pending",
      fetchStatus: "fetching",
      error: null,
    }

    act(() => {
      result.current.suggest({ sessionTitle: "Weekly Match" })
    })

    suggestState = {
      data: undefined,
      status: "error",
      fetchStatus: "idle",
      error: new Error("AI failed"),
    }
    rerender()

    expect(result.current.error).toBe("AI failed")

    act(() => {
      result.current.clearError()
    })
    expect(result.current.error).toBe("")
  })

  it("calls onComplete when stream transitions from fetching to idle with data", () => {
    const onComplete = vi.fn()
    const { result, rerender } = renderHook(() =>
      useAISuggestion({
        onComplete,
      })
    )

    suggestState = {
      data: [],
      status: "pending",
      fetchStatus: "fetching",
      error: null,
    }

    act(() => {
      result.current.suggest({ sessionTitle: "Session A" })
    })

    expect(result.current.isStreaming).toBe(true)

    suggestState = {
      data: ["Generated ", "description"],
      status: "success",
      fetchStatus: "idle",
      error: null,
    }
    rerender()

    expect(result.current.isStreaming).toBe(false)
    expect(onComplete).toHaveBeenCalledWith("Generated description")
  })

  it("handles analytics stream completion and invokes onComplete", () => {
    const onComplete = vi.fn()
    const { result, rerender } = renderHook(() =>
      useAIAnalyzeAnalytics({
        onComplete,
      })
    )

    analyticsState = {
      data: [],
      status: "pending",
      fetchStatus: "fetching",
      error: null,
    }

    act(() => {
      result.current.analyze({ days: "30" })
    })

    expect(result.current.isStreaming).toBe(true)

    analyticsState = {
      data: ["1) Insight", "\n2) Action"],
      status: "success",
      fetchStatus: "idle",
      error: null,
    }
    rerender()

    expect(result.current.isStreaming).toBe(false)
    expect(onComplete).toHaveBeenCalledWith("1) Insight\n2) Action")
  })

  it("exposes analytics query errors and allows clearing them", () => {
    const { result, rerender } = renderHook(() =>
      useAIAnalyzeAnalytics({
        onComplete: vi.fn(),
      })
    )

    analyticsState = {
      data: undefined,
      status: "pending",
      fetchStatus: "fetching",
      error: null,
    }

    act(() => {
      result.current.analyze({ days: "7" })
    })

    analyticsState = {
      data: undefined,
      status: "error",
      fetchStatus: "idle",
      error: new Error("Analytics AI failed"),
    }
    rerender()

    expect(result.current.error).toBe("Analytics AI failed")

    act(() => {
      result.current.clearError()
    })

    expect(result.current.error).toBe("")
  })
})

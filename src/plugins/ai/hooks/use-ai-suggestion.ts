import { useState, useEffect, useRef, useCallback } from "react"
import { skipToken } from "@tanstack/react-query"
import { trpc } from "@/lib/trpc"

type StreamingQueryResult = {
  data: unknown
  status: string
  fetchStatus: string
  error: { message: string } | null
}

function useStreamingCore(
  queryResult: StreamingQueryResult,
  onComplete: (text: string) => void,
  setInput: (v: typeof skipToken) => void
) {
  const [error, setError] = useState("")
  const prevFetchStatusRef = useRef<string>("idle")
  const { data, status, fetchStatus, error: queryError } = queryResult

  const streamedText =
    status === "success" && Array.isArray(data)
      ? (data as string[]).join("")
      : ""

  const isStreaming = fetchStatus === "fetching"

  useEffect(() => {
    if (queryError) {
      setError(queryError.message)
      setInput(skipToken)
    }
  }, [queryError, setInput])

  useEffect(() => {
    const wasFetching = prevFetchStatusRef.current === "fetching"
    prevFetchStatusRef.current = fetchStatus

    if (
      wasFetching &&
      fetchStatus === "idle" &&
      status === "success" &&
      streamedText
    ) {
      onComplete(streamedText)
      setInput(skipToken)
    }
  }, [fetchStatus, status, streamedText, onComplete, setInput])

  return {
    streamedText,
    isStreaming,
    isPending: isStreaming,
    error,
    clearError: () => setError(""),
    setError,
  }
}

// Original hook for session descriptions (backward compatible)
export function useAISuggestion(options: {
  feature?: "suggestSessionDescription"
  onComplete: (text: string) => void
}) {
  const { data: aiAvailability } = trpc.plugin.ai.checkAvailability.useQuery()
  const isAvailable = aiAvailability?.available === true

  type Input = {
    sessionTitle: string
    location?: string
    dateTime?: Date
  }

  const [input, setInput] = useState<Input | typeof skipToken>(skipToken)

  const queryResult = trpc.plugin.ai.suggestSessionDescription.useQuery(
    input === skipToken ? skipToken : input,
    { gcTime: 0, retry: false }
  )

  const core = useStreamingCore(queryResult, options.onComplete, setInput)

  const suggest = useCallback((params: Input) => {
    core.setError("")
    setInput(params)
  }, [core])

  return {
    suggest,
    streamedText: core.streamedText,
    isStreaming: core.isStreaming,
    isPending: core.isPending,
    error: core.error,
    clearError: core.clearError,
    isAvailable,
  }
}

// Hook for suggesting member notes
export function useAISuggestMemberNote(options: {
  onComplete: (text: string) => void
}) {
  const { data: aiAvailability } = trpc.plugin.ai.checkAvailability.useQuery()
  const isAvailable = aiAvailability?.available === true

  type Input = { targetUserId: string }

  const [input, setInput] = useState<Input | typeof skipToken>(skipToken)

  const queryResult = trpc.plugin.ai.suggestMemberNote.useQuery(
    input === skipToken ? skipToken : input,
    { gcTime: 0, retry: false }
  )

  const core = useStreamingCore(queryResult, options.onComplete, setInput)

  const suggest = useCallback((params: Input) => {
    core.setError("")
    setInput(params)
  }, [core])

  return {
    suggest,
    streamedText: core.streamedText,
    isStreaming: core.isStreaming,
    isPending: core.isPending,
    error: core.error,
    clearError: core.clearError,
    isAvailable,
  }
}

// Hook for summarizing join requests
export function useAISummarizeJoinRequest(options: {
  onComplete: (text: string) => void
}) {
  const { data: aiAvailability } = trpc.plugin.ai.checkAvailability.useQuery()
  const isAvailable = aiAvailability?.available === true

  type Input = { requestId: string }

  const [input, setInput] = useState<Input | typeof skipToken>(skipToken)

  const queryResult = trpc.plugin.ai.summarizeJoinRequest.useQuery(
    input === skipToken ? skipToken : input,
    { gcTime: 0, retry: false }
  )

  const core = useStreamingCore(queryResult, options.onComplete, setInput)

  const suggest = useCallback((params: Input) => {
    core.setError("")
    setInput(params)
  }, [core])

  return {
    suggest,
    streamedText: core.streamedText,
    isStreaming: core.isStreaming,
    isPending: core.isPending,
    error: core.error,
    clearError: core.clearError,
    isAvailable,
  }
}

// Hook for suggesting participation notes
export function useAISuggestParticipationNote(options: {
  onComplete: (text: string) => void
}) {
  const { data: aiAvailability } = trpc.plugin.ai.checkAvailability.useQuery()
  const isAvailable = aiAvailability?.available === true

  type Input = { participationId: string; sessionId: string }

  const [input, setInput] = useState<Input | typeof skipToken>(skipToken)

  const queryResult = trpc.plugin.ai.suggestParticipationNote.useQuery(
    input === skipToken ? skipToken : input,
    { gcTime: 0, retry: false }
  )

  const core = useStreamingCore(queryResult, options.onComplete, setInput)

  const suggest = useCallback((params: Input) => {
    core.setError("")
    setInput(params)
  }, [core])

  return {
    suggest,
    streamedText: core.streamedText,
    isStreaming: core.isStreaming,
    isPending: core.isPending,
    error: core.error,
    clearError: core.clearError,
    isAvailable,
  }
}

// Hook for summarizing member profiles
export function useAISummarizeMemberProfile(options: {
  onComplete: (text: string) => void
}) {
  const { data: aiAvailability } = trpc.plugin.ai.checkAvailability.useQuery()
  const isAvailable = aiAvailability?.available === true

  type Input = { userId: string }

  const [input, setInput] = useState<Input | typeof skipToken>(skipToken)

  const queryResult = trpc.plugin.ai.summarizeMemberProfile.useQuery(
    input === skipToken ? skipToken : input,
    { gcTime: 0, retry: false }
  )

  const core = useStreamingCore(queryResult, options.onComplete, setInput)

  const suggest = useCallback((params: Input) => {
    core.setError("")
    setInput(params)
  }, [core])

  return {
    suggest,
    streamedText: core.streamedText,
    isStreaming: core.isStreaming,
    isPending: core.isPending,
    error: core.error,
    clearError: core.clearError,
    isAvailable,
  }
}

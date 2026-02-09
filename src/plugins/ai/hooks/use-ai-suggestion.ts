import { useState, useEffect, useRef, useCallback } from "react"
import { skipToken } from "@tanstack/react-query"
import { trpc } from "@/lib/trpc"

type SuggestInput = {
  sessionTitle: string
  location?: string
  dateTime?: Date
}

export function useAISuggestion(options: {
  onComplete: (text: string) => void
}) {
  const [error, setError] = useState("")
  const [input, setInput] = useState<SuggestInput | typeof skipToken>(skipToken)
  const prevFetchStatusRef = useRef<string>("idle")

  const { data: aiAvailability } = trpc.plugin.ai.checkAvailability.useQuery()
  const isAvailable = aiAvailability?.available === true

  const { data, status, fetchStatus, error: queryError } = trpc.plugin.ai.suggestSessionDescription.useQuery(
    input === skipToken ? skipToken : input,
    {
      gcTime: 0,
      retry: false,
    }
  )

  const streamedText = status === "success" && Array.isArray(data)
    ? (data as string[]).join("")
    : ""

  const isStreaming = fetchStatus === "fetching"
  const isPending = isStreaming

  useEffect(() => {
    if (queryError) {
      setError(queryError.message)
      setInput(skipToken)
    }
  }, [queryError])

  useEffect(() => {
    const wasFetching = prevFetchStatusRef.current === "fetching"
    prevFetchStatusRef.current = fetchStatus

    if (wasFetching && fetchStatus === "idle" && status === "success" && streamedText) {
      options.onComplete(streamedText)
      setInput(skipToken)
    }
  }, [fetchStatus, status, streamedText, options])

  const suggest = useCallback((params: SuggestInput) => {
    setError("")
    setInput(params)
  }, [])

  return {
    suggest,
    streamedText,
    isStreaming,
    isPending,
    error,
    clearError: () => setError(""),
    isAvailable,
  }
}

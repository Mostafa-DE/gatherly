import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  RefreshCw,
  Loader2,
} from "lucide-react"
import {
  InsightCard,
  useIncrementalParse,
} from "@/components/ai-insights"
import { useAISuggestParticipationNote } from "@/plugins/ai/hooks/use-ai-suggestion"

// ─── localStorage cache ─────────────────────────────────────────────────────

function getCacheKey(participationId: string) {
  return `gatherly:ai-summary:${participationId}`
}

function getCachedSummary(participationId: string): string | null {
  try {
    return localStorage.getItem(getCacheKey(participationId))
  } catch {
    return null
  }
}

function setCachedSummary(participationId: string, text: string) {
  try {
    localStorage.setItem(getCacheKey(participationId), text)
  } catch {
    // Storage full or unavailable — ignore
  }
}

// ─── Main component ─────────────────────────────────────────────────────────

type AISummarySectionProps = {
  participationId: string
  sessionId: string
}

export function AINotesSection({
  participationId,
  sessionId,
}: AISummarySectionProps) {
  const [rawText, setRawText] = useState(() => getCachedSummary(participationId) ?? "")

  const onComplete = useCallback(
    (text: string) => {
      setRawText(text)
      setCachedSummary(participationId, text)
    },
    [participationId]
  )

  const {
    suggest: suggestNote,
    streamedText,
    isStreaming,
    isPending,
    error,
    isAvailable,
  } = useAISuggestParticipationNote({ onComplete })

  // Load cache when participationId changes
  useEffect(() => {
    setRawText(getCachedSummary(participationId) ?? "")
  }, [participationId])

  const insights = useIncrementalParse(streamedText, rawText, isStreaming)

  if (!isAvailable) return null

  const hasInsights = insights.length > 0
  const showEmpty = !hasInsights && !isPending

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            AI Summary
          </span>
          {hasInsights && (
            <span className="text-[10px] text-muted-foreground">
              {insights.length} insight{insights.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {hasInsights && !isStreaming ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs text-muted-foreground px-2"
            onClick={() => suggestNote({ participationId, sessionId })}
            disabled={isPending}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Refresh
          </Button>
        ) : showEmpty ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => suggestNote({ participationId, sessionId })}
            disabled={isPending}
          >
            <Sparkles className="mr-1.5 h-3 w-3" />
            Generate
          </Button>
        ) : null}
      </div>

      {/* Loading */}
      {isPending && !hasInsights && (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 p-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Analyzing participant history...
          </span>
        </div>
      )}

      {/* Insight cards */}
      {hasInsights && (
        <div className="space-y-2">
          {insights.map((insight) => (
            <InsightCard
              key={`${insight.category}-${insight.title}`}
              insight={insight}
              compact
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

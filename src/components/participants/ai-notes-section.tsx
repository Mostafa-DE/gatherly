import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  RefreshCw,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAISuggestParticipationNote } from "@/plugins/ai/hooks/use-ai-suggestion"

// ─── Types & parsing (same format as analytics insights) ────────────────────

type InsightCategory = "STRENGTH" | "CONCERN" | "ACTION" | "TREND"

type ParsedInsight = {
  category: InsightCategory
  title: string
  description: string
}

const VALID_CATEGORIES = new Set<string>(["STRENGTH", "CONCERN", "ACTION", "TREND"])

const CATEGORY_CONFIG: Record<
  InsightCategory,
  {
    label: string
    icon: typeof TrendingUp
    borderClass: string
    bgClass: string
    iconClass: string
    badgeClass: string
  }
> = {
  STRENGTH: {
    label: "Strength",
    icon: TrendingUp,
    borderClass: "border-l-[var(--color-status-success)]",
    bgClass: "bg-[var(--color-badge-success-bg)]",
    iconClass: "text-[var(--color-status-success)]",
    badgeClass: "bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)]",
  },
  CONCERN: {
    label: "Concern",
    icon: AlertTriangle,
    borderClass: "border-l-[var(--color-status-danger)]",
    bgClass: "bg-[var(--color-badge-danger-bg)]",
    iconClass: "text-[var(--color-status-danger)]",
    badgeClass: "bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)]",
  },
  ACTION: {
    label: "Action",
    icon: Lightbulb,
    borderClass: "border-l-primary",
    bgClass: "bg-[var(--color-badge-inactive-bg)]",
    iconClass: "text-primary",
    badgeClass: "bg-[var(--color-badge-inactive-bg)] text-primary",
  },
  TREND: {
    label: "Trend",
    icon: ArrowRight,
    borderClass: "border-l-[var(--color-status-warning)]",
    bgClass: "bg-[var(--color-badge-warning-bg)]",
    iconClass: "text-[var(--color-status-warning)]",
    badgeClass: "bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)]",
  },
}

function parseInsights(text: string): ParsedInsight[] {
  if (!text.trim()) return []
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  const insights: ParsedInsight[] = []
  for (const line of lines) {
    const match = line.match(/^\[(\w+)\]\s*(.+?)\s*\|\s*(.+)$/)
    if (!match) continue
    const [, rawCategory, title, description] = match
    const category = rawCategory.toUpperCase()
    if (!VALID_CATEGORIES.has(category)) continue
    insights.push({
      category: category as InsightCategory,
      title: title.trim(),
      description: description.trim(),
    })
  }
  return insights
}

function countNewlines(text: string): number {
  let c = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") c++
  }
  return c
}

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

// ─── Insight card ───────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: ParsedInsight }) {
  const config = CATEGORY_CONFIG[insight.category]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 border-l-[3px] p-3",
        config.borderClass,
        config.bgClass
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            config.badgeClass
          )}
        >
          <Icon className={cn("h-3 w-3", config.iconClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={cn(
                "inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                config.badgeClass
              )}
            >
              {config.label}
            </span>
            <h4 className="text-xs font-semibold leading-snug">
              {insight.title}
            </h4>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Incremental parse hook ─────────────────────────────────────────────────

function useIncrementalParse(
  streamedText: string,
  rawText: string,
  isStreaming: boolean
): ParsedInsight[] {
  const displayText = isStreaming ? streamedText : rawText
  const insightsRef = useRef<ParsedInsight[]>([])
  const prevLineCountRef = useRef(-1)
  const prevRawTextRef = useRef(rawText)

  const lineCount = countNewlines(displayText)
  const rawTextChanged = rawText !== prevRawTextRef.current
  const lineCountChanged = lineCount !== prevLineCountRef.current

  if (lineCountChanged || rawTextChanged) {
    prevLineCountRef.current = lineCount
    prevRawTextRef.current = rawText
    insightsRef.current = parseInsights(displayText)
  }

  return insightsRef.current
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
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

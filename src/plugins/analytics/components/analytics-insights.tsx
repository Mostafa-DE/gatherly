import { memo, useState, useEffect, useRef } from "react"
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TimeRange } from "@/plugins/analytics/types"

// ─── Types ───────────────────────────────────────────────────────────────────

type InsightCategory = "STRENGTH" | "CONCERN" | "ACTION" | "TREND"

type ParsedInsight = {
  category: InsightCategory
  title: string
  description: string
}

// ─── Category config ─────────────────────────────────────────────────────────

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
    bgClass: "bg-[var(--color-status-success)]/5",
    iconClass: "text-[var(--color-status-success)]",
    badgeClass:
      "bg-[var(--color-status-success)]/10 text-[var(--color-status-success)]",
  },
  CONCERN: {
    label: "Concern",
    icon: AlertTriangle,
    borderClass: "border-l-[var(--color-status-danger)]",
    bgClass: "bg-[var(--color-status-danger)]/5",
    iconClass: "text-[var(--color-status-danger)]",
    badgeClass:
      "bg-[var(--color-status-danger)]/10 text-[var(--color-status-danger)]",
  },
  ACTION: {
    label: "Action",
    icon: Lightbulb,
    borderClass: "border-l-primary",
    bgClass: "bg-primary/5",
    iconClass: "text-primary",
    badgeClass: "bg-primary/10 text-primary",
  },
  TREND: {
    label: "Trend",
    icon: ArrowRight,
    borderClass: "border-l-[var(--color-chart-2)]",
    bgClass: "bg-[var(--color-chart-2)]/5",
    iconClass: "text-[var(--color-chart-2)]",
    badgeClass: "bg-[var(--color-chart-2)]/10 text-[var(--color-chart-2)]",
  },
}

// ─── Parser ──────────────────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<string>([
  "STRENGTH",
  "CONCERN",
  "ACTION",
  "TREND",
])

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

/** Count newlines — used as a cheap proxy for "a new complete line appeared". */
function countNewlines(text: string): number {
  let c = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") c++
  }
  return c
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Parse insights only when the number of complete lines changes
 * (i.e. a new \n appears), not on every streaming token.
 */
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

  // Re-parse only when:
  // 1. A new complete line appeared during streaming (lineCount changed)
  // 2. rawText changed (cache load or streaming completed)
  const rawTextChanged = rawText !== prevRawTextRef.current
  const lineCountChanged = lineCount !== prevLineCountRef.current

  if (lineCountChanged || rawTextChanged) {
    prevLineCountRef.current = lineCount
    prevRawTextRef.current = rawText
    insightsRef.current = parseInsights(displayText)
  }

  return insightsRef.current
}

// ─── Insight card (memoized — won't re-render on parent token updates) ──────

const InsightCard = memo(function InsightCard({
  insight,
  staggerIndex,
}: {
  insight: ParsedInsight
  staggerIndex: number
}) {
  const config = CATEGORY_CONFIG[insight.category]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 border-l-[3px] p-4 transition-colors",
        config.borderClass,
        config.bgClass
      )}
      style={{
        animation: "insight-slide-in 0.35s ease-out both",
        animationDelay: `${staggerIndex * 80}ms`,
      }}
    >
      <div className="mb-2 flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            config.badgeClass
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", config.iconClass)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                config.badgeClass
              )}
            >
              {config.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-snug">
            {insight.title}
          </h3>
        </div>
      </div>
      <p className="pl-10 text-sm leading-relaxed text-muted-foreground">
        {insight.description}
      </p>
    </div>
  )
})

// ─── Typing indicator (owns its own rotating message — isolated state) ──────

const LOADING_MESSAGES = [
  "Preparing your data...",
  "Analyzing group health...",
  "Reviewing session performance...",
  "Examining attendance patterns...",
  "Crunching revenue numbers...",
  "Spotting trends and patterns...",
  "Generating recommendations...",
]

function TypingIndicator() {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      )
    }, 2800)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-border/50 border-l-[3px] border-l-primary/40 bg-primary/[0.02] p-4"
      style={{
        animation: "insight-slide-in 0.35s ease-out both",
      }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      </div>
      <span className="text-sm text-muted-foreground">
        {LOADING_MESSAGES[msgIndex]}
      </span>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({
  onGenerate,
  disabled,
}: {
  onGenerate: () => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <p className="mb-1 text-sm font-medium">Get AI-powered insights</p>
      <p className="mb-4 max-w-xs text-xs text-muted-foreground">
        Analyze your group health, attendance, sessions, and revenue data to
        surface what matters most.
      </p>
      <Button size="sm" onClick={onGenerate} disabled={disabled}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
        Generate Insights
      </Button>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AnalyticsInsights({
  days,
  rawText,
  streamedText,
  isStreaming,
  isPending,
  error,
  isAvailable,
  onGenerate,
}: {
  days: TimeRange
  rawText: string
  streamedText: string
  isStreaming: boolean
  isPending: boolean
  error: string
  isAvailable: boolean
  onGenerate: (days: TimeRange) => void
}) {
  // Track how many insights were visible before streaming started so we can
  // stagger only newly-appearing cards during a stream.
  const prevCountRef = useRef(0)

  // Only re-parses when a new complete line appears, not on every token.
  const insights = useIncrementalParse(streamedText, rawText, isStreaming)

  // Reset stagger baseline when a new generation starts
  const wasStreamingRef = useRef(false)
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      prevCountRef.current = 0
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  // Update baseline when streaming ends
  useEffect(() => {
    if (!isStreaming) {
      prevCountRef.current = insights.length
    }
  }, [isStreaming, insights.length])

  if (!isAvailable) return null

  const hasInsights = insights.length > 0
  const showEmpty = !hasInsights && !isPending

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">AI Insights</h2>
            <p className="text-xs text-muted-foreground">
              {hasInsights
                ? `${insights.length} insight${insights.length !== 1 ? "s" : ""} found`
                : isPending
                  ? "Analyzing your data..."
                  : "Analyze your analytics data"}
            </p>
          </div>
        </div>
        {hasInsights && !isStreaming && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onGenerate(days)}
            disabled={isPending}
            className="text-muted-foreground"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        )}
      </div>

      {/* Insight cards — appear progressively during streaming */}
      {hasInsights && (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <InsightCard
              key={`${insight.category}-${insight.title}`}
              insight={insight}
              staggerIndex={
                isStreaming ? 0 : i < prevCountRef.current ? 0 : i
              }
            />
          ))}
        </div>
      )}

      {/* Typing indicator — self-contained, owns its own rotating message */}
      {isPending && (
        <div className={hasInsights ? "mt-3" : ""}>
          <TypingIndicator />
        </div>
      )}

      {/* Empty / initial state */}
      {showEmpty && (
        <EmptyState
          onGenerate={() => onGenerate(days)}
          disabled={isPending}
        />
      )}

      {/* Error */}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  )
}

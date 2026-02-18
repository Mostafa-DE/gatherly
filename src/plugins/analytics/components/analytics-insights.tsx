import { InsightsPanel } from "@/components/ai-insights"
import type { TimeRange } from "@/plugins/analytics/types"

const ANALYTICS_LOADING_MESSAGES = [
  "Preparing your data...",
  "Analyzing group health...",
  "Reviewing session performance...",
  "Examining attendance patterns...",
  "Crunching revenue numbers...",
  "Spotting trends and patterns...",
  "Generating recommendations...",
]

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
  return (
    <InsightsPanel
      title="AI Insights"
      emptyTitle="Get AI-powered insights"
      emptyDescription="Analyze your group health, attendance, sessions, and revenue data to surface what matters most."
      loadingMessages={ANALYTICS_LOADING_MESSAGES}
      rawText={rawText}
      streamedText={streamedText}
      isStreaming={isStreaming}
      isPending={isPending}
      error={error}
      isAvailable={isAvailable}
      onGenerate={() => onGenerate(days)}
    />
  )
}

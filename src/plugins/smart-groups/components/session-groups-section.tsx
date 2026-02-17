import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid } from "lucide-react"
import { GenerateGroupsDialog } from "./generate-groups-dialog"
import { GroupReviewPanel } from "./group-review-panel"

type SessionGroupsSectionProps = {
  activityId: string
  sessionId: string
  isAdmin: boolean
  participantCount: number
}

export function SessionGroupsSection({
  activityId,
  sessionId,
  isAdmin,
  participantCount,
}: SessionGroupsSectionProps) {
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)

  const { data: config, isLoading: configLoading } =
    trpc.plugin.smartGroups.getConfigByActivity.useQuery({ activityId })

  const { data: runData, isLoading: runLoading } =
    trpc.plugin.smartGroups.getRunBySession.useQuery(
      { sessionId },
      { enabled: !!config }
    )

  const { data: runDetails } = trpc.plugin.smartGroups.getRunDetails.useQuery(
    { runId: runData?.id ?? "" },
    { enabled: !!runData?.id }
  )

  const utils = trpc.useUtils()

  if (configLoading) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    )
  }

  // No config = plugin not configured for this activity
  if (!config) return null

  const hasRun = !!runData
  const groupCount = runData?.groupCount ?? 0

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Groups</h3>
          {hasRun && groupCount > 0 && (
            <Badge variant="secondary" className="text-xs tabular-nums">
              {groupCount}
            </Badge>
          )}
        </div>
        {isAdmin && !hasRun && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGenerateDialog(true)}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
            Generate Groups
          </Button>
        )}
      </div>

      {runLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : runDetails ? (
        <GroupReviewPanel
          run={runDetails.run}
          proposals={runDetails.proposals}
          entries={runDetails.entries}
          isAdmin={isAdmin}
          onRegenerate={() => setShowGenerateDialog(true)}
        />
      ) : (
        <p className="text-sm text-muted-foreground py-2">
          No groups generated yet.{isAdmin ? " Click Generate Groups to get started." : ""}
        </p>
      )}

      {showGenerateDialog && (
        <GenerateGroupsDialog
          configId={config.id}
          activityId={activityId}
          scope="session"
          sessionId={sessionId}
          participantCount={participantCount}
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          onSuccess={() => {
            utils.plugin.smartGroups.getRunBySession.invalidate({ sessionId })
          }}
        />
      )}
    </div>
  )
}

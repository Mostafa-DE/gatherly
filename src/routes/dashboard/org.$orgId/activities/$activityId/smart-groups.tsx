import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, LayoutGrid, XCircle } from "lucide-react"
import { GenerateGroupsDialog } from "@/plugins/smart-groups/components/generate-groups-dialog"
import { GroupReviewPanel } from "@/plugins/smart-groups/components/group-review-panel"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/activities/$activityId/smart-groups"
)({
  component: SmartGroupsPage,
})

function SmartGroupsPage() {
  const { orgId, activityId } = Route.useParams()
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: activityData, isLoading: activityLoading } = trpc.activity.getById.useQuery(
    { activityId },
    { enabled: isAdmin }
  )

  const { data: config, isLoading: configLoading } =
    trpc.plugin.smartGroups.getConfigByActivity.useQuery(
      { activityId },
      { enabled: isAdmin }
    )

  const { data: members } = trpc.activityMembership.members.useQuery(
    { activityId },
    { enabled: isAdmin }
  )

  const memberCount = members?.length ?? 0

  const { data: runs, isLoading: runsLoading } =
    trpc.plugin.smartGroups.getRunsByActivity.useQuery(
      { configId: config?.id ?? "", limit: 20, offset: 0 },
      { enabled: !!config?.id }
    )

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const { data: runDetails } = trpc.plugin.smartGroups.getRunDetails.useQuery(
    { runId: selectedRunId ?? "" },
    { enabled: !!selectedRunId }
  )

  if (whoamiLoading || activityLoading || configLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Only group owners and admins can access smart groups.
        </p>
        <Button asChild>
          <Link
            to="/dashboard/org/$orgId/activities/$activityId"
            params={{ orgId, activityId }}
          >
            Back to Activity
          </Link>
        </Button>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link
              to="/dashboard/org/$orgId/activities/$activityId"
              params={{ orgId, activityId }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Smart Groups</h1>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 text-center">
          <p className="text-muted-foreground">
            Smart Groups is not configured for this activity. Go to activity settings to set it up.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link
            to="/dashboard/org/$orgId/activities/$activityId"
            params={{ orgId, activityId }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Smart Groups</h1>
        </div>
      </div>

      {/* Config summary */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{config.name}</h2>
            <p className="text-sm text-muted-foreground">
              {activityData?.name} &middot; {memberCount} members
            </p>
          </div>
          <Button onClick={() => setShowGenerateDialog(true)}>
            <LayoutGrid className="h-4 w-4 mr-2" />
            Generate Groups
          </Button>
        </div>
      </div>

      {/* Run details (if selected) */}
      {selectedRunId && runDetails && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Run Details</h2>
            <Button variant="ghost" size="sm" onClick={() => setSelectedRunId(null)}>
              Back to list
            </Button>
          </div>
          <GroupReviewPanel
            run={runDetails.run}
            proposals={runDetails.proposals}
            entries={runDetails.entries}
            isAdmin={isAdmin}
            onRegenerate={() => setShowGenerateDialog(true)}
          />
        </div>
      )}

      {/* Runs list (when no run selected) */}
      {!selectedRunId && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <h2 className="font-semibold mb-4">Past Runs</h2>
          {runsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-lg" />
              <Skeleton className="h-12 rounded-lg" />
            </div>
          ) : !runs || runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No runs yet. Click &quot;Generate Groups&quot; to create the first run.
            </p>
          ) : (
            <div className="space-y-2">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {run.groupCount} groups &middot; {run.entryCount} members
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.scope === "session" ? "Session" : "Activity"} &middot;{" "}
                      {new Date(run.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant={run.status === "confirmed" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {run.status === "confirmed" ? "Confirmed" : "Draft"}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showGenerateDialog && (
        <GenerateGroupsDialog
          configId={config.id}
          activityId={activityId}
          scope="activity"
          participantCount={memberCount}
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          onSuccess={() => {
            utils.plugin.smartGroups.getRunsByActivity.invalidate({
              configId: config.id,
            })
          }}
        />
      )}
    </div>
  )
}

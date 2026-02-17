import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutGrid } from "lucide-react"

type SmartGroupsSectionProps = {
  activityId: string
  activity: {
    enabledPlugins: unknown
    name: string
  }
}

export function SmartGroupsSection({ activityId, activity }: SmartGroupsSectionProps) {
  const enabledPlugins = (activity.enabledPlugins ?? {}) as Record<string, boolean>
  const smartGroupsEnabled = enabledPlugins["smart-groups"] === true

  if (!smartGroupsEnabled) return null

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <LayoutGrid className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Smart Groups</h2>
          <p className="text-sm text-muted-foreground">
            Organize members into groups by attributes
          </p>
        </div>
      </div>

      <SmartGroupsContent activityId={activityId} activityName={activity.name} />
    </div>
  )
}

function SmartGroupsContent({
  activityId,
  activityName,
}: {
  activityId: string
  activityName: string
}) {
  const { data: config, isLoading } =
    trpc.plugin.smartGroups.getConfigByActivity.useQuery({ activityId })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    )
  }

  if (!config) {
    return <SmartGroupsSetup activityId={activityId} activityName={activityName} />
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 bg-background/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{config.name}</p>
            <p className="text-xs text-muted-foreground">
              Created {new Date(config.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Generate groups from session detail pages or the per-activity groups page.
      </p>
    </div>
  )
}

function SmartGroupsSetup({
  activityId,
  activityName,
}: {
  activityId: string
  activityName: string
}) {
  const utils = trpc.useUtils()
  const [name, setName] = useState(`${activityName} Groups`)
  const [error, setError] = useState("")

  const createConfig = trpc.plugin.smartGroups.createConfig.useMutation({
    onSuccess: () => {
      utils.plugin.smartGroups.getConfigByActivity.invalidate({ activityId })
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set up Smart Groups to organize members by form field values.
      </p>
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="sg-name">Config Name</Label>
        <Input
          id="sg-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Tennis Groups"
          className="bg-popover"
        />
      </div>
      <Button
        onClick={() => createConfig.mutate({ activityId, name: name.trim() })}
        disabled={!name.trim() || createConfig.isPending}
      >
        {createConfig.isPending ? "Creating..." : "Create Smart Groups"}
      </Button>
    </div>
  )
}

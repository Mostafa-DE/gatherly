import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Layers,
  Plus,
  ChevronRight,
} from "lucide-react"
import type { ActivityJoinMode } from "@/schemas/activity"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/dashboard/org/$orgId/activities/")({
  component: ActivitiesPage,
})

type CreateFormData = {
  name: string
  slug: string
  joinMode: ActivityJoinMode
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

const JOIN_MODE_LABELS: Record<string, string> = {
  open: "Open",
  require_approval: "Approval",
  invite: "Invite Only",
}

const JOIN_MODE_BADGE_CLASSES: Record<string, string> = {
  open: "bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)]",
  require_approval: "bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)]",
  invite: "bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)]",
}

function ActivitiesPage() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()
  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const [showInactive, setShowInactive] = useState(false)
  const { data: activities, isLoading } = trpc.activity.listWithMemberCount.useQuery(
    { includeInactive: showInactive }
  )

  const [creatingActivity, setCreatingActivity] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormData>({ name: "", slug: "", joinMode: "open" })
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [error, setError] = useState("")

  const createActivity = trpc.activity.create.useMutation({
    onSuccess: () => {
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setCreatingActivity(false)
      resetCreateForm()
    },
    onError: (err) => setError(err.message),
  })

  function resetCreateForm() {
    setCreateForm({ name: "", slug: "", joinMode: "open" })
    setSlugManuallyEdited(false)
    setError("")
  }

  function openCreate() {
    resetCreateForm()
    setCreatingActivity(true)
  }

  function handleCreateNameChange(name: string) {
    setCreateForm((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEdited ? prev.slug : slugify(name),
    }))
  }

  function handleSubmitCreate() {
    setError("")
    if (!createForm.name.trim()) {
      setError("Name is required")
      return
    }
    if (!createForm.slug.trim()) {
      setError("Slug is required")
      return
    }
    createActivity.mutate(createForm)
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl space-y-8 py-8 px-4">
        <p className="text-muted-foreground">You do not have permission to manage activities.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-8 px-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Activities</h1>
            <p className="text-sm text-muted-foreground">
              Manage sub-group activities within your organization
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </Button>
      </div>

      {/* Show Inactive Toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="show-inactive"
          checked={showInactive}
          onCheckedChange={setShowInactive}
        />
        <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
          Show deactivated
        </Label>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Activity List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : activities && activities.length > 0 ? (
        <div className="space-y-2">
          {activities.map((a) => (
            <Link
              key={a.id}
              to="/dashboard/org/$orgId/activities/$activityId"
              params={{ orgId, activityId: a.id }}
              className={cn(
                "flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4 transition-colors hover:border-primary/50",
                !a.isActive && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold shrink-0",
                  a.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {a.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{a.name}</p>
                    {!a.isActive && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>/{a.slug}</span>
                    <span>{a.memberCount} member{a.memberCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={`border-0 text-xs ${JOIN_MODE_BADGE_CLASSES[a.joinMode] ?? ""}`}>
                  {JOIN_MODE_LABELS[a.joinMode] ?? a.joinMode}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No activities found
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={creatingActivity} onOpenChange={(open) => { if (!open) { setCreatingActivity(false); resetCreateForm() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Activity</DialogTitle>
            <DialogDescription>
              Add a new activity to your organization
            </DialogDescription>
          </DialogHeader>
          <CreateActivityForm
            formData={createForm}
            onNameChange={handleCreateNameChange}
            onSlugChange={(slug) => { setSlugManuallyEdited(true); setCreateForm((prev) => ({ ...prev, slug })) }}
            onJoinModeChange={(joinMode) => setCreateForm((prev) => ({ ...prev, joinMode }))}
            error={error}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreatingActivity(false); resetCreateForm() }}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createActivity.isPending}>
              {createActivity.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateActivityForm({
  formData,
  onNameChange,
  onSlugChange,
  onJoinModeChange,
  error,
}: {
  formData: CreateFormData
  onNameChange: (name: string) => void
  onSlugChange: (slug: string) => void
  onJoinModeChange: (joinMode: ActivityJoinMode) => void
  error: string
}) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="activity-name">Name</Label>
        <Input
          id="activity-name"
          value={formData.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Padel, Tennis, Running"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="activity-slug">Slug</Label>
        <Input
          id="activity-slug"
          value={formData.slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder="e.g. padel"
        />
        <p className="text-xs text-muted-foreground">
          URL-friendly identifier (lowercase, hyphens only)
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="activity-join-mode">Join Mode</Label>
        <Select value={formData.joinMode} onValueChange={(v) => onJoinModeChange(v as ActivityJoinMode)}>
          <SelectTrigger id="activity-join-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open - Anyone can join</SelectItem>
            <SelectItem value="require_approval">Approval Required - Admins approve requests</SelectItem>
            <SelectItem value="invite">Invite Only - Only admins can add members</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

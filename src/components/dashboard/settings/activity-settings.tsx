import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Pencil, Users, UserPlus, X, PowerOff, Power } from "lucide-react"
import type { ActivityJoinMode } from "@/schemas/activity"

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

export function ActivitySettings(_props: { orgId: string }) {
  const utils = trpc.useUtils()

  const { data: activities, isLoading } = trpc.activity.listWithMemberCount.useQuery({ includeInactive: true })
  const [renamingActivity, setRenamingActivity] = useState<{ id: string; name: string } | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [creatingActivity, setCreatingActivity] = useState(false)
  const [deactivatingActivityId, setDeactivatingActivityId] = useState<string | null>(null)
  const [managingMembersActivityId, setManagingMembersActivityId] = useState<string | null>(null)
  const [formData, setFormData] = useState<CreateFormData>({ name: "", slug: "", joinMode: "open" })
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [error, setError] = useState("")

  const createActivity = trpc.activity.create.useMutation({
    onSuccess: () => {
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setCreatingActivity(false)
      resetForm()
    },
    onError: (err: { message: string }) => setError(err.message),
  })

  const updateActivity = trpc.activity.update.useMutation({
    onSuccess: () => {
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setRenamingActivity(null)
      setRenameValue("")
    },
    onError: (err: { message: string }) => setError(err.message),
  })

  const deactivateActivity = trpc.activity.deactivate.useMutation({
    onSuccess: () => {
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setDeactivatingActivityId(null)
    },
    onError: (err: { message: string }) => setError(err.message),
  })

  const reactivateActivity = trpc.activity.reactivate.useMutation({
    onSuccess: () => {
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
    },
    onError: (err: { message: string }) => setError(err.message),
  })

  function resetForm() {
    setFormData({ name: "", slug: "", joinMode: "open" })
    setSlugManuallyEdited(false)
    setError("")
  }

  function openCreate() {
    resetForm()
    setCreatingActivity(true)
  }

  function openRename(a: { id: string; name: string }) {
    setRenameValue(a.name)
    setRenamingActivity(a)
    setError("")
  }

  function handleNameChange(name: string) {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEdited ? prev.slug : slugify(name),
    }))
  }

  function handleSubmitCreate() {
    setError("")
    if (!formData.name.trim()) {
      setError("Name is required")
      return
    }
    if (!formData.slug.trim()) {
      setError("Slug is required")
      return
    }
    createActivity.mutate(formData)
  }

  function handleSubmitRename() {
    if (!renamingActivity) return
    setError("")
    if (!renameValue.trim()) {
      setError("Name is required")
      return
    }
    updateActivity.mutate({
      activityId: renamingActivity.id,
      name: renameValue,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    )
  }

  const activeCount = activities?.filter((a) => a.isActive).length ?? 0
  const deactivatingName = activities?.find((a) => a.id === deactivatingActivityId)?.name ?? ""

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {activities && activities.length > 0 ? (
        <div className="space-y-2">
          {activities.map((a) => (
            <div
              key={a.id}
              className={`flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-3 ${!a.isActive ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shrink-0 ${a.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Manage members"
                  onClick={() => setManagingMembersActivityId(a.id)}
                >
                  <Users className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Rename"
                  onClick={() => openRename(a)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {a.isActive ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    title="Deactivate"
                    disabled={activeCount <= 1}
                    onClick={() => setDeactivatingActivityId(a.id)}
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Reactivate"
                    disabled={reactivateActivity.isPending}
                    onClick={() => reactivateActivity.mutate({ activityId: a.id })}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No activities found
        </div>
      )}

      <Button variant="outline" onClick={openCreate} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Add Activity
      </Button>

      {/* Create Dialog */}
      <Dialog open={creatingActivity} onOpenChange={(open) => { if (!open) { setCreatingActivity(false); resetForm() } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Activity</DialogTitle>
            <DialogDescription>
              Add a new activity to your organization
            </DialogDescription>
          </DialogHeader>
          <ActivityForm
            formData={formData}
            onNameChange={handleNameChange}
            onSlugChange={(slug) => { setSlugManuallyEdited(true); setFormData((prev) => ({ ...prev, slug })) }}
            onJoinModeChange={(joinMode) => setFormData((prev) => ({ ...prev, joinMode }))}
            error={error}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreatingActivity(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCreate} disabled={createActivity.isPending}>
              {createActivity.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renamingActivity !== null} onOpenChange={(open) => { if (!open) { setRenamingActivity(null); setRenameValue(""); setError("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Activity</DialogTitle>
            <DialogDescription>
              Update the activity name
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rename-activity">Name</Label>
              <Input
                id="rename-activity"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Activity name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRenamingActivity(null); setRenameValue(""); setError("") }}>
              Cancel
            </Button>
            <Button onClick={handleSubmitRename} disabled={updateActivity.isPending}>
              {updateActivity.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={deactivatingActivityId !== null} onOpenChange={(open: boolean) => { if (!open) setDeactivatingActivityId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate &quot;{deactivatingName}&quot;? Deactivated
              activities cannot accept new sessions or members. Existing data will be preserved.
              You can reactivate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deactivatingActivityId) {
                  deactivateActivity.mutate({ activityId: deactivatingActivityId })
                }
              }}
            >
              {deactivateActivity.isPending ? "Deactivating..." : "Deactivate Activity"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Members Management Dialog */}
      {managingMembersActivityId && (
        <ActivityMembersDialog
          activityId={managingMembersActivityId}
          activityName={activities?.find((a) => a.id === managingMembersActivityId)?.name ?? ""}
          open={true}
          onOpenChange={(open) => { if (!open) setManagingMembersActivityId(null) }}
        />
      )}
    </div>
  )
}

function ActivityForm({
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

function ActivityMembersDialog({
  activityId,
  activityName,
  open,
  onOpenChange,
}: {
  activityId: string
  activityName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const utils = trpc.useUtils()
  const [showAddMember, setShowAddMember] = useState(false)
  const [addError, setAddError] = useState("")

  const { data: members, isLoading: membersLoading } = trpc.activityMembership.members.useQuery(
    { activityId },
    { enabled: open }
  )

  const { data: orgMembers } = trpc.organization.listMembers.useQuery(
    undefined,
    { enabled: open && showAddMember }
  )

  const addMember = trpc.activityMembership.adminAdd.useMutation({
    onSuccess: () => {
      utils.activityMembership.members.invalidate({ activityId })
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
      setAddError("")
      setShowAddMember(false)
    },
    onError: (err: { message: string }) => setAddError(err.message),
  })

  const removeMember = trpc.activityMembership.remove.useMutation({
    onSuccess: () => {
      utils.activityMembership.members.invalidate({ activityId })
      utils.activity.listWithMemberCount.invalidate()
      utils.activity.list.invalidate()
    },
  })

  // Filter org members who are NOT already activity members
  const activityMemberIds = new Set(members?.map(({ member: m }) => m.userId) ?? [])
  const availableOrgMembers = orgMembers?.filter(
    ({ user }) => !activityMemberIds.has(user.id)
  ) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Members - {activityName}
          </DialogTitle>
          <DialogDescription>
            Manage members of this activity
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {addError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {addError}
            </div>
          )}

          {membersLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 p-2">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-2.5 w-32 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-1">
              {members.map(({ member: m, user: u }) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={u.image ?? undefined} alt={u.name} />
                    <AvatarFallback className="text-xs">
                      {u.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMember.mutate({ activityId, userId: m.userId })}
                    disabled={removeMember.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No members yet
            </p>
          )}

          {showAddMember ? (
            <div className="space-y-2 border-t border-border/50 pt-3">
              <Label className="text-sm font-medium">Add Org Member</Label>
              {availableOrgMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  All org members are already in this activity
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {availableOrgMembers.map(({ user }) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => addMember.mutate({ activityId, userId: user.id })}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.image ?? undefined} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAddMember(false)}
              >
                Done
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAddMember(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

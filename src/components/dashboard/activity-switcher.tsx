import { useState, useRef, useEffect } from "react"
import { useParams } from "@tanstack/react-router"
import {
  ChevronsUpDown,
  Layers,
  Check,
  LogIn,
  Clock,
  UserPlus,
  Search,
  ChevronDown,
} from "lucide-react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { useActivityContext } from "@/hooks/use-activity-context"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JoinFormField } from "@/components/join-form-field"
import type { FormField } from "@/types/form"
import { cn } from "@/lib/utils"

function useActivitySwitcherState(orgId: string) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [confirmJoinActivityId, setConfirmJoinActivityId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const { activities, isMultiActivity, selectedActivityId, setSelectedActivity } =
    useActivityContext(orgId)
  const utils = trpc.useUtils()
  const { data: whoami } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const joinActivity = trpc.activityMembership.join.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate()
      toast.success("Joined activity")
    },
    onError: (err) => toast.error(err.message),
  })
  const requestJoinActivity = trpc.activityMembership.requestJoin.useMutation({
    onSuccess: () => {
      utils.activity.list.invalidate()
      utils.activityMembership.countAllPendingRequests.invalidate()
      toast.success("Join request sent")
    },
    onError: (err) => toast.error(err.message),
  })

  const selectedActivity = activities.find((a) => a.id === selectedActivityId)
  const showSearch = activities.length >= 5
  const filteredActivities = search
    ? activities.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : activities

  const isMutating = joinActivity.isPending || requestJoinActivity.isPending

  // Auto-focus search input when opened
  useEffect(() => {
    if (open && showSearch) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open, showSearch])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setSearch("")
  }

  return {
    open,
    setOpen,
    search,
    setSearch,
    searchInputRef,
    confirmJoinActivityId,
    setConfirmJoinActivityId,
    activities,
    isMultiActivity,
    selectedActivityId,
    setSelectedActivity,
    selectedActivity,
    showSearch,
    filteredActivities,
    isAdmin,
    isMutating,
    joinActivity,
    requestJoinActivity,
    handleOpenChange,
  }
}

function formatActivityLabel(activityName?: string | null) {
  if (!activityName) return "All Activities"
  return /activity$/i.test(activityName)
    ? activityName
    : `${activityName} Activity`
}

type ActivityListProps = {
  showSearch: boolean
  searchInputRef: React.RefObject<HTMLInputElement | null>
  search: string
  setSearch: (v: string) => void
  selectedActivityId: string | null
  filteredActivities: ReturnType<typeof useActivityContext>["activities"]
  isAdmin: boolean
  isMutating: boolean
  joinActivity: { mutate: (args: { activityId: string }) => void }
  requestJoinActivity: { mutate: (args: { activityId: string }) => void }
  setConfirmJoinActivityId: (id: string | null) => void
  onSelect: (id: string | null) => void
}

function ActivityList({
  showSearch,
  searchInputRef,
  search,
  setSearch,
  selectedActivityId,
  filteredActivities,
  isAdmin,
  isMutating,
  joinActivity,
  setConfirmJoinActivityId,
  onSelect,
}: ActivityListProps) {
  return (
    <div className="flex flex-col gap-1">
      {showSearch && (
        <div className="relative px-1 pb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pb-1" />
          <Input
            ref={searchInputRef}
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto flex flex-col gap-0.5 px-1">
        {/* All Activities option */}
        <button
          onClick={() => onSelect(null)}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm w-full text-left transition-colors cursor-pointer",
            selectedActivityId === null
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted"
          )}
        >
          <Layers className={cn(
            "size-4 shrink-0",
            selectedActivityId === null ? "text-primary" : "text-muted-foreground"
          )} />
          <span className="flex-1 truncate">All Activities</span>
          {selectedActivityId === null && (
            <Check className="size-4 text-primary shrink-0" />
          )}
        </button>

        {/* Activity items */}
        {filteredActivities.map((a) => {
          const isSelected = selectedActivityId === a.id
          const isMember = a.myMembershipStatus === "active"
          const hasPendingRequest = a.myJoinRequestStatus === "pending"
          const canJoin = !isAdmin && !isMember && !hasPendingRequest && a.joinMode === "open"
          const canRequest = !isAdmin && !isMember && !hasPendingRequest && a.joinMode === "require_approval"

          // Hide invite-only activities from non-admin non-members
          if (!isAdmin && !isMember && a.joinMode === "invite") {
            return null
          }

          // Selectable activity (member or admin)
          if (isMember || isAdmin) {
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm w-full text-left transition-colors cursor-pointer",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
              >
                <span className={cn(
                  "size-4 flex items-center justify-center rounded text-[10px] font-bold shrink-0",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {a.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 truncate">{a.name}</span>
                {isSelected && (
                  <Check className="size-4 text-primary shrink-0" />
                )}
              </button>
            )
          }

          // Joinable / request-to-join activity
          return (
            <button
              key={a.id}
              disabled={isMutating || hasPendingRequest}
              onClick={() => {
                if (hasPendingRequest) return
                if (canJoin) {
                  joinActivity.mutate({ activityId: a.id })
                } else if (canRequest) {
                  setConfirmJoinActivityId(a.id)
                }
              }}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm w-full text-left transition-colors",
                hasPendingRequest
                  ? "text-muted-foreground opacity-70 cursor-default"
                  : "cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <span className="size-4 flex items-center justify-center rounded text-[10px] font-bold shrink-0 bg-muted text-muted-foreground">
                {a.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{a.name}</span>
              {hasPendingRequest && <Clock className="size-4 text-muted-foreground shrink-0" />}
              {canJoin && <LogIn className="size-4 text-muted-foreground shrink-0" />}
              {canRequest && <UserPlus className="size-4 text-muted-foreground shrink-0" />}
            </button>
          )
        })}

        {filteredActivities.length === 0 && search && (
          <div className="px-2 py-4 text-sm text-muted-foreground text-center">
            No activities found
          </div>
        )}
      </div>
    </div>
  )
}

function JoinConfirmDialog({
  confirmJoinActivityId,
  setConfirmJoinActivityId,
  activities,
  requestJoinActivity,
}: {
  confirmJoinActivityId: string | null
  setConfirmJoinActivityId: (id: string | null) => void
  activities: ReturnType<typeof useActivityContext>["activities"]
  requestJoinActivity: { mutate: (args: { activityId: string; formAnswers?: Record<string, unknown> }) => void; isPending: boolean }
}) {
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({})
  const [formError, setFormError] = useState("")

  const confirmActivity = activities.find((a) => a.id === confirmJoinActivityId)
  const formFields = (confirmActivity?.joinFormSchema as { fields?: FormField[] } | null)?.fields || []
  const hasForm = formFields.length > 0

  const handleClose = () => {
    setConfirmJoinActivityId(null)
    setFormAnswers({})
    setFormError("")
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!confirmJoinActivityId) return

    // Validate required fields
    for (const field of formFields) {
      if (!field.required) continue
      const value = formAnswers[field.id]
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0)
      ) {
        setFormError(`"${field.label}" is required`)
        return
      }
    }

    const answers = Object.keys(formAnswers).length > 0 ? formAnswers : undefined
    requestJoinActivity.mutate({ activityId: confirmJoinActivityId, formAnswers: answers })
    handleClose()
  }

  if (hasForm) {
    return (
      <Dialog
        open={confirmJoinActivityId !== null}
        onOpenChange={(nextOpen) => { if (!nextOpen) handleClose() }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Request to Join {confirmActivity?.name}</DialogTitle>
              <DialogDescription>
                Please fill out the form below. Your request will be reviewed by an administrator.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {formError && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              {formFields.map((field) => (
                <JoinFormField
                  key={field.id}
                  field={field}
                  value={formAnswers[field.id]}
                  onChange={(value) => setFormAnswers((prev) => ({ ...prev, [field.id]: value }))}
                />
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={requestJoinActivity.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={requestJoinActivity.isPending}>
                {requestJoinActivity.isPending ? "Sending..." : "Send Request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <AlertDialog
      open={confirmJoinActivityId !== null}
      onOpenChange={(nextOpen) => { if (!nextOpen) handleClose() }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Request to Join Activity</AlertDialogTitle>
          <AlertDialogDescription>
            This activity requires admin approval. Your request will be reviewed
            by an administrator. You&apos;ll be notified once it&apos;s been approved or declined.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleSubmit()}
          >
            Send Request
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Sidebar activity switcher — desktop only (Popover).
 * On mobile, `MobileActivitySwitcher` in the header is used instead.
 */
export function ActivitySwitcher() {
  const { orgId } = useParams({ strict: false })
  const { isMobile } = useSidebar()
  const state = useActivitySwitcherState(orgId ?? "")

  if (!orgId || !state.isMultiActivity || isMobile) return null

  const triggerLabel = formatActivityLabel(state.selectedActivity?.name)

  const handleSelect = (activityId: string | null) => {
    state.setSelectedActivity(activityId)
    state.setOpen(false)
  }

  return (
    <>
      <Popover open={state.open} onOpenChange={state.handleOpenChange}>
        <PopoverTrigger asChild>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={triggerLabel}
                className="data-[state=open]:bg-primary/10 data-[state=open]:text-primary transition-all duration-200 group-data-[collapsible=icon]:justify-center"
              >
                <Layers className="size-4 shrink-0" />
                <span className="truncate group-data-[collapsible=icon]:hidden">
                  {triggerLabel}
                </span>
                <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          sideOffset={4}
          className="w-64 p-2"
        >
          <ActivityList
            showSearch={state.showSearch}
            searchInputRef={state.searchInputRef}
            search={state.search}
            setSearch={state.setSearch}
            selectedActivityId={state.selectedActivityId}
            filteredActivities={state.filteredActivities}
            isAdmin={state.isAdmin}
            isMutating={state.isMutating}
            joinActivity={state.joinActivity}
            requestJoinActivity={state.requestJoinActivity}
            setConfirmJoinActivityId={state.setConfirmJoinActivityId}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>

      <JoinConfirmDialog
        confirmJoinActivityId={state.confirmJoinActivityId}
        setConfirmJoinActivityId={state.setConfirmJoinActivityId}
        activities={state.activities}
        requestJoinActivity={state.requestJoinActivity}
      />
    </>
  )
}

/**
 * Compact activity switcher for the mobile header bar.
 * Renders a small pill trigger that opens a bottom sheet.
 */
export function MobileActivitySwitcher() {
  const { orgId } = useParams({ strict: false })
  const { isMobile } = useSidebar()
  const state = useActivitySwitcherState(orgId ?? "")

  if (!orgId || !state.isMultiActivity || !isMobile) return null

  const triggerLabel = formatActivityLabel(state.selectedActivity?.name)
  const triggerBadge = state.selectedActivity
    ? state.selectedActivity.name.charAt(0).toUpperCase()
    : null

  const handleSelect = (activityId: string | null) => {
    state.setSelectedActivity(activityId)
    state.setOpen(false)
  }

  return (
    <>
      <Sheet open={state.open} onOpenChange={state.handleOpenChange}>
        <button
          onClick={() => state.setOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50 min-w-0 max-w-[160px]"
        >
          {triggerBadge ? (
            <span className="flex size-5 items-center justify-center rounded bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
              {triggerBadge}
            </span>
          ) : (
            <Layers className="size-3.5 shrink-0" />
          )}
          <span className="truncate text-xs font-medium">{triggerLabel}</span>
          <ChevronDown className="size-3 shrink-0" />
        </button>
        <SheetContent side="bottom" className="rounded-t-xl px-4 pb-8">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Activities
            </SheetTitle>
          </SheetHeader>
          <ActivityList
            showSearch={state.showSearch}
            searchInputRef={state.searchInputRef}
            search={state.search}
            setSearch={state.setSearch}
            selectedActivityId={state.selectedActivityId}
            filteredActivities={state.filteredActivities}
            isAdmin={state.isAdmin}
            isMutating={state.isMutating}
            joinActivity={state.joinActivity}
            requestJoinActivity={state.requestJoinActivity}
            setConfirmJoinActivityId={state.setConfirmJoinActivityId}
            onSelect={handleSelect}
          />
        </SheetContent>
      </Sheet>

      <JoinConfirmDialog
        confirmJoinActivityId={state.confirmJoinActivityId}
        setConfirmJoinActivityId={state.setConfirmJoinActivityId}
        activities={state.activities}
        requestJoinActivity={state.requestJoinActivity}
      />
    </>
  )
}

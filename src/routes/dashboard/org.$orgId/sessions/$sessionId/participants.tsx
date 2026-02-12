import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import type { JoinFormSchema } from "@/types/form"
import type { AttendanceStatus, PaymentStatus } from "@/lib/sessions/state-machine"
import {
  ParticipantsToolbar,
  ParticipantsTable,
  BulkActionBar,
  AddParticipantDialog,
} from "@/components/participants"
import type { ParticipantData, UpdateParticipationData } from "@/components/participants"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/sessions/$sessionId/participants"
)({
  component: SessionParticipantsPage,
})

function SessionParticipantsPage() {
  const { orgId, sessionId } = Route.useParams()
  const utils = trpc.useUtils()

  // UI state
  const [activeTab, setActiveTab] = useState<"joined" | "waitlisted" | "pending">("joined")
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAttendanceAction, setBulkAttendanceAction] = useState<AttendanceStatus>("show")
  const [bulkPaymentAction, setBulkPaymentAction] = useState<PaymentStatus>("paid")
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Auth
  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  // Session data
  const { data: sessionData } = trpc.session.getById.useQuery({ sessionId })

  // Other sessions for move feature
  const { data: orgSessions } = trpc.session.list.useQuery(
    { limit: 100 },
    { enabled: isAdmin }
  )

  // Participant queries — all three tabs, with search
  const {
    data: joinedParticipants,
    isLoading: joinedLoading,
  } = trpc.participation.participants.useQuery(
    { sessionId, status: "joined", search: search || undefined, limit: 500 },
    { enabled: isAdmin }
  )

  const {
    data: waitlistedParticipants,
    isLoading: waitlistedLoading,
  } = trpc.participation.participants.useQuery(
    { sessionId, status: "waitlisted", search: search || undefined, limit: 500 },
    { enabled: isAdmin }
  )

  const {
    data: pendingParticipants,
    isLoading: pendingLoading,
  } = trpc.participation.participants.useQuery(
    { sessionId, status: "pending", search: search || undefined, limit: 500 },
    { enabled: isAdmin }
  )

  // Invalidation helper
  const invalidateAll = useCallback(() => {
    utils.participation.participants.invalidate({ sessionId })
    utils.session.list.invalidate()
    utils.session.getById.invalidate({ sessionId })
    utils.session.getWithCounts.invalidate({ sessionId })
  }, [utils, sessionId])

  // Mutations
  const updateParticipation = trpc.participation.update.useMutation({
    onSuccess: () => {
      invalidateAll()
    },
    onError: (err) => toast.error(err.message),
  })

  const bulkUpdateAttendance = trpc.participation.bulkUpdateAttendance.useMutation({
    onSuccess: (data) => {
      invalidateAll()
      setSelectedIds(new Set())
      toast.success(`Attendance updated for ${data.count} participants`)
    },
    onError: (err) => toast.error(err.message),
  })

  const bulkUpdatePayment = trpc.participation.bulkUpdatePayment.useMutation({
    onSuccess: (data) => {
      invalidateAll()
      setSelectedIds(new Set())
      toast.success(`Payment updated for ${data.count} participants`)
    },
    onError: (err) => toast.error(err.message),
  })

  const adminAdd = trpc.participation.adminAdd.useMutation({
    onSuccess: () => {
      invalidateAll()
      setAddDialogOpen(false)
      setAddError(null)
      toast.success("Participant added")
    },
    onError: (err) => setAddError(err.message),
  })

  const moveParticipant = trpc.participation.move.useMutation({
    onSuccess: (_data, variables) => {
      invalidateAll()
      utils.participation.participants.invalidate({ sessionId: variables.targetSessionId })
      utils.session.getById.invalidate({ sessionId: variables.targetSessionId })
      toast.success("Participant moved")
    },
    onError: (err) => toast.error(err.message),
  })

  const approvePending = trpc.participation.approvePending.useMutation({
    onSuccess: () => {
      invalidateAll()
      toast.success("Request approved")
    },
    onError: (err) => toast.error(err.message),
  })

  const rejectPending = trpc.participation.rejectPending.useMutation({
    onSuccess: () => {
      invalidateAll()
      toast.success("Request rejected")
    },
    onError: (err) => toast.error(err.message),
  })

  // Handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (joinedParticipants) {
      setSelectedIds(new Set(joinedParticipants.map((p) => p.participation.id)))
    }
  }, [joinedParticipants])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleApplyBulkAttendance = useCallback(() => {
    if (selectedIds.size === 0) return
    bulkUpdateAttendance.mutate({
      sessionId,
      updates: Array.from(selectedIds).map((participationId) => ({
        participationId,
        attendance: bulkAttendanceAction,
      })),
    })
  }, [selectedIds, sessionId, bulkAttendanceAction, bulkUpdateAttendance])

  const handleApplyBulkPayment = useCallback(() => {
    if (selectedIds.size === 0) return
    bulkUpdatePayment.mutate({
      sessionId,
      updates: Array.from(selectedIds).map((participationId) => ({
        participationId,
        payment: bulkPaymentAction,
      })),
    })
  }, [selectedIds, sessionId, bulkPaymentAction, bulkUpdatePayment])

  const handleUpdate = useCallback(
    (data: UpdateParticipationData) => {
      updateParticipation.mutate(data)
    },
    [updateParticipation]
  )

  const handleAddParticipant = useCallback(
    (identifier: string) => {
      setAddError(null)
      adminAdd.mutate({ sessionId, identifier })
    },
    [adminAdd, sessionId]
  )

  const handleMove = useCallback(
    (participationId: string, targetSessionId: string) => {
      moveParticipant.mutate({ participationId, targetSessionId })
    },
    [moveParticipant]
  )

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as "joined" | "waitlisted" | "pending")
    setSelectedIds(new Set())
  }, [])

  // Derived data
  const availableTargetSessions = orgSessions?.filter(
    (s) => s.id !== sessionId && s.status !== "cancelled" && s.status !== "completed"
  ) ?? []

  const sessionFormFields = (sessionData?.joinFormSchema as JoinFormSchema | null)?.fields ?? []

  const joinedCount = joinedParticipants?.length ?? 0
  const waitlistedCount = waitlistedParticipants?.length ?? 0
  const pendingCount = pendingParticipants?.length ?? 0

  // Loading state
  if (whoamiLoading) {
    return (
      <div className="py-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Access denied
  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only group owners and admins can view participants.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link
                to="/dashboard/org/$orgId/sessions/$sessionId"
                params={{ orgId, sessionId }}
              >
                Back to Session
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link
            to="/dashboard/org/$orgId/sessions/$sessionId"
            params={{ orgId, sessionId }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight">Session Participants</h1>
          {sessionData && (
            <p className="text-sm text-muted-foreground truncate">{sessionData.title}</p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <ParticipantsToolbar
        search={search}
        onSearchChange={setSearch}
        onAddClick={() => {
          setAddError(null)
          setAddDialogOpen(true)
        }}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="joined">
            Joined
            <span className="ml-1.5 font-mono text-xs">({joinedCount})</span>
          </TabsTrigger>
          <TabsTrigger value="waitlisted">
            Waitlist
            <span className="ml-1.5 font-mono text-xs">({waitlistedCount})</span>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            <span className="ml-1.5 font-mono text-xs">({pendingCount})</span>
          </TabsTrigger>
        </TabsList>

        {/* Bulk action bar — only for joined tab */}
        {activeTab === "joined" && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={joinedCount}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            attendanceAction={bulkAttendanceAction}
            onAttendanceActionChange={setBulkAttendanceAction}
            paymentAction={bulkPaymentAction}
            onPaymentActionChange={setBulkPaymentAction}
            onApplyAttendance={handleApplyBulkAttendance}
            onApplyPayment={handleApplyBulkPayment}
            isApplyingAttendance={bulkUpdateAttendance.isPending}
            isApplyingPayment={bulkUpdatePayment.isPending}
          />
        )}

        <TabsContent value="joined">
          <ParticipantsTable
            participants={joinedParticipants as ParticipantData[] | undefined}
            isLoading={joinedLoading}
            tab="joined"
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onUpdate={handleUpdate}
            isUpdating={updateParticipation.isPending}
            sessionId={sessionId}
            formFields={sessionFormFields}
            availableTargetSessions={availableTargetSessions}
            onMove={handleMove}
            isMoving={moveParticipant.isPending}
          />
        </TabsContent>

        <TabsContent value="waitlisted">
          <ParticipantsTable
            participants={waitlistedParticipants as ParticipantData[] | undefined}
            isLoading={waitlistedLoading}
            tab="waitlisted"
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onUpdate={handleUpdate}
            isUpdating={updateParticipation.isPending}
            sessionId={sessionId}
            formFields={sessionFormFields}
            availableTargetSessions={availableTargetSessions}
            onMove={handleMove}
            isMoving={moveParticipant.isPending}
          />
        </TabsContent>

        <TabsContent value="pending">
          <ParticipantsTable
            participants={pendingParticipants as ParticipantData[] | undefined}
            isLoading={pendingLoading}
            tab="pending"
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onUpdate={handleUpdate}
            onApprove={(id) => approvePending.mutate({ participationId: id })}
            onReject={(id) => rejectPending.mutate({ participationId: id })}
            isUpdating={approvePending.isPending || rejectPending.isPending}
            sessionId={sessionId}
            formFields={sessionFormFields}
            availableTargetSessions={availableTargetSessions}
            onMove={handleMove}
            isMoving={moveParticipant.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Add Participant Dialog */}
      <AddParticipantDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddParticipant}
        isPending={adminAdd.isPending}
        error={addError}
      />
    </div>
  )
}

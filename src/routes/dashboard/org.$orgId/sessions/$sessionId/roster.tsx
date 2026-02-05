import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, MessageSquare, ChevronDown, ChevronUp, Save, CheckSquare, Square, UserPlus, ArrowRightLeft } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/sessions/$sessionId/roster"
)({
  component: SessionRosterPage,
})

function SessionRosterPage() {
  const { orgId, sessionId } = Route.useParams()
  const utils = trpc.useUtils()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<"pending" | "show" | "no_show">("show")

  // Add participant state
  const [addIdentifier, setAddIdentifier] = useState("")
  const [addError, setAddError] = useState("")

  // Move participant state
  const [movingParticipationId, setMovingParticipationId] = useState<string | null>(null)

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: sessionData } = trpc.session.getById.useQuery({ sessionId })

  // Get other sessions in the org for moving participants
  const { data: orgSessions } = trpc.session.list.useQuery(
    { limit: 100 },
    { enabled: isAdmin }
  )

  const {
    data: joinedParticipants,
    isLoading: joinedLoading,
  } = trpc.participation.roster.useQuery(
    { sessionId, status: "joined", limit: 100 },
    { enabled: isAdmin }
  )

  const {
    data: waitlistedParticipants,
    isLoading: waitlistedLoading,
  } = trpc.participation.roster.useQuery(
    { sessionId, status: "waitlisted", limit: 100 },
    { enabled: isAdmin }
  )

  const updateParticipation = trpc.participation.update.useMutation({
    onSuccess: () => {
      utils.participation.roster.invalidate({ sessionId })
    },
  })

  const bulkUpdateAttendance = trpc.participation.bulkUpdateAttendance.useMutation({
    onSuccess: () => {
      utils.participation.roster.invalidate({ sessionId })
      setSelectedIds(new Set())
    },
  })

  const adminAdd = trpc.participation.adminAdd.useMutation({
    onSuccess: () => {
      utils.participation.roster.invalidate({ sessionId })
      // Invalidate session list and details for participant count update
      utils.session.list.invalidate()
      utils.session.getById.invalidate({ sessionId })
      setAddIdentifier("")
      setAddError("")
    },
    onError: (error) => {
      setAddError(error.message)
    },
  })

  const moveParticipant = trpc.participation.move.useMutation({
    onSuccess: (_data, variables) => {
      // Invalidate source session roster
      utils.participation.roster.invalidate({ sessionId })
      // Invalidate target session roster
      utils.participation.roster.invalidate({ sessionId: variables.targetSessionId })
      // Invalidate session list (for participant counts)
      utils.session.list.invalidate()
      // Invalidate both session details
      utils.session.getById.invalidate({ sessionId })
      utils.session.getById.invalidate({ sessionId: variables.targetSessionId })
      setMovingParticipationId(null)
    },
  })

  const handleSelectAll = () => {
    if (joinedParticipants) {
      setSelectedIds(new Set(joinedParticipants.map((p) => p.participation.id)))
    }
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleBulkUpdate = () => {
    if (selectedIds.size === 0) return
    bulkUpdateAttendance.mutate({
      sessionId,
      updates: Array.from(selectedIds).map((participationId) => ({
        participationId,
        attendance: bulkAction,
      })),
    })
  }

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault()
    setAddError("")
    if (!addIdentifier.trim()) {
      setAddError("Please enter an email or phone number")
      return
    }
    adminAdd.mutate({ sessionId, identifier: addIdentifier.trim() })
  }

  const handleMove = (participationId: string, targetSessionId: string) => {
    moveParticipant.mutate({ participationId, targetSessionId })
  }

  // Filter sessions that can be moved to (same org, not current, not cancelled/completed)
  const availableTargetSessions = orgSessions?.filter(
    (s) => s.id !== sessionId && s.status !== "cancelled" && s.status !== "completed"
  ) ?? []

  if (whoamiLoading) {
    return (
      <div className="py-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only group owners and admins can view the roster.
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
    <div className="space-y-6 py-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link
            to="/dashboard/org/$orgId/sessions/$sessionId"
            params={{ orgId, sessionId }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Session
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Session Roster</h1>
        {sessionData && (
          <p className="text-muted-foreground">{sessionData.title}</p>
        )}
      </div>

      {/* Add Participant */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add Participant
          </CardTitle>
          <CardDescription>
            Add an organization member to this session by email or phone
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddParticipant} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="identifier" className="sr-only">Email or Phone</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Email or phone number (+12025551234)"
                value={addIdentifier}
                onChange={(e) => setAddIdentifier(e.target.value)}
                disabled={adminAdd.isPending}
              />
            </div>
            <Button type="submit" disabled={adminAdd.isPending}>
              {adminAdd.isPending ? "Adding..." : "Add"}
            </Button>
          </form>
          {addError && (
            <p className="mt-2 text-sm text-destructive">{addError}</p>
          )}
          {adminAdd.isSuccess && (
            <p className="mt-2 text-sm text-green-600">Participant added successfully!</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Joined Participants */}
        <Card>
          <CardHeader>
            <CardTitle>
              Joined ({joinedParticipants?.length ?? 0})
            </CardTitle>
            <CardDescription>
              Participants registered for this session
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bulk Actions */}
            {joinedParticipants && joinedParticipants.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-md border bg-muted/50">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
                    disabled={selectedIds.size === 0}
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Deselect All
                  </Button>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <Select
                    value={bulkAction}
                    onValueChange={(v) => setBulkAction(v as "pending" | "show" | "no_show")}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="show">Present</SelectItem>
                      <SelectItem value="no_show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleBulkUpdate}
                    disabled={selectedIds.size === 0 || bulkUpdateAttendance.isPending}
                  >
                    {bulkUpdateAttendance.isPending ? "Updating..." : "Apply"}
                  </Button>
                </div>
              </div>
            )}
            {bulkUpdateAttendance.error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {bulkUpdateAttendance.error.message}
              </div>
            )}

            {joinedLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
            {joinedParticipants && joinedParticipants.length === 0 && (
              <p className="text-muted-foreground">No participants yet</p>
            )}
            {joinedParticipants && joinedParticipants.length > 0 && (
              <div className="space-y-3">
                {joinedParticipants.map((item, index) => (
                  <div key={item.participation.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedIds.has(item.participation.id)}
                        onCheckedChange={() => handleToggleSelect(item.participation.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <ParticipantRow
                          participation={item.participation}
                          user={item.user}
                          onUpdate={(data) =>
                            updateParticipation.mutate({
                              participationId: item.participation.id,
                              ...data,
                            })
                          }
                          isUpdating={updateParticipation.isPending}
                          availableTargetSessions={availableTargetSessions}
                          isMoving={moveParticipant.isPending && movingParticipationId === item.participation.id}
                          showMoveUI={movingParticipationId === item.participation.id}
                          onToggleMove={() => setMovingParticipationId(
                            movingParticipationId === item.participation.id ? null : item.participation.id
                          )}
                          onMove={(targetSessionId) => handleMove(item.participation.id, targetSessionId)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waitlisted Participants */}
        <Card>
          <CardHeader>
            <CardTitle>
              Waitlist ({waitlistedParticipants?.length ?? 0})
            </CardTitle>
            <CardDescription>
              Participants waiting for a spot
            </CardDescription>
          </CardHeader>
          <CardContent>
            {waitlistedLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}
            {waitlistedParticipants && waitlistedParticipants.length === 0 && (
              <p className="text-muted-foreground">No one on waitlist</p>
            )}
            {waitlistedParticipants && waitlistedParticipants.length > 0 && (
              <div className="space-y-3">
                {waitlistedParticipants.map((item, index) => (
                  <div key={item.participation.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{item.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.user.email}
                        </p>
                        {availableTargetSessions.length > 0 && (
                          <div className="mt-2">
                            {movingParticipationId === item.participation.id ? (
                              <div className="flex items-center gap-2">
                                <Select
                                  onValueChange={(targetId) => {
                                    if (targetId) {
                                      handleMove(item.participation.id, targetId)
                                    }
                                  }}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Select session" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableTargetSessions.map((s) => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.title}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setMovingParticipationId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMovingParticipationId(item.participation.id)}
                                disabled={moveParticipant.isPending}
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-1" />
                                Move
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

type ParticipantRowProps = {
  participation: {
    id: string
    attendance: string
    payment: string
    notes: string | null
  }
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
  onUpdate: (data: { attendance?: "pending" | "show" | "no_show"; payment?: "unpaid" | "paid"; notes?: string | null }) => void
  isUpdating: boolean
  availableTargetSessions: Array<{ id: string; title: string; status: string }>
  isMoving: boolean
  showMoveUI: boolean
  onToggleMove: () => void
  onMove: (targetSessionId: string) => void
}

function ParticipantRow({
  participation,
  user,
  onUpdate,
  isUpdating,
  availableTargetSessions,
  isMoving,
  showMoveUI,
  onToggleMove,
  onMove,
}: ParticipantRowProps) {
  const [showNotes, setShowNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(participation.notes || "")
  const [notesDirty, setNotesDirty] = useState(false)
  const [selectedTargetSession, setSelectedTargetSession] = useState("")

  const attendanceVariant = (attendance: string) => {
    switch (attendance) {
      case "show":
        return "default"
      case "no_show":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const paymentVariant = (payment: string) => {
    switch (payment) {
      case "paid":
        return "default"
      default:
        return "outline"
    }
  }

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotesValue(e.target.value)
    setNotesDirty(true)
  }

  const handleSaveNotes = () => {
    onUpdate({ notes: notesValue.trim() || null })
    setNotesDirty(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={attendanceVariant(participation.attendance)}>
            {participation.attendance}
          </Badge>
          <Badge variant={paymentVariant(participation.payment)}>
            {participation.payment}
          </Badge>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Select
          value={participation.attendance}
          onValueChange={(value) =>
            onUpdate({ attendance: value as "pending" | "show" | "no_show" })
          }
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="show">Show</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={participation.payment}
          onValueChange={(value) =>
            onUpdate({ payment: value as "unpaid" | "paid" })
          }
          disabled={isUpdating}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNotes(!showNotes)}
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          {participation.notes ? "Edit Notes" : "Add Notes"}
          {showNotes ? (
            <ChevronUp className="h-4 w-4 ml-1" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1" />
          )}
        </Button>
        {availableTargetSessions.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMove}
            disabled={isMoving}
          >
            <ArrowRightLeft className="h-4 w-4 mr-1" />
            Move
          </Button>
        )}
      </div>
      {showMoveUI && availableTargetSessions.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
          <span className="text-sm text-muted-foreground">Move to:</span>
          <Select
            value={selectedTargetSession}
            onValueChange={setSelectedTargetSession}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {availableTargetSessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => {
              if (selectedTargetSession) {
                onMove(selectedTargetSession)
                setSelectedTargetSession("")
              }
            }}
            disabled={!selectedTargetSession || isMoving}
          >
            {isMoving ? "Moving..." : "Confirm"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMove}
          >
            Cancel
          </Button>
        </div>
      )}
      {showNotes && (
        <div className="space-y-2 pt-2">
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Add notes about this participant..."
            value={notesValue}
            onChange={handleNotesChange}
            disabled={isUpdating}
          />
          {notesDirty && (
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={isUpdating}
            >
              <Save className="h-4 w-4 mr-1" />
              {isUpdating ? "Saving..." : "Save Notes"}
            </Button>
          )}
        </div>
      )}
      {!showNotes && participation.notes && (
        <p className="text-sm text-muted-foreground italic pl-1">
          {participation.notes.length > 50
            ? participation.notes.slice(0, 50) + "..."
            : participation.notes}
        </p>
      )}
    </div>
  )
}

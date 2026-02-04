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
import { ArrowLeft, MessageSquare, ChevronDown, ChevronUp, Save, CheckSquare, Square } from "lucide-react"
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

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: sessionData } = trpc.session.getById.useQuery({ sessionId })

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
              Only organization owners and admins can view the roster.
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
}

function ParticipantRow({
  participation,
  user,
  onUpdate,
  isUpdating,
}: ParticipantRowProps) {
  const [showNotes, setShowNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(participation.notes || "")
  const [notesDirty, setNotesDirty] = useState(false)

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
      <div className="flex gap-2">
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
          className="ml-auto"
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
      </div>
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

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  MessageSquare,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Save,
  ArrowRightLeft,
} from "lucide-react"
import type { ParticipantData, UpdateParticipationData, TargetSession } from "./types"
import type { AttendanceStatus } from "@/lib/sessions/state-machine"
import type { FormField } from "@/types/form"
import { AINotesSection } from "./ai-notes-section"

type ParticipantsTableProps = {
  participants: ParticipantData[] | undefined
  isLoading: boolean
  tab: "joined" | "waitlisted" | "pending"
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onUpdate: (data: UpdateParticipationData) => void
  onApprove?: (participationId: string) => void
  onReject?: (participationId: string) => void
  isUpdating: boolean
  sessionId: string
  formFields: FormField[]
  availableTargetSessions: TargetSession[]
  onMove: (participationId: string, targetSessionId: string) => void
  isMoving: boolean
}

// Payment toggles: unpaid ↔ paid
function nextPayment(current: string): "unpaid" | "paid" {
  return current === "paid" ? "unpaid" : "paid"
}

// Attendance badge colors per status
const attendanceStyles: Record<string, string> = {
  show: "bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)]",
  no_show: "bg-[var(--color-badge-danger-bg)] text-[var(--color-status-danger)]",
  pending: "bg-[var(--color-badge-inactive-bg)] text-[var(--color-status-inactive)]",
}

const attendanceLabels: Record<string, string> = {
  show: "Show",
  no_show: "No Show",
  pending: "Pending",
}

/**
 * Attendance badge that opens a dropdown to select the status directly.
 * Looks like a badge, acts like a select.
 */
function AttendanceDropdownBadge({
  value,
  onSelect,
  disabled,
}: {
  value: string
  onSelect: (next: AttendanceStatus) => void
  disabled: boolean
}) {
  const style = attendanceStyles[value] ?? attendanceStyles.pending
  const label = attendanceLabels[value] ?? "Pending"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Badge
          variant="outline"
          className={`${style} border-0 text-xs cursor-pointer select-none hover:opacity-80 transition-opacity whitespace-nowrap`}
        >
          {label}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-[100px]">
        {(["pending", "show", "no_show"] as const).map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => onSelect(status)}
            className="text-xs"
          >
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
              status === "show" ? "bg-[var(--color-status-success)]"
              : status === "no_show" ? "bg-[var(--color-status-danger)]"
              : "bg-[var(--color-status-inactive)]"
            }`} />
            {attendanceLabels[status]}
            {status === value && <Check className="ml-auto h-3 w-3" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Payment badge — one-click toggle between paid/unpaid.
 */
function ClickablePaymentBadge({
  value,
  onClick,
  disabled,
}: {
  value: string
  onClick: () => void
  disabled: boolean
}) {
  const base = "cursor-pointer select-none transition-opacity border-0 text-xs"
  const disabledClass = disabled ? "opacity-50 pointer-events-none" : "hover:opacity-80"

  switch (value) {
    case "paid":
      return (
        <Badge
          variant="outline"
          className={`bg-[var(--color-badge-success-bg)] text-[var(--color-status-success)] ${base} ${disabledClass}`}
          onClick={onClick}
        >
          Paid
        </Badge>
      )
    default:
      return (
        <Badge
          variant="outline"
          className={`bg-[var(--color-badge-warning-bg)] text-[var(--color-status-warning)] ${base} ${disabledClass}`}
          onClick={onClick}
        >
          Unpaid
        </Badge>
      )
  }
}

function TableSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 ml-auto" />
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ tab }: { tab: string }) {
  const messages: Record<string, string> = {
    joined: "No participants yet",
    waitlisted: "No one on the waitlist",
    pending: "No pending requests",
  }
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <p className="text-sm">{messages[tab] ?? "No results"}</p>
    </div>
  )
}

// ============================================================================
// Expanded Row Detail Panel
// ============================================================================

function ExpandedRowPanel({
  item,
  sessionId,
  formFields,
  onUpdate,
  isUpdating,
}: {
  item: ParticipantData
  sessionId: string
  formFields: FormField[]
  onUpdate: (data: UpdateParticipationData) => void
  isUpdating: boolean
}) {
  const [notesValue, setNotesValue] = useState(item.participation.notes ?? "")
  const [notesDirty, setNotesDirty] = useState(false)

  // Sync notes when participation data changes from server
  useEffect(() => {
    setNotesValue(item.participation.notes ?? "")
    setNotesDirty(false)
  }, [item.participation.notes])

  const handleSaveNotes = () => {
    onUpdate({
      participationId: item.participation.id,
      notes: notesValue.trim() || null,
    })
    setNotesDirty(false)
  }

  const answers = item.participation.formAnswers as Record<string, unknown> | null

  return (
    <div className="border-t bg-muted/50 px-4 py-4 space-y-4 sm:pl-12">
      {/* Notes */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Notes
        </label>
        <textarea
          className="flex min-h-[72px] w-full rounded-md border border-input bg-popover px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
          placeholder="Add notes about this participant..."
          value={notesValue}
          onChange={(e) => {
            setNotesValue(e.target.value)
            setNotesDirty(true)
          }}
          disabled={isUpdating}
        />
        {notesDirty && (
          <Button
            size="sm"
            onClick={handleSaveNotes}
            disabled={isUpdating}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {isUpdating ? "Saving..." : "Save Notes"}
          </Button>
        )}
      </div>

      {/* AI Summary */}
      <AINotesSection
        participationId={item.participation.id}
        sessionId={sessionId}
      />

      {/* Form Answers */}
      {formFields.length > 0 && answers && Object.keys(answers).length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Form Answers
          </label>
          <div className="rounded-md border bg-muted/50 p-3 space-y-1.5">
            {formFields.map((field) => {
              const answer = answers[field.id]
              if (answer === undefined || answer === null) return null
              const displayValue = Array.isArray(answer)
                ? answer.join(", ")
                : typeof answer === "boolean"
                  ? answer ? "Yes" : "No"
                  : String(answer)
              return (
                <div key={field.id} className="text-sm">
                  <span className="font-medium text-muted-foreground">
                    {field.label}:
                  </span>{" "}
                  <span>{displayValue}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

// ============================================================================
// Main Table
// ============================================================================

export function ParticipantsTable({
  participants,
  isLoading,
  tab,
  selectedIds,
  onToggleSelect,
  onUpdate,
  onApprove,
  onReject,
  isUpdating,
  sessionId,
  formFields,
  availableTargetSessions,
  onMove,
  isMoving,
}: ParticipantsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (isLoading) return <TableSkeleton />
  if (!participants || participants.length === 0) return <EmptyState tab={tab} />

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-lg border">
      {/* Table header */}
      <div className="hidden sm:grid sm:grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 border-b bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {tab === "joined" ? (
          <div className="w-5" />
        ) : tab === "waitlisted" ? (
          <div className="w-6 text-center">#</div>
        ) : (
          <div className="w-5" />
        )}
        <div>Name</div>
        <div className="w-24 text-center">Attendance</div>
        <div className="w-16 text-center">Payment</div>
        <div className="w-8 text-center">
          <MessageSquare className="h-3.5 w-3.5 mx-auto" />
        </div>
        <div className="w-8" />
      </div>

      {/* Rows */}
      <div className="divide-y">
        {participants.map((item, index) => {
          const isExpanded = expandedIds.has(item.participation.id)
          const isSelected = selectedIds.has(item.participation.id)

          return (
            <div key={item.participation.id}>
              {/* Row */}
              <div
                className={`group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/50 ${
                  isSelected ? "bg-muted/50" : ""
                } ${isExpanded ? "bg-muted/30" : ""}`}
                onClick={() => toggleExpand(item.participation.id)}
              >
                {/* Leading column: checkbox / position / spacer */}
                {tab === "joined" ? (
                  <div
                    className="flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(item.participation.id)}
                    />
                  </div>
                ) : tab === "waitlisted" ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-mono font-medium">
                    {index + 1}
                  </span>
                ) : (
                  <div className="w-5" />
                )}

                {/* Name + Email */}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate hidden sm:block">
                    {item.user.email}
                  </p>
                </div>

                {/* Attendance badge — dropdown to select */}
                <div
                  className="hidden sm:flex justify-center w-24"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AttendanceDropdownBadge
                    value={item.participation.attendance}
                    disabled={isUpdating}
                    onSelect={(next) =>
                      onUpdate({
                        participationId: item.participation.id,
                        attendance: next,
                      })
                    }
                  />
                </div>

                {/* Payment badge — clickable to toggle */}
                <div
                  className="hidden sm:flex justify-center w-16"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ClickablePaymentBadge
                    value={item.participation.payment}
                    disabled={isUpdating}
                    onClick={() =>
                      onUpdate({
                        participationId: item.participation.id,
                        payment: nextPayment(item.participation.payment),
                      })
                    }
                  />
                </div>

                {/* Notes indicator */}
                <div className="hidden sm:flex justify-center w-8">
                  {item.participation.notes && (
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>

                {/* Actions: approve/reject for pending, expand chevron otherwise */}
                <div
                  className="flex items-center justify-end"
                  onClick={(e) => {
                    if (tab === "pending") e.stopPropagation()
                  }}
                >
                  {tab === "pending" ? (
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-[var(--color-status-success)]"
                        onClick={() => onApprove?.(item.participation.id)}
                        disabled={isUpdating}
                        title="Approve"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-[var(--color-status-danger)]"
                        onClick={() => onReject?.(item.participation.id)}
                        disabled={isUpdating}
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      {availableTargetSessions.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                              disabled={isMoving}
                              title="Move to another session"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {availableTargetSessions.map((s) => (
                              <DropdownMenuItem
                                key={s.id}
                                onClick={() => onMove(item.participation.id, s.id)}
                                className="text-xs"
                              >
                                {s.title}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      <div className="h-7 w-7 flex items-center justify-center text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile-only: badges below name */}
                <div
                  className="col-span-3 flex gap-2 sm:hidden -mt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AttendanceDropdownBadge
                    value={item.participation.attendance}
                    disabled={isUpdating}
                    onSelect={(next) =>
                      onUpdate({
                        participationId: item.participation.id,
                        attendance: next,
                      })
                    }
                  />
                  <ClickablePaymentBadge
                    value={item.participation.payment}
                    disabled={isUpdating}
                    onClick={() =>
                      onUpdate({
                        participationId: item.participation.id,
                        payment: nextPayment(item.participation.payment),
                      })
                    }
                  />
                  {item.participation.notes && (
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground self-center" />
                  )}
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <ExpandedRowPanel
                  item={item}
                  sessionId={sessionId}
                  formFields={formFields}
                  onUpdate={onUpdate}
                  isUpdating={isUpdating}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

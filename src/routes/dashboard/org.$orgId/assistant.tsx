import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
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
  Bot,
  MessageCircle,
  ListChecks,
  Unlink,
  Loader2,
  Check,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTelegramLogin } from "@/hooks/use-telegram-login"
import type { TelegramWidgetAuthInput } from "@/plugins/assistant/schemas"

export const Route = createFileRoute("/dashboard/org/$orgId/assistant")({
  component: AssistantPage,
})

function AssistantPage() {
  const { orgId } = Route.useParams()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: orgSettings, isLoading: settingsLoading } = trpc.organizationSettings.get.useQuery(
    {},
    { enabled: isAdmin }
  )
  const enabledPlugins = (orgSettings?.enabledPlugins ?? {}) as Record<string, boolean>
  const gigiEnabled = enabledPlugins["assistant"] === true

  const { data: pendingRequests } = trpc.plugin.assistant.listPending.useQuery(
    { statuses: ["pending_approval"] },
    { enabled: isAdmin && gigiEnabled }
  )

  const pendingCount = pendingRequests?.length ?? 0

  if (whoamiLoading || settingsLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 w-full" />
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
          Only group owners and admins can manage Gigi.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId" params={{ orgId }}>
            Back to Overview
          </Link>
        </Button>
      </div>
    )
  }

  if (!gigiEnabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Bot className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Gigi is Disabled</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Enable the Gigi plugin in your group settings to use smart admin commands via Telegram.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId/settings" params={{ orgId }}>
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      {/* Header */}
      <div>
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <Bot className="mr-2 h-3.5 w-3.5" />
          Gigi
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Gigi</h1>
        <p className="text-muted-foreground">
          Your smart assistant to manage Telegram linking and approve commands
        </p>
      </div>

      {/* Telegram Section */}
      <TelegramSection />

      {/* Queue Section */}
      <QueueSection pendingCount={pendingCount} />
    </div>
  )
}

// =============================================================================
// Telegram Section (inline card)
// =============================================================================

function TelegramSection() {
  const utils = trpc.useUtils()
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined

  const { data: telegramLink, isLoading: linkLoading } =
    trpc.plugin.assistant.getMyTelegramLink.useQuery()

  const linkWidgetMutation = trpc.plugin.assistant.linkTelegramViaWidget.useMutation({
    onSuccess: () => {
      utils.plugin.assistant.getMyTelegramLink.invalidate()
      toast.success("Telegram account linked successfully")
    },
    onError: (err) => toast.error(err.message),
  })

  const unlinkMutation = trpc.plugin.assistant.unlinkMyTelegram.useMutation({
    onSuccess: () => {
      utils.plugin.assistant.getMyTelegramLink.invalidate()
      toast.success("Telegram account unlinked")
    },
    onError: (err) => toast.error(err.message),
  })

  const handleTelegramAuth = (user: TelegramWidgetAuthInput) => {
    linkWidgetMutation.mutate(user)
  }

  const { ref: telegramWidgetRef } = useTelegramLogin({
    botUsername: botUsername ?? "",
    onAuth: handleTelegramAuth,
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          Telegram
        </CardTitle>
      </CardHeader>
      <CardContent>
        {linkLoading ? (
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-48" />
          </div>
        ) : telegramLink?.linked ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-600">Linked</p>
                <p className="text-xs text-muted-foreground">
                  Telegram ID: <code className="font-mono">{telegramLink.telegramUserId}</code>
                  {telegramLink.linkedAt && (
                    <> &middot; {new Date(telegramLink.linkedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}</>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => unlinkMutation.mutate()}
              disabled={unlinkMutation.isPending}
            >
              <Unlink className="mr-1 h-3.5 w-3.5" />
              {unlinkMutation.isPending ? "Unlinking..." : "Unlink"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Not Linked</p>
                <p className="text-xs text-muted-foreground">
                  Log in with Telegram to link your account.
                </p>
              </div>
            </div>

            {!botUsername ? (
              <p className="text-sm text-destructive">
                Telegram bot username is not configured. Set VITE_TELEGRAM_BOT_USERNAME in your environment.
              </p>
            ) : linkWidgetMutation.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Linking your Telegram account...
              </div>
            ) : (
              <div ref={telegramWidgetRef} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// Queue Section (primary content)
// =============================================================================

function QueueSection({ pendingCount }: { pendingCount: number }) {
  const [view, setView] = useState<"pending" | "history">("pending")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Command Queue</h2>
        <div className="flex gap-2">
          <Button
            variant={view === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("pending")}
          >
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums">
                {pendingCount}
              </Badge>
            )}
          </Button>
          <Button
            variant={view === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("history")}
          >
            History
          </Button>
        </div>
      </div>

      {view === "pending" ? <PendingQueue /> : <HistoryQueue />}
    </div>
  )
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  mark_attendance: "Mark Attendance",
  record_match_result: "Record Match",
  create_session: "Create Session",
  mark_payment: "Mark Payment",
  add_note: "Add Note",
  add_participant: "Add Participant",
  remove_participant: "Remove Participant",
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending_approval: { label: "Pending", className: "bg-yellow-500/10 text-yellow-600" },
  approved: { label: "Approved", className: "bg-blue-500/10 text-blue-600" },
  executed: { label: "Executed", className: "bg-green-500/10 text-green-600" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatDateTime(value: unknown): string | null {
  if (typeof value !== "string") return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

type MemberSummary = {
  userId: string
  displayName: string
}

function extractMemberSummaries(value: unknown): MemberSummary[] {
  if (!Array.isArray(value)) return []

  return value
    .map((member) => {
      if (!isObjectRecord(member) || typeof member.userId !== "string") return null
      const displayName = typeof member.displayName === "string" && member.displayName.trim().length > 0
        ? member.displayName.trim()
        : typeof member.userName === "string" && member.userName.trim().length > 0
          ? member.userName.trim()
          : member.userId

      return {
        userId: member.userId,
        displayName,
      }
    })
    .filter((member): member is MemberSummary => member !== null)
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right", mono && "font-mono text-xs break-all")}>{value}</span>
    </div>
  )
}

function MemberChipList({ members }: { members: MemberSummary[] }) {
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">No members provided.</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map((member) => (
        <span key={member.userId} className="rounded border bg-muted/30 px-1.5 py-0.5 text-xs">
          {member.displayName}
        </span>
      ))}
    </div>
  )
}

function renderPayloadBreakdown(action: string, payload: unknown) {
  if (!isObjectRecord(payload)) {
    return (
      <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
        {safeJson(payload)}
      </pre>
    )
  }

  if (action === "mark_attendance") {
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
    const sessionTitle = typeof payload.sessionTitle === "string" ? payload.sessionTitle : null
    const sessionDateTime = formatDateTime(payload.sessionDateTime)
    const updates = Array.isArray(payload.updates)
      ? payload.updates
          .map((update) => {
            if (!isObjectRecord(update)) return null
            const userId = typeof update.userId === "string" ? update.userId : null
            const attendance = typeof update.attendance === "string" ? update.attendance : null
            if (!userId || !attendance) return null
            const displayName = typeof update.displayName === "string" && update.displayName.trim().length > 0
              ? update.displayName.trim()
              : typeof update.userName === "string" && update.userName.trim().length > 0
                ? update.userName.trim()
                : userId
            return { userId, attendance, displayName }
          })
          .filter((update): update is { userId: string; attendance: string; displayName: string } => update !== null)
      : []

    return (
      <div className="space-y-3">
        {sessionTitle && <DetailRow label="Session" value={sessionTitle} />}
        {sessionDateTime && <DetailRow label="Session time" value={sessionDateTime} />}
        {sessionId && <DetailRow label="Session ID" value={sessionId} mono />}
        <DetailRow label="Attendance updates" value={`${updates.length}`} />

        {updates.length > 0 ? (
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>User</span>
              <span>Set attendance to</span>
            </div>
            <div className="divide-y">
              {updates.map((update) => (
                <div key={update.userId} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{update.displayName}</p>
                    {update.displayName !== update.userId && (
                      <code className="text-[11px] text-muted-foreground">{update.userId}</code>
                    )}
                  </div>
                  <span className="font-medium">{update.attendance}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No structured updates were provided.</p>
        )}
      </div>
    )
  }

  if (action === "mark_payment") {
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
    const sessionTitle = typeof payload.sessionTitle === "string" ? payload.sessionTitle : null
    const sessionDateTime = formatDateTime(payload.sessionDateTime)
    const updates = Array.isArray(payload.updates)
      ? payload.updates
          .map((update) => {
            if (!isObjectRecord(update)) return null
            const userId = typeof update.userId === "string" ? update.userId : null
            const payment = typeof update.payment === "string" ? update.payment : null
            if (!userId || !payment) return null
            const displayName = typeof update.displayName === "string" && update.displayName.trim().length > 0
              ? update.displayName.trim()
              : typeof update.userName === "string" && update.userName.trim().length > 0
                ? update.userName.trim()
                : userId
            return { userId, payment, displayName }
          })
          .filter((update): update is { userId: string; payment: string; displayName: string } => update !== null)
      : []

    return (
      <div className="space-y-3">
        {sessionTitle && <DetailRow label="Session" value={sessionTitle} />}
        {sessionDateTime && <DetailRow label="Session time" value={sessionDateTime} />}
        {sessionId && <DetailRow label="Session ID" value={sessionId} mono />}
        <DetailRow label="Payment updates" value={`${updates.length}`} />

        {updates.length > 0 ? (
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>User</span>
              <span>Set payment to</span>
            </div>
            <div className="divide-y">
              {updates.map((update) => (
                <div key={update.userId} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{update.displayName}</p>
                    {update.displayName !== update.userId && (
                      <code className="text-[11px] text-muted-foreground">{update.userId}</code>
                    )}
                  </div>
                  <span className="font-medium">{update.payment}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No structured updates were provided.</p>
        )}
      </div>
    )
  }

  if (action === "add_note") {
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
    const sessionTitle = typeof payload.sessionTitle === "string" ? payload.sessionTitle : null
    const sessionDateTime = formatDateTime(payload.sessionDateTime)
    const userId = typeof payload.userId === "string" ? payload.userId : null
    const displayName = typeof payload.displayName === "string" && payload.displayName.trim().length > 0
      ? payload.displayName.trim()
      : typeof payload.userName === "string" && payload.userName.trim().length > 0
        ? payload.userName.trim()
        : userId
    const notes = typeof payload.notes === "string" ? payload.notes : null

    return (
      <div className="space-y-3">
        {sessionTitle && <DetailRow label="Session" value={sessionTitle} />}
        {sessionDateTime && <DetailRow label="Session time" value={sessionDateTime} />}
        {sessionId && <DetailRow label="Session ID" value={sessionId} mono />}
        {displayName && <DetailRow label="Participant" value={displayName} />}
        {userId && displayName !== userId && <DetailRow label="User ID" value={userId} mono />}
        {notes && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Note</p>
            <p className="text-sm whitespace-pre-wrap">{notes}</p>
          </div>
        )}
      </div>
    )
  }

  if (action === "add_participant" || action === "remove_participant") {
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
    const sessionTitle = typeof payload.sessionTitle === "string" ? payload.sessionTitle : null
    const sessionDateTime = formatDateTime(payload.sessionDateTime)
    const userId = typeof payload.userId === "string" ? payload.userId : null
    const displayName = typeof payload.displayName === "string" && payload.displayName.trim().length > 0
      ? payload.displayName.trim()
      : typeof payload.userName === "string" && payload.userName.trim().length > 0
        ? payload.userName.trim()
        : userId

    return (
      <div className="space-y-3">
        {sessionTitle && <DetailRow label="Session" value={sessionTitle} />}
        {sessionDateTime && <DetailRow label="Session time" value={sessionDateTime} />}
        {sessionId && <DetailRow label="Session ID" value={sessionId} mono />}
        {displayName && (
          <DetailRow
            label={action === "add_participant" ? "Add participant" : "Remove participant"}
            value={displayName}
          />
        )}
        {userId && displayName !== userId && <DetailRow label="User ID" value={userId} mono />}
      </div>
    )
  }

  if (action === "record_match_result") {
    const activityId = typeof payload.activityId === "string" ? payload.activityId : null
    const activityName = typeof payload.activityName === "string" ? payload.activityName : null
    const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
    const sessionTitle = typeof payload.sessionTitle === "string" ? payload.sessionTitle : null
    const sessionDateTime = formatDateTime(payload.sessionDateTime)
    const matchFormat = typeof payload.matchFormat === "string" ? payload.matchFormat : null
    const notes = typeof payload.notes === "string" ? payload.notes : null
    const team1 = Array.isArray(payload.team1)
      ? payload.team1.filter((member): member is string => typeof member === "string")
      : []
    const team2 = Array.isArray(payload.team2)
      ? payload.team2.filter((member): member is string => typeof member === "string")
      : []
    const team1Members = extractMemberSummaries(payload.team1Members)
    const team2Members = extractMemberSummaries(payload.team2Members)
    const displayTeam1 = team1Members.length > 0
      ? team1Members
      : team1.map((userId) => ({ userId, displayName: userId }))
    const displayTeam2 = team2Members.length > 0
      ? team2Members
      : team2.map((userId) => ({ userId, displayName: userId }))
    const hasScores = payload.scores !== undefined

    return (
      <div className="space-y-3">
        {activityName && <DetailRow label="Activity" value={activityName} />}
        {activityId && <DetailRow label="Activity ID" value={activityId} mono />}
        {sessionTitle && <DetailRow label="Session" value={sessionTitle} />}
        {sessionDateTime && <DetailRow label="Session time" value={sessionDateTime} />}
        {sessionId && <DetailRow label="Session ID" value={sessionId} mono />}
        {matchFormat && <DetailRow label="Match format" value={matchFormat} />}

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Team 1 ({displayTeam1.length})</p>
          <MemberChipList members={displayTeam1} />
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Team 2 ({displayTeam2.length})</p>
          <MemberChipList members={displayTeam2} />
        </div>

        {hasScores && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Scores</p>
            <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
              {safeJson(payload.scores)}
            </pre>
          </div>
        )}

        {notes && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="text-sm">{notes}</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <pre className="max-h-60 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">
      {safeJson(payload)}
    </pre>
  )
}

function ActionRequestCard({
  request,
  showActions,
}: {
  request: {
    id: string
    action: string
    status: string
    requestedPayload: unknown
    resolvedPayload: unknown
    transcript: string | null
    createdAt: Date | string
    executionResult: unknown
    executionError: string | null
    requestedByName?: string | null
  }
  showActions: boolean
}) {
  const utils = trpc.useUtils()
  const [rejectId, setRejectId] = useState<string | null>(null)

  const approveMutation = trpc.plugin.assistant.approveFromDashboard.useMutation({
    onSuccess: () => {
      utils.plugin.assistant.listPending.invalidate()
      utils.plugin.assistant.listHistory.invalidate()
      toast.success("Action approved and executed")
    },
    onError: (err) => {
      utils.plugin.assistant.listPending.invalidate()
      utils.plugin.assistant.listHistory.invalidate()
      toast.error(err.message)
    },
  })

  const rejectMutation = trpc.plugin.assistant.rejectFromDashboard.useMutation({
    onSuccess: () => {
      utils.plugin.assistant.listPending.invalidate()
      utils.plugin.assistant.listHistory.invalidate()
      toast.success("Action rejected")
      setRejectId(null)
    },
    onError: (err) => {
      utils.plugin.assistant.listPending.invalidate()
      utils.plugin.assistant.listHistory.invalidate()
      toast.error(err.message)
    },
  })

  const status = STATUS_STYLES[request.status] ?? { label: request.status, className: "bg-muted text-muted-foreground" }
  const actionLabel = ACTION_TYPE_LABELS[request.action] ?? request.action
  const payload = request.resolvedPayload ?? request.requestedPayload

  return (
    <>
      <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">{actionLabel}</Badge>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", status.className)}>
              {status.label}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(request.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>

        {request.requestedByName && (
          <p className="text-sm text-muted-foreground">
            Requested by <span className="font-medium text-foreground">{request.requestedByName}</span>
          </p>
        )}

        {request.transcript && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Voice transcript</p>
            <p className="text-sm italic">&ldquo;{request.transcript}&rdquo;</p>
          </div>
        )}

        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Requested changes</p>
          {renderPayloadBreakdown(request.action, payload)}
          <details className="rounded-md border bg-background/40 p-2">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Show raw payload
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto text-xs">{safeJson(payload)}</pre>
          </details>
        </div>

        {request.executionError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span className="text-destructive">{request.executionError}</span>
          </div>
        )}

        {showActions && request.status === "pending_approval" && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate({ actionRequestId: request.id })}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              <Check className="mr-1 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectId(request.id)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              <X className="mr-1 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Action Request</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the {actionLabel.toLowerCase()} request. The requesting user will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => rejectId && rejectMutation.mutate({ actionRequestId: rejectId })}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PendingQueue() {
  const { data: requests, isLoading } = trpc.plugin.assistant.listPending.useQuery({
    statuses: ["pending_approval"],
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending Requests
        </CardTitle>
        <CardDescription>
          Action requests awaiting your approval.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-40" />
              </div>
            ))}
          </div>
        ) : requests?.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">All Clear</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No pending requests. Voice commands from Telegram will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests?.map((request) => (
              <ActionRequestCard key={request.id} request={request} showActions />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function HistoryQueue() {
  const { data: requests, isLoading } = trpc.plugin.assistant.listHistory.useQuery({})

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          History
        </CardTitle>
        <CardDescription>
          Previously processed action requests.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : requests?.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No History</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Processed action requests will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests?.map((request) => (
              <ActionRequestCard key={request.id} request={request} showActions={false} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useCallback } from "react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserPlus, Check, X, Clock, Sparkles, Loader2, ClipboardList } from "lucide-react"
import { useAISummarizeJoinRequest } from "@/plugins/ai/hooks/use-ai-suggestion"

export const Route = createFileRoute("/dashboard/org/$orgId/join-requests")({
  component: JoinRequestsPage,
})

function JoinRequestsPage() {
  const { orgId } = Route.useParams()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const { data: groupRequests } = trpc.joinRequest.listPending.useQuery(
    undefined,
    { enabled: isAdmin }
  )
  const { data: activityRequests } = trpc.activityMembership.listAllPendingRequests.useQuery(
    undefined,
    { enabled: isAdmin }
  )

  const groupCount = groupRequests?.length ?? 0
  const activityCount = activityRequests?.length ?? 0

  if (whoamiLoading) {
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only group owners and admins can manage join requests.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard/org/$orgId" params={{ orgId }}>
                Back to Overview
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Join Requests</h1>
        <p className="text-muted-foreground">
          Review and manage pending requests for your group and activities
        </p>
      </div>

      <Tabs defaultValue="group">
        <TabsList>
          <TabsTrigger value="group">
            Group Requests
            {groupCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums">
                {groupCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity Requests
            {activityCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-5 rounded-full px-1.5 text-xs tabular-nums">
                {activityCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="group">
          <GroupRequestsTab />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityRequestsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function GroupRequestsTab() {
  const utils = trpc.useUtils()

  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [summarizingId, setSummarizingId] = useState<string | null>(null)

  const onSummaryComplete = useCallback(
    (text: string) => {
      if (summarizingId) {
        setSummaries((prev) => ({ ...prev, [summarizingId]: text }))
        setSummarizingId(null)
      }
    },
    [summarizingId]
  )

  const {
    suggest: summarizeRequest,
    streamedText: aiStreamedText,
    isStreaming: aiIsStreaming,
    error: aiError,
    isAvailable: aiAvailable,
  } = useAISummarizeJoinRequest({ onComplete: onSummaryComplete })

  const { data: requests, isLoading: requestsLoading } = trpc.joinRequest.listPending.useQuery()

  const approveMutation = trpc.joinRequest.approve.useMutation({
    onSuccess: () => {
      utils.joinRequest.listPending.invalidate()
      utils.organization.listMembers.invalidate()
    },
  })

  const rejectMutation = trpc.joinRequest.reject.useMutation({
    onSuccess: () => {
      utils.joinRequest.listPending.invalidate()
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Pending Requests
        </CardTitle>
        <CardDescription>
          Users waiting for approval to join your group.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requestsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            ))}
          </div>
        ) : requests?.length === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No Pending Requests</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              There are no pending join requests at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests?.map(({ request, user }) => (
              <div
                key={request.id}
                className="rounded-lg border p-4 space-y-3"
              >
                <div className="flex items-start gap-4">
                  <Avatar>
                    <AvatarImage src={user.image ?? undefined} alt={user.name} />
                    <AvatarFallback>
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </p>
                    {request.message && (
                      <p className="mt-2 text-sm text-muted-foreground italic">
                        &ldquo;{request.message}&rdquo;
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Requested {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {aiAvailable && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSummarizingId(request.id)
                          summarizeRequest({ requestId: request.id })
                        }}
                        disabled={aiIsStreaming}
                      >
                        <Sparkles className="mr-1 h-4 w-4" />
                        Summarize
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate({ requestId: request.id })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <Check className="mr-1 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejectMutation.mutate({ requestId: request.id })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
                {/* AI Summary */}
                {summarizingId === request.id && aiIsStreaming && (
                  <div className="rounded-lg border border-border/50 border-l-[3px] border-l-primary bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary">
                            Summary
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {aiStreamedText || "Analyzing applicant..."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {summaries[request.id] && !(summarizingId === request.id && aiIsStreaming) && (
                  <div className="rounded-lg border border-border/50 border-l-[3px] border-l-primary bg-primary/5 p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-primary/10 text-primary">
                            Summary
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {summaries[request.id]}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {summarizingId === request.id && aiError && (
                  <p className="text-sm text-destructive">{aiError}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {(approveMutation.error || rejectMutation.error) && (
          <p className="mt-4 text-sm text-destructive text-center">
            {approveMutation.error?.message || rejectMutation.error?.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityRequestsTab() {
  const utils = trpc.useUtils()

  const { data: requests, isLoading: requestsLoading } = trpc.activityMembership.listAllPendingRequests.useQuery()

  const approveMutation = trpc.activityMembership.approveRequest.useMutation({
    onSuccess: () => {
      utils.activityMembership.listAllPendingRequests.invalidate()
      utils.activityMembership.countAllPendingRequests.invalidate()
      utils.activity.list.invalidate()
    },
  })

  const rejectMutation = trpc.activityMembership.rejectRequest.useMutation({
    onSuccess: () => {
      utils.activityMembership.listAllPendingRequests.invalidate()
      utils.activityMembership.countAllPendingRequests.invalidate()
      utils.activity.list.invalidate()
    },
  })

  // Group requests by activity
  const grouped = new Map<string, {
    activity: { id: string; name: string; slug: string }
    items: NonNullable<typeof requests>
  }>()

  for (const item of requests ?? []) {
    const key = item.activity.id
    if (!grouped.has(key)) {
      grouped.set(key, { activity: item.activity, items: [] })
    }
    grouped.get(key)!.items.push(item)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Pending Requests
        </CardTitle>
        <CardDescription>
          Users waiting for approval to join activities.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {requestsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            ))}
          </div>
        ) : grouped.size === 0 ? (
          <div className="rounded-lg border p-8 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No Pending Requests</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              There are no pending activity join requests at this time.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.values()).map(({ activity, items }) => (
              <div key={activity.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary shrink-0">
                    {activity.name.charAt(0).toUpperCase()}
                  </span>
                  <h3 className="font-semibold">{activity.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    {items.length} pending
                  </Badge>
                </div>
                <div className="space-y-3 pl-8">
                  {items.map(({ request, user }) => (
                    <div
                      key={request.id}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-start gap-4">
                        <Avatar>
                          <AvatarImage src={user.image ?? undefined} alt={user.name} />
                          <AvatarFallback>
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user.email}
                          </p>
                          {request.message && (
                            <p className="mt-2 text-sm text-muted-foreground italic">
                              &ldquo;{request.message}&rdquo;
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Requested {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate({ requestId: request.id })}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectMutation.mutate({ requestId: request.id })}
                            disabled={approveMutation.isPending || rejectMutation.isPending}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {(approveMutation.error || rejectMutation.error) && (
          <p className="mt-4 text-sm text-destructive text-center">
            {approveMutation.error?.message || rejectMutation.error?.message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

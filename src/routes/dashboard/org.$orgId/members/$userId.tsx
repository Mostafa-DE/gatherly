import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  History,
  User,
  XCircle,
  MoreVertical,
  Shield,
  Users,
  UserMinus,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { FormField } from "@/types/form"
import { RoleBadge } from "@/components/role-badge"
import { EngagementStatsCard } from "@/components/engagement-stats"
import { MemberNotesSection } from "@/components/member-notes"
import { useAISummarizeMemberProfile } from "@/plugins/ai/hooks/use-ai-suggestion"
import { MemberRankCards } from "@/plugins/ranking/components/member-rank-cards"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/members/$userId"
)({
  component: MemberDetailPage,
})

function MemberDetailPage() {
  const { orgId, userId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin =
    whoami?.membership?.role === "owner" ||
    whoami?.membership?.role === "admin"

  const { data: members } = trpc.organization.listMembers.useQuery(undefined, {
    enabled: isAdmin,
  })

  const { data: profile } = trpc.groupMemberProfile.getUserProfile.useQuery(
    { userId },
    { enabled: isAdmin }
  )

  const { data: stats, isLoading: statsLoading } =
    trpc.groupMemberProfile.getUserStats.useQuery(
      { userId },
      { enabled: isAdmin }
    )

  const member = members?.find((m) => m.user.id === userId)
  const nickname = (profile as { nickname?: string | null } | null)?.nickname

  const removeMutation = trpc.organization.removeMember.useMutation({
    onSuccess: () => {
      utils.organization.listMembers.invalidate()
      navigate({
        to: "/dashboard/org/$orgId/members",
        params: { orgId },
      })
    },
  })

  const updateRoleMutation = trpc.organization.updateMemberRole.useMutation({
    onSuccess: () => {
      utils.organization.listMembers.invalidate()
    },
  })

  const [confirmRemove, setConfirmRemove] = useState(false)

  if (whoamiLoading) {
    return (
      <div className="space-y-8 py-6">
        <Skeleton className="h-6 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
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
          Only group owners and admins can view member details.
        </p>
        <Button asChild>
          <Link to="/dashboard/org/$orgId" params={{ orgId }}>
            Back to Overview
          </Link>
        </Button>
      </div>
    )
  }

  const isCurrentUser = member?.user.id === whoami?.user?.id
  const canManage = member && member.member.role !== "owner" && !isCurrentUser

  return (
    <div className="space-y-6 py-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/dashboard/org/$orgId/members" params={{ orgId }}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Members
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage
              src={member?.user.image ?? undefined}
              alt={member?.user.name}
            />
            <AvatarFallback className="bg-primary/10 text-primary">
              {member?.user.name?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {member?.user.name ?? "Member"}
              </h1>
              {member && <RoleBadge role={member.member.role} />}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              <span>{member?.user.email}</span>
              {nickname && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span>
                    Nickname: <span className="font-medium text-foreground">{nickname}</span>
                  </span>
                </>
              )}
              {member?.member.createdAt && (
                <>
                  <span className="hidden sm:inline">·</span>
                  <span>
                    Joined{" "}
                    {new Date(member.member.createdAt).toLocaleDateString(
                      undefined,
                      { month: "long", year: "numeric" }
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {member.member.role === "member" && (
                <DropdownMenuItem
                  onClick={() =>
                    updateRoleMutation.mutate({
                      memberId: member.member.id,
                      role: "admin",
                    })
                  }
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Make Admin
                </DropdownMenuItem>
              )}
              {member.member.role === "admin" && (
                <DropdownMenuItem
                  onClick={() =>
                    updateRoleMutation.mutate({
                      memberId: member.member.id,
                      role: "member",
                    })
                  }
                >
                  <Users className="mr-2 h-4 w-4" />
                  Remove Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setConfirmRemove(true)}
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Remove Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Confirm remove */}
      {confirmRemove && member && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
          <p className="flex-1 text-sm text-destructive">
            Remove {member.user.name} from this group?
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => removeMutation.mutate({ memberId: member.member.id })}
            disabled={removeMutation.isPending}
          >
            {removeMutation.isPending ? "Removing..." : "Remove"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
            Cancel
          </Button>
        </div>
      )}

      {(removeMutation.error || updateRoleMutation.error) && (
        <p className="text-sm text-destructive">
          {removeMutation.error?.message || updateRoleMutation.error?.message}
        </p>
      )}

      {/* Engagement Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <EngagementStatsCard stats={stats} />
      ) : null}

      {/* AI Summary */}
      <MemberAISummary userId={userId} />

      {/* Profile Fields */}
      <MemberProfileSection userId={userId} />

      {/* Rankings */}
      <MemberRankCards userId={userId} />

      {/* Admin Notes */}
      <MemberNotesSection targetUserId={userId} />

      {/* Participation History */}
      <MemberParticipationHistory userId={userId} orgId={orgId} />
    </div>
  )
}

function getAISummaryCacheKey(orgId: string, userId: string) {
  return `gatherly:ai-summary:${orgId}:${userId}`
}

function MemberAISummary({ userId }: { userId: string }) {
  const { orgId } = Route.useParams()
  const cacheKey = getAISummaryCacheKey(orgId, userId)

  const [summaryText, setSummaryText] = useState(() => {
    try {
      return localStorage.getItem(cacheKey) ?? ""
    } catch {
      return ""
    }
  })

  const onComplete = useCallback((text: string) => {
    setSummaryText(text)
    try {
      localStorage.setItem(cacheKey, text)
    } catch {
      // localStorage full or unavailable — ignore
    }
  }, [cacheKey])

  const {
    suggest,
    streamedText,
    isStreaming,
    isPending,
    error,
    isAvailable,
  } = useAISummarizeMemberProfile({ onComplete: onComplete })

  if (!isAvailable) return null

  const hasCached = summaryText.length > 0
  const displayText = isStreaming ? streamedText : summaryText

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">AI Summary</h2>
            <p className="text-sm text-muted-foreground">
              AI-generated member overview
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => suggest({ userId })}
          disabled={isPending}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {isPending ? "Generating..." : hasCached ? "Regenerate" : "Generate Summary"}
        </Button>
      </div>
      {displayText && (
        <p className="text-sm leading-relaxed">{displayText}</p>
      )}
      {!displayText && !isPending && (
        <p className="text-sm text-muted-foreground">
          Click &ldquo;Generate Summary&rdquo; to create an AI-powered overview of this member.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

function MemberProfileSection({ userId }: { userId: string }) {
  const { data: settings } = trpc.organizationSettings.get.useQuery({})
  const { data: profile, isLoading } =
    trpc.groupMemberProfile.getUserProfile.useQuery({ userId })

  const joinFormSchema = settings?.joinFormSchema as {
    fields?: FormField[]
  } | null
  const formFields = joinFormSchema?.fields || []
  const answers = (profile?.answers as Record<string, unknown>) || {}

  if (formFields.length === 0) return null

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Group Profile</h2>
          <p className="text-sm text-muted-foreground">
            Custom profile fields for this group
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-48" />
            </div>
          ))}
        </div>
      ) : Object.keys(answers).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This member hasn't filled out their profile yet.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {formFields.map((field) => {
            const value = answers[field.id]
            if (value === undefined || value === null || value === "")
              return null
            return (
              <div
                key={field.id}
                className="rounded-lg border border-border/50 bg-background/50 p-4"
              >
                <p className="text-sm font-medium text-muted-foreground">
                  {field.label}
                </p>
                <p className="mt-1 font-medium">
                  {Array.isArray(value) ? value.join(", ") : String(value)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const statusColors: Record<string, string> = {
  joined: "bg-green-500/10 text-green-600",
  waitlisted: "bg-yellow-500/10 text-yellow-600",
  cancelled: "bg-muted text-muted-foreground",
}

const attendanceColors: Record<string, string> = {
  show: "bg-green-500/10 text-green-600",
  no_show: "bg-destructive/10 text-destructive",
  pending: "bg-muted text-muted-foreground",
}

function MemberParticipationHistory({
  userId,
  orgId,
}: {
  userId: string
  orgId: string
}) {
  const [limit, setLimit] = useState(10)

  const {
    data: history,
    isLoading,
    isFetching,
  } = trpc.participation.userHistory.useQuery({
    userId,
    limit,
    offset: 0,
  })

  const hasMore = history && history.length === limit

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <History className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Participation History</h2>
          <p className="text-sm text-muted-foreground">
            Session attendance in this group
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-border/50 bg-background/50 p-4"
            >
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {history && history.length === 0 && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium">No History Yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This member hasn't participated in any sessions yet.
          </p>
        </div>
      )}

      {history && history.length > 0 && (
        <div className="space-y-3">
          {history.map((item) => (
            <Link
              key={item.participation.id}
              to="/dashboard/org/$orgId/sessions/$sessionId"
              params={{ orgId, sessionId: item.session.id }}
              className="group block rounded-lg border border-border/50 bg-background/50 p-4 transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <span className="font-medium group-hover:text-primary">
                    {item.session.title}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(item.session.dateTime).toLocaleDateString(
                      undefined,
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      statusColors[item.participation.status] ||
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.participation.status}
                  </span>
                  {item.participation.attendance !== "pending" && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        attendanceColors[item.participation.attendance] ||
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.participation.attendance === "show"
                        ? "Present"
                        : "No Show"}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="ghost"
            onClick={() => setLimit((prev) => prev + 10)}
            disabled={isFetching}
          >
            <ChevronDown className="h-4 w-4 mr-2" />
            {isFetching ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}

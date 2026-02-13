import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { trpc } from "@/lib/trpc"
import { useSession, organization as orgClient } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Users, Lock, UserPlus, Clock, CheckCircle, Layers } from "lucide-react"
import type { FormField } from "@/types/form"
import { JoinFormField } from "@/components/join-form-field"

export const Route = createFileRoute(
  "/$username/$groupSlug/activities/$activitySlug"
)({
  component: ActivityDetailPage,
})

function ActivityDetailPage() {
  const { username, groupSlug, activitySlug } = Route.useParams()
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = useSession()
  const isLoggedIn = !sessionPending && !!session?.user
  const utils = trpc.useUtils()

  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({})
  const [formError, setFormError] = useState("")
  const [isOrgContextReady, setIsOrgContextReady] = useState(false)

  // Get org info
  const { data: org, isLoading: orgLoading, error: orgError } =
    trpc.organization.getPublicInfo.useQuery({ username, groupSlug })

  // Get activity info
  const { data: activity, isLoading: activityLoading, error: activityError } =
    trpc.activity.getPublicBySlug.useQuery(
      { organizationId: org?.id ?? "", slug: activitySlug },
      { enabled: !!org?.id }
    )

  // Check if user is org member
  const { data: myOrgs } = trpc.user.myOrgs.useQuery(undefined, {
    enabled: !!session?.user,
  })
  const isOrgMember = myOrgs?.some((m) => m.organization.id === org?.id)

  useEffect(() => {
    let cancelled = false

    async function syncActiveOrganization() {
      if (!session?.user || !org?.id || !isOrgMember) {
        if (!cancelled) {
          setIsOrgContextReady(false)
        }
        return
      }

      try {
        await orgClient.setActive({ organizationId: org.id })
        if (!cancelled) {
          setIsOrgContextReady(true)
        }
      } catch {
        if (!cancelled) {
          setIsOrgContextReady(false)
        }
      }
    }

    void syncActiveOrganization()

    return () => {
      cancelled = true
    }
  }, [session?.user, org?.id, isOrgMember])

  // Check if user is activity member (via myMemberships - requires org context)
  // We'll check activity membership status separately
  const { data: activityMemberships } = trpc.activityMembership.myMemberships.useQuery(
    undefined,
    { enabled: !!session?.user && isOrgMember === true && isOrgContextReady }
  )
  const myActivityMembership = activityMemberships?.find(
    (m) => m.membership.activityId === activity?.id
  )
  const isActivityMember = myActivityMembership?.membership.status === "active"
  const isPendingMember = myActivityMembership?.membership.status === "pending"

  // Join mutations
  const joinMutation = trpc.activityMembership.join.useMutation({
    onSuccess: () => {
      utils.activityMembership.myMemberships.invalidate()
    },
  })

  const requestJoinMutation = trpc.activityMembership.requestJoin.useMutation({
    onSuccess: () => {
      utils.activityMembership.myMemberships.invalidate()
    },
  })

  const formFields =
    (activity?.joinFormSchema as { fields?: FormField[] } | null)?.fields || []

  const handleAnswerChange = (fieldId: string, value: unknown) => {
    setFormAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  const validateForm = (): boolean => {
    setFormError("")
    for (const field of formFields) {
      if (field.required) {
        const value = formAnswers[field.id]
        if (
          value === undefined ||
          value === null ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        ) {
          setFormError(`"${field.label}" is required`)
          return false
        }
      }
    }
    return true
  }

  const handleJoin = async () => {
    if (!session?.user) {
      navigate({
        to: "/login",
        search: { redirect: `/${username}/${groupSlug}/activities/${activitySlug}` },
      })
      return
    }
    if (!activity) return

    if (!org?.id || !isOrgMember) {
      setFormError("You need to join the group first")
      return
    }

    try {
      await orgClient.setActive({ organizationId: org.id })
      setIsOrgContextReady(true)
    } catch {
      setFormError("Unable to select this group. Please try again.")
      return
    }

    if (!validateForm()) return

    const answers =
      Object.keys(formAnswers).length > 0 ? formAnswers : undefined

    if (activity.joinMode === "open") {
      joinMutation.mutate({ activityId: activity.id })
    } else if (activity.joinMode === "require_approval") {
      requestJoinMutation.mutate({
        activityId: activity.id,
        formAnswers: answers,
      })
    }
  }

  const isLoading = orgLoading || activityLoading

  if (isLoading) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="flex min-h-screen items-center justify-center p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Skeleton className="mx-auto h-12 w-12 rounded-lg" />
              <Skeleton className="mx-auto mt-4 h-8 w-48" />
              <Skeleton className="mx-auto mt-2 h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  if (orgError || !org || activityError || !activity) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="flex min-h-screen items-center justify-center p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Activity Not Found</CardTitle>
              <CardDescription>
                The activity you're looking for doesn't exist or has been removed.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button asChild>
                <Link
                  to="/$username/$groupSlug"
                  params={{ username, groupSlug }}
                >
                  Back to Group
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    )
  }

  const canJoin =
    session?.user &&
    isOrgMember &&
    isOrgContextReady &&
    !isActivityMember &&
    !isPendingMember &&
    activity.joinMode !== "invite"

  return (
    <>
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
      <div className="flex min-h-screen items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
              <Layers className="h-7 w-7 text-primary" />
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {org.name}
            </div>
            <CardTitle className="text-2xl">{activity.name}</CardTitle>
            <CardDescription>
              <Badge variant="secondary" className="mt-1">
                {activity.joinMode === "open"
                  ? "Open"
                  : activity.joinMode === "require_approval"
                    ? "Approval Required"
                    : "Invite Only"}
              </Badge>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Not authenticated */}
            {!session?.user && (
              <Button
                onClick={() =>
                  navigate({
                    to: "/login",
                    search: {
                      redirect: `/${username}/${groupSlug}/activities/${activitySlug}`,
                    },
                  })
                }
                className="w-full"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Sign in to Join
              </Button>
            )}

            {/* Not an org member */}
            {session?.user && !isOrgMember && (
              <div className="space-y-3 text-center">
                <p className="text-sm text-muted-foreground">
                  You need to join the group first
                </p>
                <Button asChild className="w-full">
                  <Link
                    to="/$username/$groupSlug"
                    params={{ username, groupSlug }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Join Group First
                  </Link>
                </Button>
              </div>
            )}

            {/* Already an activity member */}
            {session?.user && isOrgMember && isActivityMember && (
              <Button disabled className="w-full">
                <CheckCircle className="mr-2 h-4 w-4" />
                You're a Member
              </Button>
            )}

            {/* Pending request */}
            {session?.user && isOrgMember && isPendingMember && (
              <Button disabled className="w-full">
                <Clock className="mr-2 h-4 w-4" />
                Request Pending
              </Button>
            )}

            {/* Invite only */}
            {session?.user &&
              isOrgMember &&
              !isActivityMember &&
              !isPendingMember &&
              activity.joinMode === "invite" && (
                <Button disabled className="w-full">
                  <Lock className="mr-2 h-4 w-4" />
                  Invite Only
                </Button>
              )}

            {/* Can join - show form + button */}
            {canJoin && (
              <>
                {formFields.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-center">
                        Complete the form to join
                      </p>
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
                          onChange={(value) =>
                            handleAnswerChange(field.id, value)
                          }
                        />
                      ))}
                    </div>
                    <Separator />
                  </>
                )}

                {activity.joinMode === "open" && (
                  <Button
                    onClick={handleJoin}
                    disabled={joinMutation.isPending}
                    className="w-full"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {joinMutation.isPending ? "Joining..." : "Join Activity"}
                  </Button>
                )}

                {activity.joinMode === "require_approval" && (
                  <Button
                    onClick={handleJoin}
                    disabled={requestJoinMutation.isPending}
                    className="w-full"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {requestJoinMutation.isPending
                      ? "Requesting..."
                      : "Request to Join"}
                  </Button>
                )}
              </>
            )}

            {/* Error/success messages */}
            {joinMutation.error && (
              <p className="text-sm text-destructive text-center">
                {joinMutation.error.message}
              </p>
            )}
            {requestJoinMutation.error && (
              <p className="text-sm text-destructive text-center">
                {requestJoinMutation.error.message}
              </p>
            )}
            {requestJoinMutation.isSuccess && (
              <p className="text-sm text-muted-foreground text-center">
                Your request has been submitted. You'll be notified when an
                admin reviews it.
              </p>
            )}
          </CardContent>

          <CardFooter className="justify-center gap-2">
            <Button variant="ghost" asChild>
              <Link
                to="/$username/$groupSlug/activities"
                params={{ username, groupSlug }}
              >
                All Activities
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link
                to="/$username/$groupSlug"
                params={{ username, groupSlug }}
              >
                Back to Group
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}

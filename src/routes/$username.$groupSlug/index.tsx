import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { useSession, organization as orgClient } from "@/auth/client"
import { LandingNavbar } from "@/components/landing/landing-navbar"
import { ShareDialog } from "@/components/share-dialog"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Users, Lock, UserPlus, Clock, CheckCircle, LinkIcon } from "lucide-react"
import type { FormField } from "@/types/form"
import { JoinFormField } from "@/components/join-form-field"
import { buildOrgUrl } from "@/lib/share-urls"
import { toast } from "sonner"
import { navigateToRedirect } from "@/lib/redirect-utils"

type OrgSearchParams = {
  invite?: string
  redirect?: string
}

export const Route = createFileRoute("/$username/$groupSlug/")({
  component: PublicOrgPage,
  validateSearch: (search: Record<string, unknown>): OrgSearchParams => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
})

function PublicOrgPage() {
  const { username, groupSlug } = Route.useParams()
  const { invite: inviteToken, redirect: redirectTo } = Route.useSearch()
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = useSession()
  const isLoggedIn = !sessionPending && !!session?.user
  const utils = trpc.useUtils()

  // Form state
  const [formAnswers, setFormAnswers] = useState<Record<string, unknown>>({})
  const [formError, setFormError] = useState("")

  // Get public org info
  const { data: org, isLoading: orgLoading, error: orgError } = trpc.organization.getPublicInfo.useQuery(
    { username, groupSlug }
  )

  // Get join form schema (only if org is loaded)
  const { data: formSchemaData } = trpc.organization.getJoinFormSchema.useQuery(
    { organizationId: org?.id ?? "" },
    { enabled: !!org?.id }
  )

  // Check if user has a pending join request (only if authenticated)
  const { data: pendingRequest } = trpc.joinRequest.myPendingRequest.useQuery(
    { organizationId: org?.id ?? "" },
    { enabled: !!session?.user && !!org?.id }
  )

  // Check if user is already a member
  const { data: myOrgs } = trpc.user.myOrgs.useQuery(undefined, {
    enabled: !!session?.user,
  })
  const isMember = myOrgs?.some((m) => m.organization.id === org?.id)

  // Join org mutation (for open mode)
  const joinOrgMutation = trpc.organization.joinOrg.useMutation({
    onSuccess: async () => {
      if (org?.id) {
        await orgClient.setActive({ organizationId: org.id })
      }
      await utils.user.myOrgs.invalidate()
      navigateToRedirect(navigate, redirectTo, "/dashboard")
    },
  })

  // Request to join mutation (for approval mode)
  const requestJoinMutation = trpc.joinRequest.request.useMutation({
    onSuccess: () => {
      utils.joinRequest.myPendingRequest.invalidate()
      if (redirectTo) {
        navigateToRedirect(navigate, redirectTo, `/${username}/${groupSlug}`)
      }
    },
  })

  // Invite token validation
  const { data: inviteValidation } = trpc.inviteLink.validate.useQuery(
    { token: inviteToken ?? "" },
    { enabled: !!inviteToken }
  )
  const hasInviteToken = !!inviteToken
  const isInviteValid = hasInviteToken && inviteValidation?.valid === true
  const isInviteInvalid = hasInviteToken && inviteValidation?.valid === false

  // Use invite token mutation
  const useTokenMutation = trpc.inviteLink.useToken.useMutation({
    onSuccess: async () => {
      if (org?.id) {
        await orgClient.setActive({ organizationId: org.id })
      }
      await utils.user.myOrgs.invalidate()
      toast.success("You've joined the group!")
      navigateToRedirect(navigate, redirectTo, "/dashboard")
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const handleJoinViaInvite = () => {
    if (!inviteToken) return
    if (!validateForm()) return
    const answers = Object.keys(formAnswers).length > 0 ? formAnswers : undefined
    useTokenMutation.mutate({ token: inviteToken, formAnswers: answers })
  }

  const formFields = (formSchemaData?.joinFormSchema as { fields?: FormField[] } | null)?.fields || []

  // Check if user can join (show form)
  const canJoinNormally = !hasInviteToken && session?.user && !isMember && !pendingRequest &&
    (org?.defaultJoinMode === "open" || org?.defaultJoinMode === "approval")
  const canJoinViaInvite = session?.user && !isMember && isInviteValid
  const canJoin = canJoinNormally || canJoinViaInvite

  const handleAnswerChange = (fieldId: string, value: unknown) => {
    setFormAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  const validateForm = (): boolean => {
    setFormError("")

    for (const field of formFields) {
      if (field.required) {
        const value = formAnswers[field.id]
        if (value === undefined || value === null || value === "" ||
            (Array.isArray(value) && value.length === 0)) {
          setFormError(`"${field.label}" is required`)
          return false
        }
      }
    }
    return true
  }

  const handleJoin = () => {
    if (!session?.user) {
      navigate({ to: "/login", search: { redirect: `/${username}/${groupSlug}` } })
      return
    }

    if (!validateForm()) {
      return
    }

    const answers = Object.keys(formAnswers).length > 0 ? formAnswers : undefined

    if (org?.defaultJoinMode === "open") {
      joinOrgMutation.mutate({ organizationId: org.id, formAnswers: answers })
    } else if (org?.defaultJoinMode === "approval") {
      requestJoinMutation.mutate({ organizationId: org.id, formAnswers: answers })
    }
  }

  if (orgLoading) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="flex min-h-screen items-center justify-center p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <Skeleton className="mx-auto h-16 w-16 rounded-full" />
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

  if (orgError || !org) {
    return (
      <>
        <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
        <div className="flex min-h-screen items-center justify-center p-4 pt-20">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle>Group Not Found</CardTitle>
              <CardDescription>
                The group you're looking for doesn't exist or has been removed.
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Button asChild>
                <Link to="/">Go Home</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    )
  }

  const getJoinModeLabel = () => {
    switch (org.defaultJoinMode) {
      case "open":
        return <Badge variant="secondary">Open</Badge>
      case "approval":
        return <Badge variant="secondary">Requires Approval</Badge>
      case "invite":
        return <Badge variant="outline">Invite Only</Badge>
      default:
        return null
    }
  }

  const renderJoinButton = () => {
    // Invite token takes priority — direct join regardless of org join mode
    if (canJoinViaInvite) {
      return (
        <Button
          onClick={handleJoinViaInvite}
          disabled={useTokenMutation.isPending}
          className="w-full"
        >
          <LinkIcon className="mr-2 h-4 w-4" />
          {useTokenMutation.isPending ? "Joining..." : "Join via Invite"}
        </Button>
      )
    }
    if (org.defaultJoinMode === "open") {
      return (
        <Button
          onClick={handleJoin}
          disabled={joinOrgMutation.isPending}
          className="w-full"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {joinOrgMutation.isPending ? "Joining..." : "Join Group"}
        </Button>
      )
    }
    if (org.defaultJoinMode === "approval") {
      return (
        <Button
          onClick={handleJoin}
          disabled={requestJoinMutation.isPending}
          className="w-full"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {requestJoinMutation.isPending ? "Requesting..." : "Request to Join"}
        </Button>
      )
    }
    return null
  }

  return (
    <>
      <LandingNavbar isLoggedIn={isLoggedIn} isAuthLoading={sessionPending} />
      <div className="flex min-h-screen items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Avatar className="mx-auto h-16 w-16">
              <AvatarImage src={org.logo ?? undefined} alt={org.name} />
              <AvatarFallback>
                <Users className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
          <div className="mt-4 text-sm text-muted-foreground">
            @{username}
          </div>
          <CardTitle className="text-2xl">{org.name}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
          </CardDescription>
          <div className="mt-2">{getJoinModeLabel()}</div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Invite banner */}
          {isInviteValid && !isMember && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-primary/30 bg-primary/5 text-sm">
              <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-primary font-medium">
                You've been invited to join this group
              </span>
            </div>
          )}
          {isInviteInvalid && !isMember && (
            <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-sm">
              <Lock className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-destructive font-medium">
                This invite link is invalid, expired, deactivated, or already used.
              </span>
            </div>
          )}

          {/* Not authenticated */}
          {!session?.user && (
            <Button
              onClick={() => {
                const currentPath = inviteToken
                  ? `/${username}/${groupSlug}?invite=${inviteToken}`
                  : `/${username}/${groupSlug}`
                const redirectParam = redirectTo
                  ? `${currentPath}${currentPath.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(redirectTo)}`
                  : currentPath
                navigate({ to: "/login", search: { redirect: redirectParam } })
              }}
              className="w-full"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {hasInviteToken ? "Sign in to Accept Invite" : "Sign in to Join"}
            </Button>
          )}

          {/* Already a member */}
          {session?.user && isMember && (
            <Button asChild className="w-full">
              <Link to="/dashboard">
                <CheckCircle className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          )}

          {/* Pending request */}
          {session?.user && !isMember && pendingRequest && !isInviteValid && (
            <Button disabled className="w-full">
              <Clock className="mr-2 h-4 w-4" />
              Request Pending
            </Button>
          )}

          {/* Invite only (no invite token) */}
          {session?.user && !isMember && !pendingRequest && !isInviteValid && org.defaultJoinMode === "invite" && (
            <Button disabled className="w-full">
              <Lock className="mr-2 h-4 w-4" />
              Invite Only
            </Button>
          )}

          {/* Can join - show form if exists */}
          {canJoin && (
            <>
              {formFields.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-center">
                      Complete your profile to join
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
                        onChange={(value) => handleAnswerChange(field.id, value)}
                      />
                    ))}
                  </div>
                  <Separator />
                </>
              )}

              {renderJoinButton()}
            </>
          )}

          {/* Error messages */}
          {joinOrgMutation.error && (
            <p className="text-sm text-destructive text-center">
              {joinOrgMutation.error.message}
            </p>
          )}
          {requestJoinMutation.error && (
            <p className="text-sm text-destructive text-center">
              {requestJoinMutation.error.message}
            </p>
          )}
          {requestJoinMutation.isSuccess && (
            <p className="text-sm text-muted-foreground text-center">
              Your request has been submitted. You'll be notified when an admin reviews it.
            </p>
          )}
        </CardContent>

        <CardFooter className="justify-center gap-2">
          <ShareDialog url={buildOrgUrl(username, groupSlug)} title={org.name} username={username} />
          <Button variant="ghost" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
    </>
  )
}

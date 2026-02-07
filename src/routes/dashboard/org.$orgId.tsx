import { createFileRoute, Outlet } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { organization as orgClient } from "@/auth/client"
import { trpc } from "@/lib/trpc"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "@tanstack/react-router"
import { AlertCircle, X } from "lucide-react"
import type { FormField } from "@/types/form"

export const Route = createFileRoute("/dashboard/org/$orgId")({
  component: OrgLayout,
})

function OrgLayout() {
  const { orgId } = Route.useParams()
  const utils = trpc.useUtils()
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const { data: orgs, isLoading: orgsLoading } = trpc.user.myOrgs.useQuery()
  const { data: whoami } = trpc.user.whoami.useQuery()

  // Fetch org settings and user profile to check for incomplete profile
  const { data: settings } = trpc.organizationSettings.get.useQuery(
    {},
    { enabled: !!whoami?.activeOrganization?.id && whoami.activeOrganization.id === orgId }
  )
  const { data: myProfile } = trpc.groupMemberProfile.myProfile.useQuery(
    {},
    { enabled: !!whoami?.activeOrganization?.id && whoami.activeOrganization.id === orgId }
  )

  // Check if user is a member of this org
  const membership = orgs?.find((o) => o.organization.id === orgId)

  // Set active org when visiting
  useEffect(() => {
    if (!membership || whoami?.activeOrganization?.id === orgId) {
      return
    }

    let isCancelled = false

    const syncActiveOrganization = async () => {
      await orgClient.setActive({ organizationId: orgId })
      if (isCancelled) {
        return
      }

      await utils.invalidate()
    }

    void syncActiveOrganization()

    return () => {
      isCancelled = true
    }
  }, [orgId, membership, whoami?.activeOrganization?.id, utils])

  if (orgsLoading) {
    return (
      <div className="space-y-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    )
  }

  if (!membership) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have access to this group.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You may not be a member of this group, or the group
              may not exist.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  // Calculate unfilled optional fields
  const formFields = (settings?.joinFormSchema as { fields?: FormField[] } | null)?.fields || []
  const profileData = (myProfile?.answers as Record<string, unknown>) || {}
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const isFieldEmpty = (value: unknown) =>
    value === undefined || value === null || value === "" ||
    (Array.isArray(value) && value.length === 0)

  const unfilledRequiredFields = formFields.filter((f) =>
    f.required && isFieldEmpty(profileData[f.id])
  )

  const unfilledOptionalFields = formFields.filter((f) =>
    !f.required && isFieldEmpty(profileData[f.id])
  )

  const hasUnfilledRequired = unfilledRequiredFields.length > 0
  const hasUnfilledOptional = unfilledOptionalFields.length > 0

  // Required fields: always show (not dismissable), for all members
  // Optional fields: dismissable, non-admins only
  const showRequiredBanner = hasUnfilledRequired
  const showOptionalBanner = !isAdmin && !bannerDismissed && !hasUnfilledRequired && hasUnfilledOptional

  return (
    <>
      {showRequiredBanner && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border-2 border-destructive bg-destructive/20 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <span className="text-sm font-medium">
              Complete your profile — <strong>{unfilledRequiredFields.length} required field{unfilledRequiredFields.length !== 1 ? "s" : ""}</strong>
              {hasUnfilledOptional && ` and ${unfilledOptionalFields.length} optional`} remaining
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="destructive" asChild>
              <Link to="/dashboard/org/$orgId/profile" params={{ orgId }} hash="group-profile">
                Update Profile
              </Link>
            </Button>
          </div>
        </div>
      )}
      {showOptionalBanner && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-lg border-2 border-primary bg-primary/20 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="text-sm font-medium">
              Complete your profile — {unfilledOptionalFields.length} optional field{unfilledOptionalFields.length !== 1 ? "s" : ""} remaining
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" asChild>
              <Link to="/dashboard/org/$orgId/profile" params={{ orgId }} hash="group-profile">
                Update Profile
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setBannerDismissed(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </div>
      )}
      <Outlet />
    </>
  )
}

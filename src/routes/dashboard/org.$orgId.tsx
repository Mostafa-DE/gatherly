import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
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

export const Route = createFileRoute("/dashboard/org/$orgId")({
  component: OrgLayout,
})

function OrgLayout() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const { data: orgs, isLoading: orgsLoading } = trpc.user.myOrgs.useQuery()
  const { data: whoami } = trpc.user.whoami.useQuery()

  // Check if user is a member of this org
  const membership = orgs?.find((o) => o.organization.id === orgId)

  // Set active org when visiting
  useEffect(() => {
    if (membership && whoami?.activeOrganization?.id !== orgId) {
      orgClient.setActive({ organizationId: orgId }).then(() => {
        utils.user.whoami.invalidate()
      })
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
              You don't have access to this organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You may not be a member of this organization, or the organization
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

  return <Outlet />
}

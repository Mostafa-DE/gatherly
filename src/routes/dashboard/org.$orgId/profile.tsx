import { createFileRoute } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { User } from "lucide-react"

export const Route = createFileRoute("/dashboard/org/$orgId/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const { data: whoami, isLoading } = trpc.user.whoami.useQuery()

  if (isLoading) {
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

  const user = whoami?.user

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          View and edit your profile for this organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Your profile details for this organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">Name</p>
              <p className="text-sm text-muted-foreground">{user?.name}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Email</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="rounded-lg border p-8 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Group Profile</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Custom profile fields for this organization are coming soon.
              You'll be able to fill out organization-specific profile
              information here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

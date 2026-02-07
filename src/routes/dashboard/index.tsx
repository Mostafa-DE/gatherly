import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { organization as orgClient } from "@/auth/client"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Plus,
  ArrowRight,
  Clock,
  X,
  Calendar,
  Users,
  Sparkles,
} from "lucide-react"

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHomePage,
})

function DashboardHomePage() {
  const { data: orgs, isLoading } = trpc.user.myOrgs.useQuery()

  return (
    <div className="space-y-10 py-6">
      <PendingJoinRequests />

      {/* Hero Section */}
      <div>
        {/* Badge */}
        <div className="mb-4 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary">
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Your Dashboard
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Gatherly
              </span>
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
              Select a group to manage or create a new one to start organizing your
              sessions.
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard/groups/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Link>
          </Button>
        </div>
      </div>

      {/* Groups Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="mt-1 h-4 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : orgs && orgs.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((item) => (
            <OrgCard key={item.organization.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold">No Groups Yet</h3>
          <p className="mt-2 text-muted-foreground max-w-md mx-auto">
            Create your first group to start managing sessions and members.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Create sessions
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Manage members
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Track attendance
            </div>
          </div>
          <Button asChild className="mt-6">
            <Link to="/dashboard/groups/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Group
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}

type OrgCardProps = {
  item: {
    organization: {
      id: string
      name: string
      slug: string
      userSlug: string
      ownerUsername: string
      defaultJoinMode: string | null
    }
    role: string
  }
}

function OrgCard({ item }: OrgCardProps) {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const handleClick = async () => {
    await orgClient.setActive({ organizationId: item.organization.id })
    await utils.invalidate()
    navigate({
      to: "/dashboard/org/$orgId",
      params: { orgId: item.organization.id },
    })
  }

  return (
    <button
      onClick={handleClick}
      className="group flex flex-col rounded-xl border border-border/50 bg-card/50 p-6 text-left backdrop-blur-sm transition-all hover:border-primary/50 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold">{item.organization.name}</h3>
            <p className="text-sm text-muted-foreground">
              /{item.organization.ownerUsername}/{item.organization.userSlug}
            </p>
          </div>
        </div>
        <Badge
          variant="secondary"
          className="capitalize bg-primary/10 text-primary border-0"
        >
          {item.role}
        </Badge>
      </div>
      <div className="mt-auto pt-4">
        <span className="inline-flex items-center text-sm font-medium text-primary">
          Open dashboard
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </button>
  )
}

function PendingJoinRequests() {
  const utils = trpc.useUtils()
  const { data: requests, isLoading } = trpc.joinRequest.myRequests.useQuery()

  const cancelRequest = trpc.joinRequest.cancel.useMutation({
    onSuccess: () => {
      utils.joinRequest.myRequests.invalidate()
    },
  })

  const pendingRequests =
    requests?.filter((r) => r.request.status === "pending") || []

  if (isLoading || pendingRequests.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-yellow-600">
        <Clock className="h-5 w-5" />
        <h3 className="font-semibold">Pending Join Requests</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Your requests to join groups that are awaiting approval
      </p>

      <div className="mt-4 space-y-3">
        {pendingRequests.map((item) => (
          <div
            key={item.request.id}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">{item.organization?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Requested{" "}
                  {new Date(item.request.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-yellow-500/10 text-yellow-600 border-0"
              >
                Pending
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  cancelRequest.mutate({ requestId: item.request.id })
                }
                disabled={cancelRequest.isPending}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Cancel request</span>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

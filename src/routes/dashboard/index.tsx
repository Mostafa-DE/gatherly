import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { organization as orgClient } from "@/auth/client"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
          <CreateOrgCard />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CreateOrgForm />
          <div className="rounded-xl border border-border/50 bg-card/50 p-8 backdrop-blur-sm">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Get Started</h3>
            <p className="mt-2 text-muted-foreground">
              Create your first group to start managing sessions and members.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Calendar className="h-3 w-3" />
                </div>
                Create sessions for your group
              </li>
              <li className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Users className="h-3 w-3" />
                </div>
                Manage member registrations
              </li>
              <li className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-3 w-3" />
                </div>
                Track attendance and participation
              </li>
            </ul>
          </div>
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
              /{item.organization.slug}
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

function CreateOrgCard() {
  const [showForm, setShowForm] = useState(false)

  if (showForm) {
    return <CreateOrgForm onCancel={() => setShowForm(false)} />
  }

  return (
    <button
      id="create-org-card"
      onClick={() => setShowForm(true)}
      className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-card/30 p-6 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card/50"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
        <Plus className="h-6 w-6 text-muted-foreground transition-colors group-hover:text-primary" />
      </div>
      <p className="mt-3 font-medium">Create Group</p>
      <p className="text-sm text-muted-foreground">Add a new group</p>
    </button>
  )
}

const JOIN_MODES = [
  {
    value: "invite",
    label: "Invite Only",
    description: "Members must be invited",
  },
  { value: "open", label: "Open", description: "Anyone can join" },
  {
    value: "approval",
    label: "Approval Required",
    description: "Join requests need approval",
  },
] as const

function CreateOrgForm({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [timezone, setTimezone] = useState("")
  const [defaultJoinMode, setDefaultJoinMode] = useState<
    "open" | "invite" | "approval"
  >("invite")
  const [error, setError] = useState("")

  const utils = trpc.useUtils()
  const createOrg = trpc.user.createOrg.useMutation({
    onSuccess: async (data) => {
      setName("")
      setSlug("")
      setTimezone("")
      setDefaultJoinMode("invite")
      setError("")
      await utils.user.myOrgs.invalidate()
      await orgClient.setActive({ organizationId: data.id })
      await utils.invalidate()
      navigate({ to: "/dashboard/org/$orgId", params: { orgId: data.id } })
    },
    onError: (err) => {
      setError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    createOrg.mutate({
      name,
      slug,
      timezone: timezone || undefined,
      defaultJoinMode,
    })
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
      <h3 className="text-lg font-semibold">Create Group</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Set up a new group to get started.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Group Name</Label>
          <Input
            id="name"
            placeholder="My Group"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL Slug</Label>
          <Input
            id="slug"
            placeholder="my-group"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="^[a-z0-9-]+$"
            title="Lowercase letters, numbers, and hyphens only"
            required
            className="bg-background/50"
          />
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, and hyphens only.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone (optional)</Label>
          <Input
            id="timezone"
            placeholder="America/New_York"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="bg-background/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="joinMode">Default Join Mode</Label>
          <select
            id="joinMode"
            value={defaultJoinMode}
            onChange={(e) =>
              setDefaultJoinMode(e.target.value as "open" | "invite" | "approval")
            }
            className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {JOIN_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label} - {mode.description}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            disabled={createOrg.isPending}
            className={onCancel ? "" : "w-full"}
          >
            {createOrg.isPending ? "Creating..." : "Create Group"}
          </Button>
        </div>
      </form>
    </div>
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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

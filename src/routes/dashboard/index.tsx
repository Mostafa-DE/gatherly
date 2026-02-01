import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { organization as orgClient } from "@/auth/client"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Building2, Plus, ArrowRight } from "lucide-react"

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHomePage,
})


function DashboardHomePage() {
  const { data: orgs, isLoading } = trpc.user.myOrgs.useQuery()

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Your Organizations</h1>
        <p className="text-muted-foreground">
          Select an organization to manage or create a new one
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : orgs && orgs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((item) => (
            <OrgCard key={item.organization.id} item={item} />
          ))}
          <CreateOrgCard />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <CreateOrgForm />
          <Card>
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Create your first organization to start managing sessions and
                members.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc space-y-2 pl-4">
                <li>Create sessions for your group</li>
                <li>Manage member registrations</li>
                <li>Track attendance and participation</li>
              </ul>
            </CardContent>
          </Card>
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
    utils.user.whoami.invalidate()
    navigate({ to: "/dashboard/org/$orgId", params: { orgId: item.organization.id } })
  }

  return (
    <Card
      className="group cursor-pointer transition-colors hover:border-primary"
      onClick={handleClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{item.organization.name}</CardTitle>
              <CardDescription>/{item.organization.slug}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="capitalize">
            {item.role}
          </Badge>
        </div>
      </CardHeader>
      <CardFooter className="pt-0">
        <div className="flex items-center text-sm text-muted-foreground group-hover:text-primary">
          Open dashboard
          <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </CardFooter>
    </Card>
  )
}

function CreateOrgCard() {
  const [showForm, setShowForm] = useState(false)

  if (showForm) {
    return <CreateOrgForm onCancel={() => setShowForm(false)} />
  }

  return (
    <Card
      className="flex cursor-pointer flex-col items-center justify-center border-dashed transition-colors hover:border-primary hover:bg-muted/50"
      onClick={() => setShowForm(true)}
    >
      <CardContent className="flex flex-col items-center gap-2 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Plus className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Create Organization</p>
      </CardContent>
    </Card>
  )
}

const JOIN_MODES = [
  { value: "invite", label: "Invite Only", description: "Members must be invited" },
  { value: "open", label: "Open", description: "Anyone can join" },
  { value: "approval", label: "Approval Required", description: "Join requests need approval" },
] as const

function CreateOrgForm({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [timezone, setTimezone] = useState("")
  const [defaultJoinMode, setDefaultJoinMode] = useState<"open" | "invite" | "approval">("invite")
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
      await utils.user.whoami.invalidate()
      navigate({ to: "/org/$orgId", params: { orgId: data.id } })
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
    <Card>
      <CardHeader>
        <CardTitle>Create Organization</CardTitle>
        <CardDescription>
          Set up a new organization for your group.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              placeholder="My Organization"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <Input
              id="slug"
              placeholder="my-organization"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="^[a-z0-9-]+$"
              title="Lowercase letters, numbers, and hyphens only"
              required
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="joinMode">Default Join Mode</Label>
            <select
              id="joinMode"
              value={defaultJoinMode}
              onChange={(e) => setDefaultJoinMode(e.target.value as "open" | "invite" | "approval")}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {JOIN_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>
                  {mode.label} - {mode.description}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={createOrg.isPending} className={onCancel ? "" : "w-full"}>
            {createOrg.isPending ? "Creating..." : "Create Organization"}
          </Button>
        </CardFooter>
      </form>
    </Card>
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

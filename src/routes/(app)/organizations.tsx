import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useSession, organization as orgClient } from "@/auth/client"
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
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const Route = createFileRoute("/(app)/organizations")({
  component: OrganizationsPage,
})

function OrganizationsPage() {
  const navigate = useNavigate()
  const { data: session, isPending: sessionPending } = useSession()

  // Redirect to login if not authenticated
  if (!sessionPending && !session?.user) {
    navigate({ to: "/login" })
    return null
  }

  if (sessionPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-8">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">
          &larr; Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-8">Organizations</h1>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <CreateOrgForm />
        </div>
        <div>
          <OrgList activeOrgId={session?.session?.activeOrganizationId} />
        </div>
      </div>
    </div>
  )
}

const JOIN_MODES = [
  { value: "invite", label: "Invite Only", description: "Members must be invited" },
  { value: "open", label: "Open", description: "Anyone can join" },
  { value: "approval", label: "Approval Required", description: "Join requests need approval" },
] as const

function CreateOrgForm() {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [timezone, setTimezone] = useState("")
  const [defaultJoinMode, setDefaultJoinMode] = useState<"open" | "invite" | "approval">("invite")
  const [error, setError] = useState("")

  const utils = trpc.useUtils()
  const createOrg = trpc.user.createOrg.useMutation({
    onSuccess: () => {
      setName("")
      setSlug("")
      setTimezone("")
      setDefaultJoinMode("invite")
      setError("")
      utils.user.myOrgs.invalidate()
      utils.user.whoami.invalidate()
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

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value)
    // Only auto-generate if slug hasn't been manually edited
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Organization</CardTitle>
        <CardDescription>
          Create a new organization to manage your groups and activities.
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
              Used in URLs. Lowercase letters, numbers, and hyphens only.
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
            <p className="text-xs text-muted-foreground">
              IANA timezone identifier (e.g., America/New_York, Europe/London)
            </p>
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
          <Button type="submit" className="w-full" disabled={createOrg.isPending}>
            {createOrg.isPending ? "Creating..." : "Create Organization"}
          </Button>
        </CardContent>
      </form>
    </Card>
  )
}

function OrgList({ activeOrgId }: { activeOrgId?: string | null }) {
  const { data: orgs, isLoading } = trpc.user.myOrgs.useQuery()
  const utils = trpc.useUtils()

  const handleSetActive = async (orgId: string) => {
    await orgClient.setActive({ organizationId: orgId })
    // Invalidate queries to refresh the active org state
    utils.user.whoami.invalidate()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    )
  }

  if (!orgs || orgs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Organizations</CardTitle>
          <CardDescription>
            You don't belong to any organizations yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Create your first organization to get started.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Organizations</CardTitle>
        <CardDescription>
          Organizations you belong to. Select one to set it as active.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {orgs.map((item, index) => (
          <div key={item.organization.id}>
            {index > 0 && <Separator className="my-4" />}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.organization.name}</p>
                  {activeOrgId === item.organization.id && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  /{item.organization.slug}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">Role: {item.role}</span>
                  <span>|</span>
                  <span className="capitalize">Join: {item.organization.defaultJoinMode}</span>
                  {item.organization.timezone && (
                    <>
                      <span>|</span>
                      <span>TZ: {item.organization.timezone}</span>
                    </>
                  )}
                </div>
              </div>
              <div>
                {activeOrgId !== item.organization.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSetActive(item.organization.id)}
                  >
                    Set Active
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
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

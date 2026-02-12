import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { organization as orgClient, useSession } from "@/auth/client"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TimezoneSelect } from "@/components/ui/timezone-select"
import { getTimezones } from "@/lib/timezones"
import { SUPPORTED_CURRENCIES } from "@/schemas/organization-settings"
import { InterestPicker } from "@/components/onboarding/interest-picker"
import { Info } from "lucide-react"

export const Route = createFileRoute("/dashboard/groups/create")({
  component: CreateGroupPage,
})

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

function CreateGroupPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const username = session?.user?.username ?? ""
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  const [currency, setCurrency] = useState("")
  const [defaultJoinMode, setDefaultJoinMode] = useState<
    "open" | "invite" | "approval"
  >("invite")
  const [error, setError] = useState("")
  const [interestIds, setInterestIds] = useState<string[]>([])
  const timezones = useMemo(() => getTimezones(), [])

  const utils = trpc.useUtils()
  const createOrg = trpc.user.createOrg.useMutation({
    onSuccess: async (data) => {
      if (!data?.id) {
        setError("Failed to create group")
        return
      }
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

    if (!name.trim()) {
      setError("Group name is required")
      return
    }
    if (!slug.trim()) {
      setError("URL slug is required")
      return
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError("Slug must contain only lowercase letters, numbers, and hyphens")
      return
    }
    if (!timezone) {
      setError("Timezone is required")
      return
    }
    if (!currency) {
      setError("Currency is required")
      return
    }

    createOrg.mutate({
      name: name.trim(),
      slug: slug.trim(),
      timezone,
      defaultJoinMode,
      currency: currency as typeof SUPPORTED_CURRENCIES[number],
      interestIds: defaultJoinMode !== "invite" ? interestIds : undefined,
    })
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value))
    }
  }

  return (
    <div className="py-4">
      <div className="mx-auto max-w-2xl">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Create Group</CardTitle>
              <CardDescription>
                Set up a new group to start organizing sessions and members.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Group Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="My Group"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  type="text"
                  placeholder="my-group"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Your group will be at: /{username}/{slug || "my-group"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone *</Label>
                  <TimezoneSelect
                    id="timezone"
                    value={timezone}
                    onChange={setTimezone}
                    timezones={timezones}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select
                    value={currency}
                    onValueChange={setCurrency}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used for session pricing
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="joinMode">Default Join Mode *</Label>
                <Select
                  value={defaultJoinMode}
                  onValueChange={(v) => setDefaultJoinMode(v as "open" | "invite" | "approval")}
                >
                  <SelectTrigger id="joinMode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOIN_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label} - {mode.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {defaultJoinMode === "invite" && (
                  <Alert className="mt-2">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Your group will be hidden and no one can request to join.
                      You will need to send an invite separately for every
                      member. If that&apos;s not what you want, consider
                      switching to Approval Required so people can request to
                      join. You can always change this in group settings after
                      creating.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {defaultJoinMode !== "invite" && (
                <div className="space-y-2">
                  <Label>Interests (optional)</Label>
                  <p className="text-xs text-muted-foreground">
                    Tag your group with interests to help people discover it
                  </p>
                  <InterestPicker
                    selected={interestIds}
                    onChange={setInterestIds}
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-between">
              <Button variant="outline" type="button" asChild>
                <Link to="/dashboard">Cancel</Link>
              </Button>
              <Button type="submit" disabled={createOrg.isPending}>
                {createOrg.isPending ? "Creating..." : "Create Group"}
              </Button>
            </CardFooter>
          </form>
        </Card>
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

import { useState } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Swords, XCircle } from "lucide-react"
import {
  formatLabels,
  visibilityLabels,
  participantTypeLabels,
} from "@/plugins/tournaments/components/constants"
import {
  TOURNAMENT_FORMATS,
  VISIBILITIES,
  PARTICIPANT_TYPES,
} from "@/plugins/tournaments/types"
import type {
  TournamentFormat,
  Visibility,
  ParticipantType,
  TournamentConfig,
} from "@/plugins/tournaments/types"

export const Route = createFileRoute(
  "/dashboard/org/$orgId/activities/$activityId/tournaments/create"
)({
  component: CreateTournamentPage,
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100)
}

function isSlugConflictError(message: string): boolean {
  return message.toLowerCase().includes("slug already exists")
}

function CreateTournamentPage() {
  const { orgId, activityId } = Route.useParams()
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  const { data: whoami, isLoading: whoamiLoading } = trpc.user.whoami.useQuery()
  const isAdmin = whoami?.membership?.role === "owner" || whoami?.membership?.role === "admin"

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [format, setFormat] = useState<TournamentFormat>("single_elimination")
  const [participantType, setParticipantType] = useState<ParticipantType>("individual")
  const [visibility, setVisibility] = useState<Visibility>("activity_members")
  const [maxCapacity, setMaxCapacity] = useState("")
  const [error, setError] = useState("")
  const [slugError, setSlugError] = useState("")

  // Format-specific config
  const [swissRounds, setSwissRounds] = useState("")
  const [groupCount, setGroupCount] = useState("")
  const [advancePerGroup, setAdvancePerGroup] = useState("")
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false)

  // Team config
  const [minTeamSize, setMinTeamSize] = useState("")
  const [maxTeamSize, setMaxTeamSize] = useState("")

  // Points config
  const [pointsWin, setPointsWin] = useState("3")
  const [pointsLoss, setPointsLoss] = useState("0")
  const [pointsDraw, setPointsDraw] = useState("1")
  const [pointsBye, setPointsBye] = useState("3")

  const createTournament = trpc.plugin.tournaments.create.useMutation({
    onSuccess: (data) => {
      utils.plugin.tournaments.listByActivity.invalidate({ activityId })
      navigate({
        to: "/dashboard/org/$orgId/activities/$activityId/tournaments/$tournamentId",
        params: { orgId, activityId, tournamentId: data.id },
      })
    },
    onError: (err) => {
      if (isSlugConflictError(err.message)) {
        setSlugError(err.message)
        setError("")
        return
      }
      setError(err.message)
    },
  })

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
  }

  function handleSubmit() {
    setError("")
    setSlugError("")
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!slug.trim()) {
      setSlugError("Slug is required")
      return
    }

    const config: TournamentConfig = {}
    if (maxCapacity) config.maxCapacity = parseInt(maxCapacity, 10)

    // Format-specific config
    if (format === "swiss" && swissRounds) {
      config.swissRounds = parseInt(swissRounds, 10)
    }
    if (format === "group_knockout") {
      if (groupCount) config.groupCount = parseInt(groupCount, 10)
      if (advancePerGroup) config.advancePerGroup = parseInt(advancePerGroup, 10)
    }
    if ((format === "single_elimination" || format === "double_elimination") && thirdPlaceMatch) {
      config.thirdPlaceMatch = true
    }

    // Team config
    if (participantType === "team") {
      if (minTeamSize) config.minTeamSize = parseInt(minTeamSize, 10)
      if (maxTeamSize) config.maxTeamSize = parseInt(maxTeamSize, 10)
    }

    // Points config (for standings-based formats)
    if (format !== "single_elimination" && format !== "double_elimination") {
      config.points = {
        win: parseInt(pointsWin, 10) || 3,
        loss: parseInt(pointsLoss, 10) || 0,
        draw: parseInt(pointsDraw, 10) || 1,
        bye: parseInt(pointsBye, 10) || 3,
      }
    }

    createTournament.mutate({
      activityId,
      name: name.trim(),
      slug: slug.trim(),
      format,
      participantType,
      visibility,
      config: Object.keys(config).length > 0 ? config : undefined,
    })
  }

  if (whoamiLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Only group owners and admins can create tournaments.
        </p>
        <Button asChild>
          <Link
            to="/dashboard/org/$orgId/activities/$activityId/tournaments"
            params={{ orgId, activityId }}
          >
            Back to Tournaments
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
          <Link
            to="/dashboard/org/$orgId/activities/$activityId/tournaments"
            params={{ orgId, activityId }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Create Tournament</h1>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        {error && (
          <div className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Spring Championship"
                className="bg-popover"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugManuallyEdited(true)
                  if (slugError) setSlugError("")
                  if (error) setError("")
                }}
                placeholder="spring-championship"
                aria-invalid={slugError ? "true" : "false"}
                className="bg-popover font-mono text-sm"
              />
              {slugError && (
                <p className="text-sm text-destructive">{slugError}</p>
              )}
            </div>
          </div>

          {/* Format & Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as TournamentFormat)}>
                <SelectTrigger className="bg-popover">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOURNAMENT_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {formatLabels[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Participant Type</Label>
              <Select
                value={participantType}
                onValueChange={(v) => setParticipantType(v as ParticipantType)}
              >
                <SelectTrigger className="bg-popover">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_TYPES.map((pt) => (
                    <SelectItem key={pt} value={pt}>
                      {participantTypeLabels[pt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Visibility & Max capacity */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
                <SelectTrigger className="bg-popover">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITIES.map((vis) => (
                    <SelectItem key={vis} value={vis}>
                      {visibilityLabels[vis]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxCapacity">Max Capacity (optional)</Label>
              <Input
                id="maxCapacity"
                type="number"
                min="2"
                value={maxCapacity}
                onChange={(e) => setMaxCapacity(e.target.value)}
                placeholder="Unlimited"
                className="bg-popover"
              />
            </div>
          </div>

          {/* Format-specific config */}
          {format === "swiss" && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
              <p className="text-sm font-medium">Swiss Settings</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="swissRounds">Number of Rounds</Label>
                  <Input
                    id="swissRounds"
                    type="number"
                    min="1"
                    value={swissRounds}
                    onChange={(e) => setSwissRounds(e.target.value)}
                    placeholder="e.g. 5"
                    className="bg-popover"
                  />
                </div>
              </div>
            </div>
          )}

          {format === "group_knockout" && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
              <p className="text-sm font-medium">Group + Knockout Settings</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="groupCount">Number of Groups</Label>
                  <Input
                    id="groupCount"
                    type="number"
                    min="2"
                    value={groupCount}
                    onChange={(e) => setGroupCount(e.target.value)}
                    placeholder="e.g. 4"
                    className="bg-popover"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="advancePerGroup">Advance Per Group</Label>
                  <Input
                    id="advancePerGroup"
                    type="number"
                    min="1"
                    value={advancePerGroup}
                    onChange={(e) => setAdvancePerGroup(e.target.value)}
                    placeholder="e.g. 2"
                    className="bg-popover"
                  />
                </div>
              </div>
            </div>
          )}

          {(format === "single_elimination" || format === "double_elimination") && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
              <p className="text-sm font-medium">Elimination Settings</p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={thirdPlaceMatch}
                  onChange={(e) => setThirdPlaceMatch(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm">Third Place Match</span>
              </label>
            </div>
          )}

          {/* Team config */}
          {participantType === "team" && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
              <p className="text-sm font-medium">Team Settings</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minTeamSize">Min Team Size</Label>
                  <Input
                    id="minTeamSize"
                    type="number"
                    min="1"
                    value={minTeamSize}
                    onChange={(e) => setMinTeamSize(e.target.value)}
                    placeholder="e.g. 2"
                    className="bg-popover"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTeamSize">Max Team Size</Label>
                  <Input
                    id="maxTeamSize"
                    type="number"
                    min="1"
                    value={maxTeamSize}
                    onChange={(e) => setMaxTeamSize(e.target.value)}
                    placeholder="e.g. 5"
                    className="bg-popover"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Points config — only for standings-based formats */}
          {format !== "single_elimination" && format !== "double_elimination" && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-background/50 p-4">
              <p className="text-sm font-medium">Points Config</p>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="pointsWin">Win</Label>
                  <Input
                    id="pointsWin"
                    type="number"
                    value={pointsWin}
                    onChange={(e) => setPointsWin(e.target.value)}
                    className="bg-popover font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pointsLoss">Loss</Label>
                  <Input
                    id="pointsLoss"
                    type="number"
                    value={pointsLoss}
                    onChange={(e) => setPointsLoss(e.target.value)}
                    className="bg-popover font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pointsDraw">Draw</Label>
                  <Input
                    id="pointsDraw"
                    type="number"
                    value={pointsDraw}
                    onChange={(e) => setPointsDraw(e.target.value)}
                    className="bg-popover font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pointsBye">Bye</Label>
                  <Input
                    id="pointsBye"
                    type="number"
                    value={pointsBye}
                    onChange={(e) => setPointsBye(e.target.value)}
                    className="bg-popover font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="mt-8 border-t border-border/50 pt-6">
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !slug.trim() || createTournament.isPending}
          >
            <Swords className="h-4 w-4 mr-2" />
            {createTournament.isPending ? "Creating..." : "Create Tournament"}
          </Button>
        </div>
      </div>
    </div>
  )
}

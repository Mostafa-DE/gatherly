import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Pencil, Save } from "lucide-react"
import {
  formatLabels,
  visibilityLabels,
  seedingLabels,
  participantTypeLabels,
} from "./constants"
import { VISIBILITIES, SEEDING_METHODS } from "../types"
import type { Visibility, SeedingMethod, TournamentConfig } from "../types"

type TournamentOverviewProps = {
  tournament: {
    id: string
    name: string
    slug: string
    format: string
    status: string
    participantType: string
    visibility: string
    seedingMethod: string
    config: unknown
    version: number
    startsAt: Date | null
    registrationOpensAt: Date | null
    registrationClosesAt: Date | null
    createdAt: Date
  }
  isAdmin: boolean
  orgId: string
  activityId: string
}

function formatDate(date: Date | null): string {
  if (!date) return "Not set"
  return new Date(date).toLocaleString()
}

export function TournamentOverview({ tournament, isAdmin }: TournamentOverviewProps) {
  const [showEditDialog, setShowEditDialog] = useState(false)
  const config = (tournament.config ?? {}) as TournamentConfig
  const canEdit =
    isAdmin && (tournament.status === "draft" || tournament.status === "registration")

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold">Tournament Details</h2>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
            >
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Edit
            </Button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Format">
            <Badge variant="outline" className="text-xs">
              {formatLabels[tournament.format] ?? tournament.format}
            </Badge>
          </DetailRow>
          <DetailRow label="Participant Type">
            {participantTypeLabels[tournament.participantType] ?? tournament.participantType}
          </DetailRow>
          <DetailRow label="Visibility">
            {visibilityLabels[tournament.visibility] ?? tournament.visibility}
          </DetailRow>
          <DetailRow label="Seeding Method">
            {seedingLabels[tournament.seedingMethod] ?? tournament.seedingMethod}
          </DetailRow>
          <DetailRow label="Max Capacity">
            <span className="font-mono">{config.maxCapacity ?? "Unlimited"}</span>
          </DetailRow>
          <DetailRow label="Slug">
            <span className="font-mono text-muted-foreground">/{tournament.slug}</span>
          </DetailRow>
          <DetailRow label="Starts At">{formatDate(tournament.startsAt)}</DetailRow>
          <DetailRow label="Registration Opens">
            {formatDate(tournament.registrationOpensAt)}
          </DetailRow>
          <DetailRow label="Registration Closes">
            {formatDate(tournament.registrationClosesAt)}
          </DetailRow>
          <DetailRow label="Created">
            {formatDate(tournament.createdAt)}
          </DetailRow>
        </div>

        {/* Format-specific config */}
        {(config.swissRounds || config.groupCount || config.thirdPlaceMatch) && (
          <div className="mt-6 border-t border-border/50 pt-4">
            <p className="text-sm font-medium mb-3">Format Config</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.swissRounds && (
                <DetailRow label="Swiss Rounds">
                  <span className="font-mono">{config.swissRounds}</span>
                </DetailRow>
              )}
              {config.groupCount && (
                <DetailRow label="Groups">
                  <span className="font-mono">{config.groupCount}</span>
                </DetailRow>
              )}
              {config.advancePerGroup && (
                <DetailRow label="Advance Per Group">
                  <span className="font-mono">{config.advancePerGroup}</span>
                </DetailRow>
              )}
              {config.thirdPlaceMatch && (
                <DetailRow label="Third Place Match">Yes</DetailRow>
              )}
              {config.bestOf && (
                <DetailRow label="Best Of">
                  <span className="font-mono">{config.bestOf}</span>
                </DetailRow>
              )}
            </div>
          </div>
        )}

        {/* Points config */}
        {config.points && (
          <div className="mt-6 border-t border-border/50 pt-4">
            <p className="text-sm font-medium mb-3">Points</p>
            <div className="flex gap-6">
              <span className="text-sm">
                Win: <span className="font-mono font-medium">{config.points.win}</span>
              </span>
              <span className="text-sm">
                Loss: <span className="font-mono font-medium">{config.points.loss}</span>
              </span>
              <span className="text-sm">
                Draw: <span className="font-mono font-medium">{config.points.draw}</span>
              </span>
              <span className="text-sm">
                Bye: <span className="font-mono font-medium">{config.points.bye}</span>
              </span>
            </div>
          </div>
        )}

        {/* Rules */}
        {config.rulesText && (
          <div className="mt-6 border-t border-border/50 pt-4">
            <p className="text-sm font-medium mb-2">Rules</p>
            <div className="rounded-lg bg-background/50 p-3 text-sm whitespace-pre-wrap">
              {config.rulesText}
            </div>
          </div>
        )}

        {/* Team config */}
        {tournament.participantType === "team" &&
          (config.minTeamSize || config.maxTeamSize) && (
            <div className="mt-6 border-t border-border/50 pt-4">
              <p className="text-sm font-medium mb-3">Team Settings</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {config.minTeamSize && (
                  <DetailRow label="Min Team Size">
                    <span className="font-mono">{config.minTeamSize}</span>
                  </DetailRow>
                )}
                {config.maxTeamSize && (
                  <DetailRow label="Max Team Size">
                    <span className="font-mono">{config.maxTeamSize}</span>
                  </DetailRow>
                )}
              </div>
            </div>
          )}
      </div>

      {canEdit && (
        <EditTournamentDialog
          tournament={tournament}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}
    </div>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/50 px-3 py-2.5">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

export function EditTournamentDialog({
  tournament,
  open,
  onOpenChange,
}: {
  tournament: {
    id: string
    name: string
    visibility: string
    seedingMethod: string
    version: number
    status: string
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const utils = trpc.useUtils()
  const [name, setName] = useState(tournament.name)
  const [visibility, setVisibility] = useState(tournament.visibility)
  const [seedingMethod, setSeedingMethod] = useState(tournament.seedingMethod)
  const [error, setError] = useState("")

  const updateTournament = trpc.plugin.tournaments.update.useMutation({
    onSuccess: () => {
      utils.plugin.tournaments.getById.invalidate({ tournamentId: tournament.id })
      utils.plugin.tournaments.listByActivity.invalidate()
      onOpenChange(false)
      setError("")
    },
    onError: (err) => setError(err.message),
  })

  function handleSave() {
    setError("")
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    updateTournament.mutate({
      tournamentId: tournament.id,
      expectedVersion: tournament.version,
      name: name.trim(),
      visibility: visibility as Visibility,
      seedingMethod: seedingMethod as SeedingMethod,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Tournament</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-popover"
            />
          </div>
          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select value={visibility} onValueChange={setVisibility}>
              <SelectTrigger className="bg-popover">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITIES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {visibilityLabels[v]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Seeding Method</Label>
            <Select value={seedingMethod} onValueChange={setSeedingMethod}>
              <SelectTrigger className="bg-popover">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEEDING_METHODS.map((sm) => (
                  <SelectItem key={sm} value={sm}>
                    {seedingLabels[sm]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateTournament.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateTournament.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

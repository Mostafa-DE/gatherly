import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X } from "lucide-react"

export type Player = {
  userId: string
  name: string
  image?: string | null
}

type TeamSelectorProps = {
  label: string
  team: string[]
  setTeam: (team: string[]) => void
  maxPlayers: number
  availablePlayers: Player[]
  allPlayers: Player[]
}

export function TeamSelector({
  label,
  team,
  setTeam,
  maxPlayers,
  availablePlayers,
  allPlayers,
}: TeamSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="space-y-1.5">
        {team.map((userId) => {
          const player = allPlayers.find((p) => p.userId === userId)
          return (
            <div
              key={userId}
              className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={player?.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {player?.name?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs truncate flex-1">
                {player?.name ?? userId}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setTeam(team.filter((id) => id !== userId))
                }
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
        {team.length < maxPlayers && (
          <Select
            value=""
            onValueChange={(val) => {
              if (val) setTeam([...team, val])
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select player" />
            </SelectTrigger>
            <SelectContent>
              {availablePlayers.map((p) => (
                <SelectItem key={p.userId} value={p.userId}>
                  <span className="text-xs">{p.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}

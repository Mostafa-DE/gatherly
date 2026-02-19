import { useState, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Search } from "lucide-react"
import { AddParticipantSearch } from "./add-participant-search"

type ParticipantsToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  sessionId: string
  excludeUserIds: string[]
  onParticipantAdded: () => void
}

export function ParticipantsToolbar({
  search,
  onSearchChange,
  sessionId,
  excludeUserIds,
  onParticipantAdded,
}: ParticipantsToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleChange = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSearchChange(value.trim())
      }, 300)
    },
    [onSearchChange]
  )

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Filter section — left, tied to the table below */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Filter
        </label>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search participants..."
            value={localSearch}
            onChange={(e) => handleChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Separator orientation="vertical" className="hidden sm:block h-9 self-end" />

      {/* Add member section — right */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Add Member
        </label>
        <AddParticipantSearch
          sessionId={sessionId}
          excludeUserIds={excludeUserIds}
          onAdded={onParticipantAdded}
        />
      </div>
    </div>
  )
}

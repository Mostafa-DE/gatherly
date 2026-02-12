import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, UserPlus } from "lucide-react"

type ParticipantsToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onAddClick: () => void
}

export function ParticipantsToolbar({
  search,
  onSearchChange,
  onAddClick,
}: ParticipantsToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search)

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, onSearchChange])

  // Sync external changes (e.g. tab switch clearing search)
  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button size="sm" onClick={onAddClick}>
        <UserPlus className="mr-2 h-4 w-4" />
        Add Participant
      </Button>
    </div>
  )
}

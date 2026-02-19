import { useState, useRef, useCallback, useEffect } from "react"
import { trpc } from "@/lib/trpc"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { UserPlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

const MIN_SEARCH_LENGTH = 3

type AddParticipantSearchProps = {
  sessionId: string
  excludeUserIds: string[]
  onAdded: () => void
}

export function AddParticipantSearch({
  sessionId,
  excludeUserIds,
  onAdded,
}: AddParticipantSearchProps) {
  const [inputValue, setInputValue] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim()
      setDebouncedSearch(trimmed)
      setOpen(trimmed.length > 0)
      setHighlightedIndex(-1)
    }, 300)
  }, [])

  const searchEnabled = debouncedSearch.length >= MIN_SEARCH_LENGTH
  const showMinLengthHint = debouncedSearch.length > 0 && !searchEnabled

  const { data: results, isLoading } =
    trpc.organization.searchMembers.useQuery(
      { search: debouncedSearch, excludeUserIds, limit: 10 },
      { enabled: searchEnabled }
    )

  const addMutation = trpc.participation.adminAddByUserId.useMutation({
    onSuccess: () => {
      setInputValue("")
      setDebouncedSearch("")
      setOpen(false)
      setHighlightedIndex(-1)
      toast.success("Participant added")
      onAdded()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleSelect = useCallback(
    (userId: string) => {
      addMutation.mutate({ sessionId, userId })
    },
    [addMutation, sessionId]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open || !results || results.length === 0) return

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0
          )
          break
        }
        case "ArrowUp": {
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1
          )
          break
        }
        case "Enter": {
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < results.length) {
            handleSelect(results[highlightedIndex].userId)
          }
          break
        }
        case "Escape": {
          setOpen(false)
          setHighlightedIndex(-1)
          break
        }
      }
    },
    [open, results, highlightedIndex, handleSelect]
  )

  // Sync highlighted item scroll position with the DOM list
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return
    const item = listRef.current.children[highlightedIndex] as HTMLElement
    item?.scrollIntoView({ block: "nearest" })
  }, [highlightedIndex])

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative w-64">
          <UserPlus className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Add member..."
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9"
            onFocus={() => {
              if (debouncedSearch.length > 0) setOpen(true)
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-64 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {showMinLengthHint ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Type {MIN_SEARCH_LENGTH - debouncedSearch.length} more character{MIN_SEARCH_LENGTH - debouncedSearch.length !== 1 ? "s" : ""} to search
          </p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : results && results.length > 0 ? (
          <ul ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {results.map((member, index) => (
              <li key={member.userId}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors disabled:opacity-50 ${
                    index === highlightedIndex
                      ? "bg-accent"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => handleSelect(member.userId)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  disabled={addMutation.isPending}
                >
                  <Avatar className="h-7 w-7">
                    {member.image && (
                      <AvatarImage src={member.image} alt={member.name} />
                    )}
                    <AvatarFallback className="text-xs">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No members found
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

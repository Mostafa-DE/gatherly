import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"

type TimezoneSelectProps = {
  value: string
  onChange: (value: string) => void
  timezones: string[]
  id?: string
  disabled?: boolean
}

function TimezoneOptions({
  query,
  onQueryChange,
  selectedValue,
  options,
  onSelect,
  scrollClassName,
}: {
  query: string
  onQueryChange: (value: string) => void
  selectedValue: string
  options: string[]
  onSelect: (value: string) => void
  scrollClassName: string
}) {
  return (
    <div className="p-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search timezone..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className={cn("mt-3", scrollClassName)}>
        <div className="space-y-1 pr-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
            onClick={() => onSelect("")}
          >
            <span>Not set</span>
            {selectedValue === "" && <Check className="h-4 w-4 text-primary" />}
          </button>

          {options.map((zone) => (
            <button
              key={zone}
              type="button"
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(zone)}
            >
              <span>{zone}</span>
              {selectedValue === zone && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}

          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No timezones match your search.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function TimezoneSelect({
  value,
  onChange,
  timezones,
  id,
  disabled,
}: TimezoneSelectProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filteredTimezones = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return timezones
    }

    return timezones.filter((zone) => zone.toLowerCase().includes(normalizedQuery))
  }, [query, timezones])

  const selectedLabel = value || "Not set"

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery("")
    }
  }

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    handleOpenChange(false)
  }

  const trigger = (
    <Button
      id={id}
      type="button"
      variant="outline"
      disabled={disabled}
      className="w-full justify-between bg-popover text-left font-normal"
    >
      <span className={cn("truncate", value === "" && "text-muted-foreground")}>
        {selectedLabel}
      </span>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </Button>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="h-[82vh] p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>Select Timezone</SheetTitle>
            <SheetDescription>
              Search by city, country, or region.
            </SheetDescription>
          </SheetHeader>
          <TimezoneOptions
            query={query}
            onQueryChange={setQuery}
            selectedValue={value}
            options={filteredTimezones}
            onSelect={handleSelect}
            scrollClassName="h-[calc(82vh-11rem)]"
          />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[min(95vw,26rem)] p-0" align="start">
        <TimezoneOptions
          query={query}
          onQueryChange={setQuery}
          selectedValue={value}
          options={filteredTimezones}
          onSelect={handleSelect}
          scrollClassName="h-72"
        />
      </PopoverContent>
    </Popover>
  )
}

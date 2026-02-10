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

type Option = {
  value: string
  label: string
}

type SearchableSelectProps = {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  searchPlaceholder?: string
  title?: string
  description?: string
  emptyMessage?: string
  id?: string
  disabled?: boolean
}

function OptionsList({
  query,
  onQueryChange,
  selectedValue,
  options,
  onSelect,
  scrollClassName,
  searchPlaceholder,
  emptyMessage,
}: {
  query: string
  onQueryChange: (value: string) => void
  selectedValue: string
  options: Option[]
  onSelect: (value: string) => void
  scrollClassName: string
  searchPlaceholder: string
  emptyMessage: string
}) {
  return (
    <div className="p-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className={cn("mt-3", scrollClassName)}>
        <div className="space-y-1 pr-3">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
              onClick={() => onSelect(option.value)}
            >
              <span>{option.label}</span>
              {selectedValue === option.value && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          ))}

          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  title = "Select",
  description,
  emptyMessage = "No results found.",
  id,
  disabled,
}: SearchableSelectProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return options
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(normalizedQuery)
    )
  }, [query, options])

  const selectedLabel = options.find((o) => o.value === value)?.label

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) setQuery("")
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
      <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
        {selectedLabel || placeholder}
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
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <OptionsList
            query={query}
            onQueryChange={setQuery}
            selectedValue={value}
            options={filteredOptions}
            onSelect={handleSelect}
            scrollClassName="h-[calc(82vh-11rem)]"
            searchPlaceholder={searchPlaceholder}
            emptyMessage={emptyMessage}
          />
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[min(95vw,26rem)] p-0" align="start">
        <OptionsList
          query={query}
          onQueryChange={setQuery}
          selectedValue={value}
          options={filteredOptions}
          onSelect={handleSelect}
          scrollClassName="h-72"
          searchPlaceholder={searchPlaceholder}
          emptyMessage={emptyMessage}
        />
      </PopoverContent>
    </Popover>
  )
}

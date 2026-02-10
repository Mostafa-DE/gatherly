import { useState } from "react"
import { trpc } from "@/lib/trpc"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { ChevronDown, Loader2 } from "lucide-react"

type InterestPickerProps = {
  selected: string[]
  onChange: (ids: string[]) => void
  minRequired?: number
}

export function InterestPicker({
  selected,
  onChange,
  minRequired = 0,
}: InterestPickerProps) {
  const { data: categories, isLoading } = trpc.onboarding.getInterests.useQuery()
  const [showAll, setShowAll] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading interests...</span>
      </div>
    )
  }

  if (!categories || categories.length === 0) {
    return null
  }

  const allInterests = categories.flatMap((c) => c.interests)
  const popularInterests = allInterests.filter((i) => i.popular)

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="space-y-4">
      {/* Popular interests */}
      {popularInterests.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Popular</p>
          <div className="flex flex-wrap gap-2">
            {popularInterests.map((interest) => (
              <Badge
                key={interest.id}
                variant={selected.includes(interest.id) ? "default" : "outline"}
                className="cursor-pointer select-none transition-colors duration-150"
                onClick={() => toggle(interest.id)}
              >
                {interest.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Browse all categories */}
      {!showAll ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setShowAll(true)}
        >
          Browse all categories
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      ) : (
        <Accordion type="multiple" className="w-full">
          {categories.map((category) => (
            <AccordionItem key={category.id} value={category.id}>
              <AccordionTrigger className="text-sm font-medium">
                {category.name}
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-2 pb-2">
                  {category.interests.map((interest) => (
                    <Badge
                      key={interest.id}
                      variant={selected.includes(interest.id) ? "default" : "outline"}
                      className="cursor-pointer select-none transition-colors duration-150"
                      onClick={() => toggle(interest.id)}
                    >
                      {interest.name}
                    </Badge>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Selected count */}
      <p className="text-sm text-muted-foreground">
        {selected.length} selected
        {minRequired > 0 && selected.length < minRequired && (
          <span> (pick at least {minRequired})</span>
        )}
      </p>
    </div>
  )
}

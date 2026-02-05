"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"

type DateTimePickerProps = {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = "Pick date and time",
  className,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [month, setMonth] = React.useState<Date>(value || new Date())

  // Sync month with value when value changes externally
  React.useEffect(() => {
    if (value) {
      setMonth(value)
    }
  }, [value])

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5)

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate)
      if (value) {
        // Preserve time from existing value
        newDate.setHours(value.getHours())
        newDate.setMinutes(value.getMinutes())
      } else {
        // Default to 9:00 AM for new selections
        newDate.setHours(9)
        newDate.setMinutes(0)
      }
      newDate.setSeconds(0)
      newDate.setMilliseconds(0)
      onChange(newDate)
    }
  }

  const handleTimeChange = (
    type: "hour" | "minute" | "ampm",
    val: string
  ) => {
    const baseDate = value || new Date()
    const newDate = new Date(baseDate)

    if (type === "hour") {
      const hour = parseInt(val)
      const isPM = newDate.getHours() >= 12
      newDate.setHours((hour % 12) + (isPM ? 12 : 0))
    } else if (type === "minute") {
      newDate.setMinutes(parseInt(val))
    } else if (type === "ampm") {
      const currentHours = newDate.getHours()
      if (val === "PM" && currentHours < 12) {
        newDate.setHours(currentHours + 12)
      } else if (val === "AM" && currentHours >= 12) {
        newDate.setHours(currentHours - 12)
      }
    }

    newDate.setSeconds(0)
    newDate.setMilliseconds(0)
    onChange(newDate)
  }

  const displayHour = value ? (value.getHours() % 12 || 12) : undefined
  const displayMinute = value ? value.getMinutes() : undefined
  const displayAMPM = value ? (value.getHours() >= 12 ? "PM" : "AM") : undefined

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(value, "MMMM d, yyyy 'at' h:mm a")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            month={month}
            onMonthChange={setMonth}
          />
          <div className="flex border-t sm:border-t-0 sm:border-l">
            {/* Hours */}
            <div className="flex flex-col">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center border-b">
                Hour
              </div>
              <ScrollArea className="h-[252px]">
                <div className="flex flex-col p-2 gap-1">
                  {hours.map((hour) => (
                    <Button
                      key={hour}
                      type="button"
                      size="sm"
                      variant={displayHour === hour ? "default" : "ghost"}
                      className="w-10 h-10 shrink-0"
                      onClick={() => handleTimeChange("hour", hour.toString())}
                    >
                      {hour}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {/* Minutes */}
            <div className="flex flex-col border-l">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center border-b">
                Min
              </div>
              <ScrollArea className="h-[252px]">
                <div className="flex flex-col p-2 gap-1">
                  {minutes.map((minute) => (
                    <Button
                      key={minute}
                      type="button"
                      size="sm"
                      variant={displayMinute === minute ? "default" : "ghost"}
                      className="w-10 h-10 shrink-0"
                      onClick={() => handleTimeChange("minute", minute.toString())}
                    >
                      {minute.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {/* AM/PM */}
            <div className="flex flex-col border-l">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground text-center border-b">
                &nbsp;
              </div>
              <div className="flex flex-col p-2 gap-1">
                {(["AM", "PM"] as const).map((ampm) => (
                  <Button
                    key={ampm}
                    type="button"
                    size="sm"
                    variant={displayAMPM === ampm ? "default" : "ghost"}
                    className="w-12 h-10 shrink-0"
                    onClick={() => handleTimeChange("ampm", ampm)}
                  >
                    {ampm}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Done button */}
        <div className="border-t p-2">
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={() => setIsOpen(false)}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react"
import { FORM_FIELD_TYPES, type FormField, type FormFieldType } from "@/types/form"

export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Text",
  textarea: "Text Area",
  email: "Email",
  phone: "Phone",
  number: "Number",
  select: "Dropdown",
  multiselect: "Multi-Select",
  checkbox: "Checkbox",
  date: "Date",
}

type FormFieldEditorProps = {
  field: FormField
  index: number
  totalFields: number
  onUpdate: (updates: Partial<FormField>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function FormFieldEditor({
  field,
  index,
  totalFields,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: FormFieldEditorProps) {
  const [optionsText, setOptionsText] = useState(field.options?.join("\n") || "")

  const handleOptionsChange = (value: string) => {
    setOptionsText(value)
    const options = value
      .split("\n")
      .map((o) => o.trim())
      .filter((o) => o.length > 0)
    onUpdate({ options: options.length > 0 ? options : undefined })
  }

  const needsOptions = field.type === "select" || field.type === "multiselect"

  return (
    <div className="rounded-lg border border-border/50 bg-background/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {index + 1}
          </span>
          <span className="font-medium">{field.label || "New Field"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onMoveDown}
            disabled={index === totalFields - 1}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-label`}>Label *</Label>
            <Input
              id={`${field.id}-label`}
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              placeholder="Field label"
              className="bg-popover"
            />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-type`}>Type</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onUpdate({ type: v as FormFieldType })}
          >
            <SelectTrigger id={`${field.id}-type`} className="bg-popover">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_FIELD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {FIELD_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {needsOptions && (
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-options`}>Options (one per line) *</Label>
          <textarea
            id={`${field.id}-options`}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-popover px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder="Option 1&#10;Option 2&#10;Option 3"
            value={optionsText}
            onChange={(e) => handleOptionsChange(e.target.value)}
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${field.id}-required`}
          checked={field.required || false}
          onCheckedChange={(checked) => onUpdate({ required: checked === true })}
        />
        <Label htmlFor={`${field.id}-required`} className="text-sm font-normal">
          Required field
        </Label>
      </div>
    </div>
  )
}

function generateFieldId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function useFormFields(initialFields: FormField[]) {
  const [fields, setFields] = useState<FormField[]>(initialFields)
  const [dirty, setDirty] = useState(false)

  const addField = useCallback(() => {
    const newField: FormField = {
      id: generateFieldId(),
      type: "text",
      label: "",
      required: false,
    }
    setFields((prev) => [...prev, newField])
    setDirty(true)
  }, [])

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id))
    setDirty(true)
  }, [])

  const updateField = useCallback((id: string, updates: Partial<FormField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    )
    setDirty(true)
  }, [])

  const moveField = useCallback((index: number, direction: "up" | "down") => {
    setFields((prev) => {
      const newIndex = direction === "up" ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      const newFields = [...prev]
      const [removed] = newFields.splice(index, 1)
      newFields.splice(newIndex, 0, removed)
      return newFields
    })
    setDirty(true)
  }, [])

  const reset = useCallback((newFields: FormField[]) => {
    setFields(newFields)
    setDirty(false)
  }, [])

  return {
    fields,
    addField,
    removeField,
    updateField,
    moveField,
    isDirty: dirty,
    reset,
  }
}

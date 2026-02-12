import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { JoinFormField } from "@/components/join-form-field"
import type { FormField } from "@/types/form"

type SessionJoinFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: FormField[]
  sessionTitle: string
  onSubmit: (answers: Record<string, unknown>) => void
  isPending: boolean
}

export function SessionJoinFormDialog({
  open,
  onOpenChange,
  fields,
  sessionTitle,
  onSubmit,
  isPending,
}: SessionJoinFormDialogProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState("")

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Client-side required field validation
    for (const field of fields) {
      if (!field.required) continue
      const value = answers[field.id]
      if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0)
      ) {
        setError(`"${field.label}" is required`)
        return
      }
    }

    onSubmit(answers)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Join {sessionTitle}</DialogTitle>
            <DialogDescription>
              Please fill out the form below to join this session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {fields.map((field) => (
              <JoinFormField
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(value) => handleFieldChange(field.id, value)}
              />
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Joining..." : "Join Session"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

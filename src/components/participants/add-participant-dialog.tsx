import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

type AddParticipantDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (identifier: string) => void
  isPending: boolean
  error: string | null
}

export function AddParticipantDialog({
  open,
  onOpenChange,
  onAdd,
  isPending,
  error,
}: AddParticipantDialogProps) {
  const [identifier, setIdentifier] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return
    onAdd(identifier.trim())
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setIdentifier("")
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Participant</DialogTitle>
          <DialogDescription>
            Add an organization member to this session by email or phone number.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-identifier">Email or Phone</Label>
              <Input
                id="add-identifier"
                placeholder="Email or phone number (+12025551234)"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isPending}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !identifier.trim()}>
              {isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

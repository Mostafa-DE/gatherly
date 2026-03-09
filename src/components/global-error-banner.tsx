import { useAtom } from "jotai"
import { X } from "lucide-react"
import { globalErrorAtom } from "@/state"

export function GlobalErrorBanner() {
  const [error, setError] = useAtom(globalErrorAtom)

  if (!error) return null

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-destructive px-4 py-2.5 text-sm text-destructive-foreground">
      <p>{error}</p>
      <button
        onClick={() => setError(null)}
        className="shrink-0 rounded-full p-0.5 hover:bg-destructive-foreground/20"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

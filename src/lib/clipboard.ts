import { toast } from "sonner"

export async function copyToClipboard(text: string, label = "Link") {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  } catch {
    toast.error("Failed to copy to clipboard")
  }
}

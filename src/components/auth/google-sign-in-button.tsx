import { useState } from "react"
import { signIn } from "@/auth/client"
import { Button } from "@/components/ui/button"
import { GoogleIcon } from "@/components/auth/google-icon"
import { Loader2 } from "lucide-react"

type GoogleSignInButtonProps = {
  redirectTo?: string
  label?: string
}

export function GoogleSignInButton({
  redirectTo,
  label = "Continue with Google",
}: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    try {
      await signIn.social({
        provider: "google",
        callbackURL: redirectTo ?? "/dashboard",
      })
    } catch {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="w-full"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <GoogleIcon className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  )
}

import { useEffect } from "react"
import { oneTap, useSession } from "@/auth/client"

/**
 * Triggers Google One Tap popup on login/register pages
 * when the user is not already signed in.
 */
export function useGoogleOneTap(callbackURL?: string) {
  const { data: session, isPending } = useSession()

  useEffect(() => {
    if (isPending) return
    if (session?.user) return

    oneTap({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = callbackURL ?? "/dashboard"
        },
      },
    })
  }, [isPending, session, callbackURL])
}

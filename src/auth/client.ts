import { createAuthClient } from "better-auth/react"
import {
  organizationClient,
  inferAdditionalFields,
  inferOrgAdditionalFields,
  oneTapClient,
} from "better-auth/client/plugins"
import type { auth } from "@/auth"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.BETTER_AUTH_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
    oneTapClient({
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    }),
  ],
})

export const {
  signIn,
  signOut,
  signUp,
  useSession,
  organization,
  oneTap,
} = authClient

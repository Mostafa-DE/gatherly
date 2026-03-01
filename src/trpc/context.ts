import { db } from "@/db"
import type { User, Session } from "@/db/schema"
import type { auth } from "@/auth"

/**
 * Auth session shape from Better Auth.
 * Used to type the session data passed from request middleware.
 */
export type AuthSession = {
  user?: User | NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["user"]
  session?: Session | NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>["session"]
}

export type Context = {
  db: typeof db
  user?: AuthSession["user"]
  session?: AuthSession["session"]
  headers: Headers
  botSenderId?: string
}

/**
 * Creates the tRPC context from the auth session and request headers.
 * This is called for each tRPC request after the request middleware has extracted the session.
 */
export function createTRPCContext(
  authSession: Partial<AuthSession>,
  headers: Headers = new Headers()
): Context {
  const { user, session } = authSession || {}

  return {
    db,
    user,
    session,
    headers,
  }
}

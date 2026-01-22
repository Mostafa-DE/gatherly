import { db } from "@/db"
import type { User, Session } from "@/db/schema"

/**
 * Auth session shape from Better Auth.
 * Used to type the session data passed from request middleware.
 */
export type AuthSession = {
  user?: User
  session?: Session
}

/**
 * Creates the tRPC context from the auth session and request headers.
 * This is called for each tRPC request after the request middleware has extracted the session.
 */
export function createTRPCContext(
  authSession: Partial<AuthSession>,
  headers?: Headers
) {
  const { user, session } = authSession || {}

  return {
    db,
    user,
    session,
    headers,
  }
}

export type Context = ReturnType<typeof createTRPCContext>

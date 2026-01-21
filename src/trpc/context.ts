import { auth } from "@/auth"
import { db } from "@/db"
import type { User } from "@/db/schema"

export type Context = {
  db: typeof db
  user: User | null
}

export async function createContext(opts: {
  headers: Headers
}): Promise<Context> {
  const session = await auth.api.getSession({
    headers: opts.headers,
  })

  return {
    db,
    user: session?.user as User | null,
  }
}

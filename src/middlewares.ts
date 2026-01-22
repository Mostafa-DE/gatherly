import { createMiddleware } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { auth } from "@/auth"

/**
 * Request middleware that extracts the user session from Better Auth.
 * This runs before the request handler and adds session/user to the request context.
 */
export const requestUserSessionMiddleware = createMiddleware({
  type: "request",
}).server(async (options) => {
  const request = getRequest()
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  return options.next({
    context: {
      ...(options.context ?? {}),
      ...(session ?? {}),
    },
  })
})

export const globalRequestMiddlewares = [requestUserSessionMiddleware] as const

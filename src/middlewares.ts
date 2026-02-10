import { createMiddleware } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { auth } from "@/auth"
import { logger } from "@/lib/logger"

const httpLogger = logger.withTag("http")

/**
 * Request middleware that logs incoming HTTP requests.
 */
export const requestLoggerMiddleware = createMiddleware({
  type: "request",
}).server(async (options) => {
  const request = getRequest()
  const url = new URL(request.url)
  httpLogger.info(`${request.method} ${url.pathname}`)
  return options.next()
})

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

export const globalRequestMiddlewares = [requestLoggerMiddleware, requestUserSessionMiddleware] as const

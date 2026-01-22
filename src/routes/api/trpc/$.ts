import { createFileRoute } from "@tanstack/react-router"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

import { appRouter } from "@/trpc/routers/_app"
import { createTRPCContext } from "@/trpc/context"
import { globalRequestMiddlewares } from "@/middlewares"

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    middleware: globalRequestMiddlewares,
    handlers: {
      GET: ({ request, context }) =>
        fetchRequestHandler({
          req: request,
          router: appRouter,
          endpoint: "/api/trpc",
          createContext: () =>
            createTRPCContext(
              {
                user: context.user,
                session: context.session,
              },
              request.headers
            ),
        }),
      POST: ({ request, context }) =>
        fetchRequestHandler({
          req: request,
          router: appRouter,
          endpoint: "/api/trpc",
          createContext: () =>
            createTRPCContext(
              {
                user: context.user,
                session: context.session,
              },
              request.headers
            ),
        }),
    },
  },
})

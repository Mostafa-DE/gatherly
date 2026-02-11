import { createTRPCReact } from "@trpc/react-query"
import { httpBatchStreamLink, loggerLink } from "@trpc/client"
import superjson from "superjson"
import type { AppRouter } from "@/trpc/routers/_app"

export const trpc = createTRPCReact<AppRouter>()

export function getTrpcClient() {
  return trpc.createClient({
    links: [
      loggerLink({
        enabled: () =>
          process.env.NODE_ENV === "development" &&
          typeof window !== "undefined",
      }),
      httpBatchStreamLink({
        url: "/api/trpc",
        transformer: superjson,
      }),
    ],
  })
}

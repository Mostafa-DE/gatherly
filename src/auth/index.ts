import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"
import { db } from "@/db"
import * as authSchema from "@/db/auth-schema"

function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
}

function getOriginFromUrl(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function getTrustedOriginList(request?: Request): string[] {
  const trusted = new Set<string>()

  if (process.env.BETTER_AUTH_URL) {
    trusted.add(process.env.BETTER_AUTH_URL)
  }

  if (!request) {
    return Array.from(trusted)
  }

  const requestOrigin = getOriginFromUrl(request.url)
  if (requestOrigin) {
    trusted.add(requestOrigin)
  }

  const originHeader = request.headers.get("origin")
  if (originHeader) {
    const origin = getOriginFromUrl(originHeader)
    if (origin) {
      const originUrl = new URL(origin)
      if (
        requestOrigin === origin ||
        (originUrl.protocol === "http:" && isLocalhostHostname(originUrl.hostname))
      ) {
        trusted.add(origin)
      }
    }
  }

  return Array.from(trusted)
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...authSchema,
    },
  }),
  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: true,
        unique: true,
        input: true,
      },
      username: {
        type: "string",
        required: true,
        unique: true,
        input: true,
      },
    },
  },
  plugins: [
    organization({
      schema: {
        organization: {
          additionalFields: {
            timezone: {
              type: "string",
              required: false,
              input: true,
            },
            defaultJoinMode: {
              type: "string",
              required: true,
              defaultValue: "invite",
              input: true,
            },
            userSlug: {
              type: "string",
              required: true,
              input: true,
            },
            ownerUsername: {
              type: "string",
              required: true,
              input: true,
            },
          },
        },
      },
    }),
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  trustedOrigins: async (request) => {
    return getTrustedOriginList(request)
  },
})

export type Auth = typeof auth

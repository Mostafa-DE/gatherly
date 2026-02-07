import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"
import { db } from "@/db"
import * as authSchema from "@/db/auth-schema"

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
  trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
})

export type Auth = typeof auth

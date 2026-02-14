import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { user } from "@/db/schema"
import { commonFieldsOmit } from "@/schemas/shared"

// Schema generated from Drizzle table
export const userSelectSchema = createSelectSchema(user)
export const userInsertSchema = createInsertSchema(user)

// Create user input (omit auto-generated fields)
export const userCreateSchema = userInsertSchema.omit({
  ...commonFieldsOmit,
  emailVerified: true,
})

// E.164 format: +[country][number], 8-15 digits total
export const phoneNumberSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "Please enter a valid phone number")

// Username: lowercase alphanumeric + hyphens, 3-30 chars, starts with letter
const RESERVED_USERNAMES = [
  "dashboard",
  "login",
  "register",
  "api",
  "auth",
  "admin",
  "org",
  "settings",
  "profile",
  "help",
  "about",
  "support",
  "terms",
  "privacy",
  "contact",
  "blog",
  "docs",
  "search",
  "explore",
  "new",
  "create",
  "edit",
  "delete",
  "invite",
  "join",
  "groups",
  "users",
  "notifications",
  "billing",
  "pricing",
  "home",
  "index",
  "app",
  "static",
  "assets",
  "public",
  "health",
  "status",
  "sitemap",
  "robots",
  "favicon",
  "onboarding",
] as const

export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-z][a-z0-9-]*[a-z0-9]$/,
    "Username must start with a letter, end with a letter or number, and contain only lowercase letters, numbers, and hyphens"
  )
  .refine(
    (val) => !val.includes("--"),
    "Username cannot contain consecutive hyphens"
  )
  .refine(
    (val) => !RESERVED_USERNAMES.includes(val as (typeof RESERVED_USERNAMES)[number]),
    "This username is reserved"
  )

// Update profile input
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
  phoneNumber: phoneNumberSchema.optional(),
})

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  phoneNumber: phoneNumberSchema,
  username: usernameSchema,
})

// Types
export type User = z.infer<typeof userSelectSchema>
export type UserCreate = z.infer<typeof userCreateSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

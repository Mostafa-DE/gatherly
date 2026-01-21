import { createInsertSchema, createSelectSchema } from "drizzle-zod"
import { z } from "zod"
import { user } from "@/db/schema"
import { commonFieldsOmit } from "./shared"

// Schema generated from Drizzle table
export const userSelectSchema = createSelectSchema(user)
export const userInsertSchema = createInsertSchema(user)

// Create user input (omit auto-generated fields)
export const userCreateSchema = userInsertSchema.omit({
  ...commonFieldsOmit,
  emailVerified: true,
})

// Update profile input
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().optional(),
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
})

// Types
export type User = z.infer<typeof userSelectSchema>
export type UserCreate = z.infer<typeof userCreateSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>

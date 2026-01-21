import { z } from "zod"

export const commonFields = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const commonFieldsOmit = {
  id: true,
  createdAt: true,
  updatedAt: true,
} as const

export type CommonFields = z.infer<typeof commonFields>

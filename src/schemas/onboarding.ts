import { z } from "zod"

export const intentSchema = z.enum(["join", "organize", "both"])

export const completeOnboardingSchema = z.object({
  intent: intentSchema,
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  timezone: z.string().min(1, "Timezone is required"),
})

export const saveInterestsSchema = z.object({
  interestIds: z.array(z.string()).min(1, "Select at least one interest"),
})

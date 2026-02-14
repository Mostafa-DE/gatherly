import { z } from "zod"
import { usernameSchema, phoneNumberSchema } from "@/schemas/user"

export const completeOnboardingSchema = z.object({
  country: z.string().min(1, "Country is required"),
  city: z.string().min(1, "City is required"),
  timezone: z.string().min(1, "Timezone is required"),
  username: usernameSchema.optional(),
  phoneNumber: phoneNumberSchema.optional(),
})

export const saveInterestsSchema = z.object({
  interestIds: z.array(z.string()).min(1, "Select at least one interest"),
})

import { z } from "zod"

export const createInviteLinkSchema = z.object({
  expiresAt: z.date().optional(),
  maxUses: z.number().int().positive().optional(),
  role: z.enum(["member", "admin"]).default("member"),
})

export const deactivateInviteLinkSchema = z.object({
  inviteLinkId: z.string(),
})

export type CreateInviteLinkInput = z.infer<typeof createInviteLinkSchema>

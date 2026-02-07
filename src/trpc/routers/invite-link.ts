import { z } from "zod"
import { router, publicProcedure, protectedProcedure, orgProcedure } from "@/trpc"
import { ForbiddenError, NotFoundError, BadRequestError, ConflictError } from "@/exceptions"
import {
  createInviteLink,
  getValidInviteLinkByToken,
  incrementUsedCount,
  listInviteLinks,
  deactivateInviteLink,
} from "@/data-access/invite-links"
import { getOrganizationMemberByUserId } from "@/data-access/organizations"
import { upsertProfile } from "@/data-access/group-member-profiles"
import { auth } from "@/auth"
import { createInviteLinkSchema, deactivateInviteLinkSchema } from "@/schemas/invite-link"

function assertOwnerOrAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action")
  }
}

export const inviteLinkRouter = router({
  create: orgProcedure
    .input(createInviteLinkSchema)
    .mutation(async ({ ctx, input }) => {
      assertOwnerOrAdmin(ctx.membership.role)

      const link = await createInviteLink(
        ctx.activeOrganization.id,
        ctx.user.id,
        input
      )

      return link
    }),

  list: orgProcedure.query(async ({ ctx }) => {
    assertOwnerOrAdmin(ctx.membership.role)

    return listInviteLinks(ctx.activeOrganization.id)
  }),

  deactivate: orgProcedure
    .input(deactivateInviteLinkSchema)
    .mutation(async ({ ctx, input }) => {
      assertOwnerOrAdmin(ctx.membership.role)

      const result = await deactivateInviteLink(
        input.inviteLinkId,
        ctx.activeOrganization.id
      )

      if (!result) {
        throw new NotFoundError("Invite link not found")
      }

      return result
    }),

  validate: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const link = await getValidInviteLinkByToken(input.token)
      return { valid: !!link }
    }),

  useToken: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        formAnswers: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const link = await getValidInviteLinkByToken(input.token)
      if (!link) {
        throw new BadRequestError("Invalid or expired invite link")
      }

      // Check if already a member
      const existingMember = await getOrganizationMemberByUserId(
        link.organizationId,
        ctx.user.id
      )
      if (existingMember) {
        throw new ConflictError("You are already a member of this organization")
      }

      // Add member via Better Auth
      await auth.api.addMember({
        body: {
          userId: ctx.user.id,
          role: link.role as "member" | "admin",
          organizationId: link.organizationId,
        },
      })

      // Save form answers if provided
      if (input.formAnswers && Object.keys(input.formAnswers).length > 0) {
        await upsertProfile(link.organizationId, ctx.user.id, input.formAnswers)
      }

      // Increment usage count
      await incrementUsedCount(link.id)

      return { organizationId: link.organizationId }
    }),
})

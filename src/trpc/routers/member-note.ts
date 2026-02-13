import { router, orgProcedure } from "@/trpc"
import { ForbiddenError, NotFoundError } from "@/exceptions"
import { withOrgScope } from "@/data-access/org-scope"
import {
  createMemberNote,
  listMemberNotes,
  updateMemberNote,
  deleteMemberNote,
} from "@/data-access/member-notes"
import {
  createMemberNoteSchema,
  updateMemberNoteSchema,
  deleteMemberNoteSchema,
  listMemberNotesSchema,
} from "@/schemas/member-note"

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization owners and admins can perform this action")
  }
}

export const memberNoteRouter = router({
  create: orgProcedure
    .input(createMemberNoteSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Validate activity belongs to this org if provided
      if (input.activityId) {
        await withOrgScope(ctx.activeOrganization.id, async (scope) => {
          await scope.requireActivity(input.activityId!)
        })
      }

      return createMemberNote(
        ctx.activeOrganization.id,
        input.targetUserId,
        ctx.user.id,
        input.content,
        input.activityId
      )
    }),

  list: orgProcedure
    .input(listMemberNotesSchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return listMemberNotes(
        ctx.activeOrganization.id,
        input.targetUserId,
        input.activityId
      )
    }),

  update: orgProcedure
    .input(updateMemberNoteSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const updated = await updateMemberNote(
        ctx.activeOrganization.id,
        input.noteId,
        ctx.user.id,
        input.content
      )
      if (!updated) {
        throw new NotFoundError("Note not found or you are not the author")
      }
      return updated
    }),

  delete: orgProcedure
    .input(deleteMemberNoteSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const deleted = await deleteMemberNote(
        ctx.activeOrganization.id,
        input.noteId,
        ctx.user.id
      )
      if (!deleted) {
        throw new NotFoundError("Note not found or you are not the author")
      }
      return { success: true }
    }),
})

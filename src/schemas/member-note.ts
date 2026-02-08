import { z } from "zod"

export const createMemberNoteSchema = z.object({
  targetUserId: z.string(),
  content: z.string().min(1).max(2000),
})

export const updateMemberNoteSchema = z.object({
  noteId: z.string(),
  content: z.string().min(1).max(2000),
})

export const deleteMemberNoteSchema = z.object({
  noteId: z.string(),
})

export const listMemberNotesSchema = z.object({
  targetUserId: z.string(),
})

export type CreateMemberNoteInput = z.infer<typeof createMemberNoteSchema>
export type UpdateMemberNoteInput = z.infer<typeof updateMemberNoteSchema>
export type DeleteMemberNoteInput = z.infer<typeof deleteMemberNoteSchema>
export type ListMemberNotesInput = z.infer<typeof listMemberNotesSchema>

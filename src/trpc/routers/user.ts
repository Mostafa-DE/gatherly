import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "@/trpc"
import { getUserById, updateUser } from "@/data-access/users"
import { updateProfileSchema } from "@/schemas/user"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getUserById(input.id)
    }),

  updateProfile: protectedProcedure
    .input(updateProfileSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user) return null
      return updateUser(ctx.user.id, input)
    }),
})

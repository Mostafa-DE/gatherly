import { router, orgProcedure, publicProcedure } from "@/trpc"
import { z } from "zod"
import { ForbiddenError } from "@/exceptions"
import { withOrgScope } from "@/data-access/org-scope"
import {
  createActivity,
  updateActivity,
  listActivitiesForOrg,
  listPublicActivitiesForOrg,
  listActivitiesWithMemberCount,
  countActiveActivitiesForOrg,
  deactivateActivity,
  reactivateActivity,
  getActivityBySlugForOrg,
} from "@/data-access/activities"
import { TRPCError } from "@trpc/server"
import {
  createActivitySchema,
  updateActivitySchema,
  getActivityByIdSchema,
  getActivityBySlugSchema,
  listActivitiesSchema,
  deactivateActivitySchema,
  reactivateActivitySchema,
} from "@/schemas/activity"

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action")
  }
}

export const activityRouter = router({
  create: orgProcedure
    .input(createActivitySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return createActivity(ctx.activeOrganization.id, ctx.user.id, input)
    }),

  update: orgProcedure
    .input(updateActivitySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivityForMutation(input.activityId)
        return updateActivity(input.activityId, ctx.activeOrganization.id, { name: input.name })
      })
    }),

  getById: orgProcedure
    .input(getActivityByIdSchema)
    .query(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        return scope.requireActivity(input.activityId)
      })
    }),

  getBySlug: orgProcedure
    .input(getActivityBySlugSchema)
    .query(async ({ ctx, input }) => {
      return getActivityBySlugForOrg(input.slug, ctx.activeOrganization.id)
    }),

  list: orgProcedure
    .input(listActivitiesSchema)
    .query(async ({ ctx, input }) => {
      return listActivitiesForOrg(ctx.activeOrganization.id, ctx.user.id, input)
    }),

  listPublic: orgProcedure
    .input(listActivitiesSchema)
    .query(async ({ ctx, input }) => {
      return listPublicActivitiesForOrg(ctx.activeOrganization.id, input)
    }),

  listWithMemberCount: orgProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return listActivitiesWithMemberCount(ctx.activeOrganization.id, {
        includeInactive: input.includeInactive,
      })
    }),

  listPublicByOrg: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => {
      return listPublicActivitiesForOrg(input.organizationId, { limit: 50, offset: 0 })
    }),

  getPublicBySlug: publicProcedure
    .input(z.object({ organizationId: z.string(), slug: z.string() }))
    .query(async ({ input }) => {
      return getActivityBySlugForOrg(input.slug, input.organizationId)
    }),

  deactivate: orgProcedure
    .input(deactivateActivitySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const activeCount = await countActiveActivitiesForOrg(ctx.activeOrganization.id)
      if (activeCount <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot deactivate the last active activity in an organization",
        })
      }

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivityForMutation(input.activityId)
        return deactivateActivity(input.activityId, ctx.activeOrganization.id)
      })
    }),

  reactivate: orgProcedure
    .input(reactivateActivitySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivityForMutation(input.activityId)
        return reactivateActivity(input.activityId, ctx.activeOrganization.id)
      })
    }),
})

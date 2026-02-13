import { router, orgProcedure } from "@/trpc"
import { ForbiddenError, BadRequestError, NotFoundError, ConflictError } from "@/exceptions"
import { withOrgScope } from "@/data-access/org-scope"
import { parseJoinFormSchema, validateJoinFormAnswers } from "@/use-cases/form-validation"
import {
  getActivityMember,
  createActivityMember,
  removeActivityMember,
  listActivityMembers,
  listUserActivityMemberships,
} from "@/data-access/activity-members"
import {
  createActivityJoinRequest,
  getActivityJoinRequestById,
  getPendingActivityRequest,
  listPendingActivityRequests,
  listAllPendingActivityRequestsForOrg,
  countPendingActivityRequestsForOrg,
  approveActivityJoinRequest,
  rejectActivityJoinRequest,
} from "@/data-access/activity-join-requests"
import { getOrganizationMemberByUserId } from "@/data-access/organizations"
import {
  joinActivitySchema,
  requestActivityJoinSchema,
  reviewActivityJoinRequestSchema,
  adminAddActivityMemberSchema,
  removeActivityMemberSchema,
  listActivityMembersSchema,
  listActivityJoinRequestsSchema,
} from "@/schemas/activity-membership"

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action")
  }
}

export const activityMembershipRouter = router({
  join: orgProcedure
    .input(joinActivitySchema)
    .mutation(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const act = await scope.requireActivity(input.activityId)

        if (!act.isActive) {
          throw new BadRequestError("This activity is deactivated and cannot accept new members")
        }

        if (act.joinMode !== "open") {
          throw new BadRequestError("This activity does not allow open joining")
        }

        // Return existing if already a member
        const existing = await getActivityMember(input.activityId, ctx.user.id)
        if (existing) {
          return existing
        }

        return createActivityMember(input.activityId, ctx.user.id, "active")
      })
    }),

  requestJoin: orgProcedure
    .input(requestActivityJoinSchema)
    .mutation(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const act = await scope.requireActivity(input.activityId)

        if (!act.isActive) {
          throw new BadRequestError("This activity is deactivated and cannot accept new members")
        }

        if (act.joinMode !== "require_approval") {
          throw new BadRequestError("This activity does not require join approval")
        }

        // Return existing pending request if one exists (idempotent)
        const existingRequest = await getPendingActivityRequest(input.activityId, ctx.user.id)
        if (existingRequest) {
          return existingRequest
        }

        // Validate form answers if activity has a join form
        const formSchema = parseJoinFormSchema(act.joinFormSchema)
        if (formSchema && formSchema.fields.length > 0) {
          if (!input.formAnswers) {
            throw new BadRequestError("This activity requires a join form to be filled out")
          }
          validateJoinFormAnswers(formSchema, input.formAnswers)
        }

        return createActivityJoinRequest(
          input.activityId,
          ctx.user.id,
          input.message,
          input.formAnswers as Record<string, unknown> | undefined
        )
      })
    }),

  listPendingRequests: orgProcedure
    .input(listActivityJoinRequestsSchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivity(input.activityId)
        return listPendingActivityRequests(input.activityId)
      })
    }),

  listAllPendingRequests: orgProcedure
    .query(async ({ ctx }) => {
      assertAdmin(ctx.membership.role)
      return listAllPendingActivityRequestsForOrg(ctx.activeOrganization.id)
    }),

  countAllPendingRequests: orgProcedure
    .query(async ({ ctx }) => {
      assertAdmin(ctx.membership.role)
      return countPendingActivityRequestsForOrg(ctx.activeOrganization.id)
    }),

  approveRequest: orgProcedure
    .input(reviewActivityJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Verify the request exists and its activity belongs to this org BEFORE mutating
      const pending = await getActivityJoinRequestById(input.requestId)
      if (!pending) {
        throw new NotFoundError("Activity join request not found")
      }
      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivity(pending.activityId)
      })

      // Create active activity member first; only mark request approved once membership exists.
      try {
        await createActivityMember(pending.activityId, pending.userId, "active")
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error
      }

      const request = await approveActivityJoinRequest(input.requestId, ctx.user.id)

      return request
    }),

  rejectRequest: orgProcedure
    .input(reviewActivityJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Verify the request exists and its activity belongs to this org BEFORE mutating
      const pending = await getActivityJoinRequestById(input.requestId)
      if (!pending) {
        throw new NotFoundError("Activity join request not found")
      }
      await withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivity(pending.activityId)
      })

      const request = await rejectActivityJoinRequest(input.requestId, ctx.user.id)

      return request
    }),

  adminAdd: orgProcedure
    .input(adminAddActivityMemberSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        const act = await scope.requireActivityForMutation(input.activityId)
        if (!act.isActive) {
          throw new BadRequestError("This activity is deactivated and cannot accept new members")
        }

        const orgMembership = await getOrganizationMemberByUserId(
          ctx.activeOrganization.id,
          input.userId
        )
        if (!orgMembership) {
          throw new ForbiddenError("User is not a member of this organization")
        }

        return createActivityMember(input.activityId, input.userId, "active")
      })
    }),

  remove: orgProcedure
    .input(removeActivityMemberSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivityForMutation(input.activityId)
        await removeActivityMember(input.activityId, input.userId)
        return { success: true }
      })
    }),

  members: orgProcedure
    .input(listActivityMembersSchema)
    .query(async ({ ctx, input }) => {
      return withOrgScope(ctx.activeOrganization.id, async (scope) => {
        await scope.requireActivity(input.activityId)
        const members = await listActivityMembers(input.activityId, input)

        // Redact email for non-admin callers
        const callerIsAdmin = ctx.membership.role === "owner" || ctx.membership.role === "admin"
        if (!callerIsAdmin) {
          return members.map((m) => ({
            ...m,
            user: { ...m.user, email: null },
          }))
        }
        return members
      })
    }),

  myMemberships: orgProcedure
    .query(async ({ ctx }) => {
      return listUserActivityMemberships(ctx.user.id, ctx.activeOrganization.id)
    }),
})

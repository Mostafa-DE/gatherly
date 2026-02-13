import { z } from "zod"
import { router, protectedProcedure, orgProcedure } from "@/trpc"
import { ForbiddenError, NotFoundError, BadRequestError } from "@/exceptions"
import { auth } from "@/auth"
import {
  createJoinRequest,
  cancelJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
  getJoinRequestByIdForOrg,
  getJoinRequestWithDetailsForOrg,
  getPendingRequest,
  listPendingRequestsForOrg,
  listMyJoinRequests,
} from "@/data-access/join-requests"
import {
  getOrganizationById,
  getOrganizationMemberByUserId,
} from "@/data-access/organizations"
import {
  createJoinRequestSchema,
  cancelJoinRequestSchema,
  reviewJoinRequestSchema,
} from "@/schemas/join-request"
import { upsertProfile } from "@/data-access/group-member-profiles"

// =============================================================================
// Helper: Check if user is admin (owner or admin role)
// =============================================================================

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action")
  }
}

// =============================================================================
// Join Request Router
// =============================================================================

export const joinRequestRouter = router({
  /**
   * Create a join request (for approval mode orgs)
   * User must be authenticated, org must use approval mode
   */
  request: protectedProcedure
    .input(createJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      // Get organization info
      const org = await getOrganizationById(input.organizationId)

      if (!org) {
        throw new NotFoundError("Organization not found")
      }

      // Check join mode
      if (org.defaultJoinMode !== "approval") {
        if (org.defaultJoinMode === "open") {
          throw new BadRequestError(
            "This organization allows direct joining. Use the join endpoint instead."
          )
        }
        if (org.defaultJoinMode === "invite") {
          throw new BadRequestError(
            "This organization is invite-only. You need an invitation to join."
          )
        }
      }

      // Check if user is already a member
      const existingMember = await getOrganizationMemberByUserId(
        input.organizationId,
        ctx.user.id
      )

      if (existingMember) {
        throw new BadRequestError("You are already a member of this organization")
      }

      // Create the join request
      return createJoinRequest(input.organizationId, ctx.user.id, input.message, input.formAnswers)
    }),

  /**
   * Cancel own pending join request
   */
  cancel: protectedProcedure
    .input(cancelJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      return cancelJoinRequest(input.requestId, ctx.user.id)
    }),

  /**
   * Get current user's join requests across all orgs
   */
  myRequests: protectedProcedure.query(async ({ ctx }) => {
    return listMyJoinRequests(ctx.user.id)
  }),

  /**
   * Get pending request status for a specific org
   */
  myPendingRequest: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getPendingRequest(input.organizationId, ctx.user.id)
    }),

  /**
   * List pending requests for organization (Admin only)
   */
  listPending: orgProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.membership.role)
    return listPendingRequestsForOrg(ctx.activeOrganization.id)
  }),

  /**
   * Approve a join request (Admin only)
   * Adds user as member via Better Auth API
   */
  approve: orgProcedure
    .input(reviewJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Get the request with details
      const requestData = await getJoinRequestWithDetailsForOrg(
        input.requestId,
        ctx.activeOrganization.id
      )
      if (!requestData) {
        throw new NotFoundError("Join request not found")
      }

      // Add user as member first; only mark request approved once membership exists.
      await auth.api.addMember({
        body: {
          userId: requestData.request.userId,
          role: "member",
          organizationId: ctx.activeOrganization.id,
        },
      })

      const updatedRequest = await approveJoinRequest(input.requestId, ctx.user.id)

      // Save form answers as profile if present
      const formAnswers = requestData.request.formAnswers as Record<string, unknown> | null
      if (formAnswers && Object.keys(formAnswers).length > 0) {
        await upsertProfile(
          ctx.activeOrganization.id,
          requestData.request.userId,
          formAnswers
        )
      }

      return updatedRequest
    }),

  /**
   * Reject a join request (Admin only)
   */
  reject: orgProcedure
    .input(reviewJoinRequestSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      // Get the request
      const request = await getJoinRequestByIdForOrg(
        input.requestId,
        ctx.activeOrganization.id
      )
      if (!request) {
        throw new NotFoundError("Join request not found")
      }

      return rejectJoinRequest(input.requestId, ctx.user.id)
    }),
})

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, orgProcedure } from "@/trpc";
import { ForbiddenError, NotFoundError, BadRequestError } from "@/exceptions";
import { organization, member, invitation, user } from "@/db/auth-schema";
import { auth } from "@/auth";

// =============================================================================
// Helper: Check if user is admin (owner or admin role)
// =============================================================================

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action");
  }
}

function assertOwner(role: string): void {
  if (role !== "owner") {
    throw new ForbiddenError("Only organization owners can perform this action");
  }
}

// =============================================================================
// Organization Router
// =============================================================================

export const organizationRouter = router({
  /**
   * Get public organization info by slug (for public org page)
   */
  getPublicInfo: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [org] = await ctx.db
        .select({
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          logo: organization.logo,
          defaultJoinMode: organization.defaultJoinMode,
        })
        .from(organization)
        .where(eq(organization.slug, input.slug))
        .limit(1);

      if (!org) {
        throw new NotFoundError("Organization not found");
      }

      // Get member count
      const members = await ctx.db
        .select()
        .from(member)
        .where(eq(member.organizationId, org.id));

      return {
        ...org,
        memberCount: members.length,
      };
    }),

  /**
   * Join an organization directly (for open mode orgs)
   */
  joinOrg: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get organization info
      const [org] = await ctx.db
        .select()
        .from(organization)
        .where(eq(organization.id, input.organizationId))
        .limit(1);

      if (!org) {
        throw new NotFoundError("Organization not found");
      }

      // Check join mode
      if (org.defaultJoinMode !== "open") {
        if (org.defaultJoinMode === "approval") {
          throw new BadRequestError(
            "This organization requires approval to join. Please submit a join request."
          );
        }
        if (org.defaultJoinMode === "invite") {
          throw new BadRequestError(
            "This organization is invite-only. You need an invitation to join."
          );
        }
      }

      // Check if user is already a member
      const [existingMember] = await ctx.db
        .select()
        .from(member)
        .where(
          and(
            eq(member.organizationId, input.organizationId),
            eq(member.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new BadRequestError("You are already a member of this organization");
      }

      // Add user as member via Better Auth
      await auth.api.addMember({
        body: {
          userId: ctx.user.id,
          role: "member",
          organizationId: input.organizationId,
        },
      });

      return { success: true };
    }),

  /**
   * List organization members (Admin only)
   */
  listMembers: orgProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        member: member,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, ctx.activeOrganization.id));
  }),

  /**
   * Invite a member by email (Admin only)
   */
  inviteMember: orgProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["member", "admin"]).default("member"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);

      // Check if user is already a member by email
      const [existingUser] = await ctx.db
        .select()
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1);

      if (existingUser) {
        const [existingMember] = await ctx.db
          .select()
          .from(member)
          .where(
            and(
              eq(member.organizationId, ctx.activeOrganization.id),
              eq(member.userId, existingUser.id)
            )
          )
          .limit(1);

        if (existingMember) {
          throw new BadRequestError("This user is already a member of the organization");
        }
      }

      // Check for existing pending invitation
      const [existingInvitation] = await ctx.db
        .select()
        .from(invitation)
        .where(
          and(
            eq(invitation.organizationId, ctx.activeOrganization.id),
            eq(invitation.email, input.email),
            eq(invitation.status, "pending")
          )
        )
        .limit(1);

      if (existingInvitation) {
        throw new BadRequestError("An invitation has already been sent to this email");
      }

      // Send invitation via Better Auth
      await auth.api.createInvitation({
        body: {
          email: input.email,
          role: input.role,
          organizationId: ctx.activeOrganization.id,
        },
        headers: ctx.headers,
      });

      return { success: true };
    }),

  /**
   * List pending invitations (Admin only)
   */
  listInvitations: orgProcedure.query(async ({ ctx }) => {
    assertAdmin(ctx.membership.role);

    return ctx.db
      .select({
        invitation: invitation,
        inviter: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      })
      .from(invitation)
      .innerJoin(user, eq(invitation.inviterId, user.id))
      .where(
        and(
          eq(invitation.organizationId, ctx.activeOrganization.id),
          eq(invitation.status, "pending")
        )
      );
  }),

  /**
   * Cancel a pending invitation (Admin only)
   */
  cancelInvitation: orgProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);

      // Get the invitation
      const [inv] = await ctx.db
        .select()
        .from(invitation)
        .where(eq(invitation.id, input.invitationId))
        .limit(1);

      if (!inv) {
        throw new NotFoundError("Invitation not found");
      }

      if (inv.organizationId !== ctx.activeOrganization.id) {
        throw new ForbiddenError("Invitation does not belong to this organization");
      }

      if (inv.status !== "pending") {
        throw new BadRequestError("Only pending invitations can be cancelled");
      }

      // Cancel via Better Auth
      await auth.api.cancelInvitation({
        body: {
          invitationId: input.invitationId,
        },
        headers: ctx.headers,
      });

      return { success: true };
    }),

  /**
   * Remove a member (Admin only, cannot remove owner)
   */
  removeMember: orgProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role);

      // Get the member
      const [targetMember] = await ctx.db
        .select()
        .from(member)
        .where(eq(member.id, input.memberId))
        .limit(1);

      if (!targetMember) {
        throw new NotFoundError("Member not found");
      }

      if (targetMember.organizationId !== ctx.activeOrganization.id) {
        throw new ForbiddenError("Member does not belong to this organization");
      }

      // Cannot remove owner
      if (targetMember.role === "owner") {
        throw new ForbiddenError("Cannot remove the organization owner");
      }

      // Cannot remove yourself
      if (targetMember.userId === ctx.user.id) {
        throw new BadRequestError("Cannot remove yourself. Leave the organization instead.");
      }

      // Remove via Better Auth
      await auth.api.removeMember({
        body: {
          memberIdOrEmail: targetMember.id,
          organizationId: ctx.activeOrganization.id,
        },
        headers: ctx.headers,
      });

      return { success: true };
    }),

  /**
   * Update a member's role (Owner only)
   */
  updateMemberRole: orgProcedure
    .input(
      z.object({
        memberId: z.string(),
        role: z.enum(["member", "admin"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role);

      // Get the member
      const [targetMember] = await ctx.db
        .select()
        .from(member)
        .where(eq(member.id, input.memberId))
        .limit(1);

      if (!targetMember) {
        throw new NotFoundError("Member not found");
      }

      if (targetMember.organizationId !== ctx.activeOrganization.id) {
        throw new ForbiddenError("Member does not belong to this organization");
      }

      // Cannot change owner role
      if (targetMember.role === "owner") {
        throw new ForbiddenError("Cannot change the role of the organization owner");
      }

      // Update via Better Auth
      await auth.api.updateMemberRole({
        body: {
          memberId: input.memberId,
          role: input.role,
          organizationId: ctx.activeOrganization.id,
        },
        headers: ctx.headers,
      });

      return { success: true };
    }),
});

import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure, orgProcedure } from "@/trpc";
import { ForbiddenError, NotFoundError } from "@/exceptions";
import { organization, member, invitation, user } from "@/db/auth-schema";
import { auth } from "@/auth";
import {
  getInvitationById,
  getMemberById,
  getOrganizationById,
  getOrganizationMemberByUserId,
  getPendingInvitationByEmail,
  updateOrganizationById,
  getUserByEmail,
} from "@/data-access/organizations";
import {
  cancelOrganizationInvitation,
  inviteMemberToOrganization,
} from "@/use-cases/organization-invitations";
import {
  joinOrganization,
  removeOrganizationMember,
  updateOrganizationMemberRole,
  updateOrganizationSettings,
} from "@/use-cases/organization-membership";
import { getOrgSettings } from "@/data-access/organization-settings";
import { upsertProfile } from "@/data-access/group-member-profiles";

// =============================================================================
// Helper: Check if user is admin (owner or admin role)
// =============================================================================

function assertOwnerOrAdmin(role: string): void {
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
   * Get join form schema for an organization (Public)
   * Returns the form fields users need to fill when joining
   */
  getJoinFormSchema: publicProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ input }) => {
      const settings = await getOrgSettings(input.organizationId);
      return {
        joinFormSchema: settings?.joinFormSchema ?? null,
      };
    }),

  /**
   * Join an organization directly (for open mode orgs)
   */
  joinOrg: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      formAnswers: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await joinOrganization(
        {
          getOrganizationById,
          getOrganizationMemberByUserId,
          addMember: async ({ organizationId, userId, role }) => {
            await auth.api.addMember({
              body: {
                userId,
                role,
                organizationId,
              },
            });
          },
        },
        {
          organizationId: input.organizationId,
          userId: ctx.user.id,
        }
      );

      // Save form answers as profile if provided
      if (input.formAnswers && Object.keys(input.formAnswers).length > 0) {
        await upsertProfile(input.organizationId, ctx.user.id, input.formAnswers);
      }

      return result;
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
      assertOwnerOrAdmin(ctx.membership.role);

      return inviteMemberToOrganization(
        {
          getUserByEmail,
          getOrganizationMemberByUserId,
          getPendingInvitationByEmail,
          createInvitation: async ({ organizationId, email, role }) => {
            await auth.api.createInvitation({
              body: {
                email,
                role,
                organizationId,
              },
              headers: ctx.headers,
            });
          },
        },
        {
          organizationId: ctx.activeOrganization.id,
          email: input.email,
          role: input.role,
        }
      );
    }),

  /**
   * List pending invitations (Admin only)
   */
  listInvitations: orgProcedure.query(async ({ ctx }) => {
    assertOwnerOrAdmin(ctx.membership.role);

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
      assertOwnerOrAdmin(ctx.membership.role);

      return cancelOrganizationInvitation(
        {
          getInvitationById,
          cancelInvitation: async (invitationId) => {
            await auth.api.cancelInvitation({
              body: {
                invitationId,
              },
              headers: ctx.headers,
            });
          },
        },
        {
          organizationId: ctx.activeOrganization.id,
          invitationId: input.invitationId,
        }
      );
    }),

  /**
   * Remove a member (Admin only, cannot remove owner)
   */
  removeMember: orgProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      assertOwnerOrAdmin(ctx.membership.role);

      return removeOrganizationMember(
        {
          getMemberById,
          removeMember: async ({ memberIdOrEmail, organizationId }) => {
            await auth.api.removeMember({
              body: {
                memberIdOrEmail,
                organizationId,
              },
              headers: ctx.headers,
            });
          },
        },
        {
          organizationId: ctx.activeOrganization.id,
          memberId: input.memberId,
          actorUserId: ctx.user.id,
        }
      );
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

      return updateOrganizationMemberRole(
        {
          getMemberById,
          updateMemberRole: async ({ memberId, role, organizationId }) => {
            await auth.api.updateMemberRole({
              body: {
                memberId,
                role,
                organizationId,
              },
              headers: ctx.headers,
            })
          },
        },
        {
          organizationId: ctx.activeOrganization.id,
          memberId: input.memberId,
          role: input.role,
        }
      )
    }),

  /**
   * Update organization settings (Owner only)
   * Simple CRUD - direct DB access
   */
  updateSettings: orgProcedure
    .input(
      z.object({
        timezone: z.string().max(100).nullable().optional(),
        defaultJoinMode: z.enum(["open", "invite", "approval"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertOwner(ctx.membership.role)
      return updateOrganizationSettings(
        {
          updateOrganizationById,
        },
        {
          organizationId: ctx.activeOrganization.id,
          timezone: input.timezone ?? undefined,
          defaultJoinMode: input.defaultJoinMode,
        }
      )
    }),
})

import { router, orgProcedure } from "@/trpc"
import { ForbiddenError } from "@/exceptions"
import {
  getOrCreateOrgSettings,
  updateJoinFormSchema,
  updateOrgCurrency,
} from "@/data-access/organization-settings"
import {
  getOrgSettingsSchema,
  updateJoinFormSchema as updateJoinFormInputSchema,
  updateCurrencySchema,
} from "@/schemas/organization-settings"

// =============================================================================
// Helper: Check if user is admin (owner or admin role)
// =============================================================================

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action")
  }
}

// =============================================================================
// Organization Settings Router
// =============================================================================

export const organizationSettingsRouter = router({
  /**
   * Get organization settings (Member)
   * Creates default settings if none exist
   */
  get: orgProcedure
    .input(getOrgSettingsSchema)
    .query(async ({ ctx }) => {
      return getOrCreateOrgSettings(ctx.activeOrganization.id)
    }),

  /**
   * Update join form schema (Admin)
   * Increments form version when schema changes
   */
  updateJoinForm: orgProcedure
    .input(updateJoinFormInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return updateJoinFormSchema(
        ctx.activeOrganization.id,
        input.joinFormSchema
      )
    }),

  /**
   * Update organization currency (Admin)
   */
  updateCurrency: orgProcedure
    .input(updateCurrencySchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return updateOrgCurrency(ctx.activeOrganization.id, input.currency)
    }),
})

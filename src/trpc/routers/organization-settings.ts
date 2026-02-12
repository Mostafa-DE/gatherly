import { z } from "zod"
import { router, orgProcedure } from "@/trpc"
import { ForbiddenError, BadRequestError } from "@/exceptions"
import {
  getOrCreateOrgSettings,
  updateJoinFormSchema,
  updateOrgCurrency,
  updateEnabledPlugins,
} from "@/data-access/organization-settings"
import {
  getOrgSettingsSchema,
  updateJoinFormSchema as updateJoinFormInputSchema,
  updateCurrencySchema,
} from "@/schemas/organization-settings"
import { pluginMetaMap } from "@/plugins/catalog"

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

  /**
   * Toggle a plugin on/off (Admin)
   */
  togglePlugin: orgProcedure
    .input(z.object({ pluginId: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      const pluginMeta = pluginMetaMap[input.pluginId]

      if (!pluginMeta) {
        throw new BadRequestError(`Unknown plugin: ${input.pluginId}`)
      }

      if (pluginMeta.alwaysEnabled) {
        throw new BadRequestError(
          pluginMeta.alwaysEnabledReason ??
            `${pluginMeta.name} is always enabled and cannot be disabled.`
        )
      }

      return updateEnabledPlugins(
        ctx.activeOrganization.id,
        input.pluginId,
        input.enabled
      )
    }),
})

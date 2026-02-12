import { router, orgProcedure } from "@/trpc"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import { checkOllamaHealth } from "@/plugins/ai/client"
import { executeAIFeatureStream } from "@/plugins/ai/execute"
import {
  suggestSessionDescription,
  suggestMemberNote,
  summarizeJoinRequest,
  suggestParticipationNote,
  summarizeMemberProfile,
  analyzeAnalytics,
} from "@/plugins/ai/features"

function isPluginEnabled(enabledPlugins: unknown, pluginId: string): boolean {
  if (!enabledPlugins || typeof enabledPlugins !== "object") return false
  return (enabledPlugins as Record<string, boolean>)[pluginId] === true
}

export const aiRouter = router({
  checkAvailability: orgProcedure.query(async ({ ctx }) => {
    const settings = await getOrCreateOrgSettings(ctx.activeOrganization.id)
    const enabled = isPluginEnabled(settings.enabledPlugins, "ai")

    if (!enabled) {
      return { available: false }
    }

    const healthy = await checkOllamaHealth()
    return { available: healthy }
  }),

  suggestSessionDescription: orgProcedure
    .input(suggestSessionDescription.inputSchema)
    .query(async function* ({ ctx, input }) {
      yield* executeAIFeatureStream(suggestSessionDescription, ctx, input)
    }),

  suggestMemberNote: orgProcedure
    .input(suggestMemberNote.inputSchema)
    .query(async function* ({ ctx, input }) {
      yield* executeAIFeatureStream(suggestMemberNote, ctx, input)
    }),

  summarizeJoinRequest: orgProcedure
    .input(summarizeJoinRequest.inputSchema)
    .query(async function* ({ ctx, input }) {
      yield* executeAIFeatureStream(summarizeJoinRequest, ctx, input)
    }),

  suggestParticipationNote: orgProcedure
    .input(suggestParticipationNote.inputSchema)
    .query(async function* ({ ctx, input }) {
      yield* executeAIFeatureStream(suggestParticipationNote, ctx, input)
    }),

  summarizeMemberProfile: orgProcedure
    .input(summarizeMemberProfile.inputSchema)
    .query(async function* ({ ctx, input }) {
      yield* executeAIFeatureStream(summarizeMemberProfile, ctx, input)
    }),

  analyzeAnalytics: orgProcedure
    .input(analyzeAnalytics.inputSchema)
    .query(async function* ({ ctx, input }) {
      yield* executeAIFeatureStream(analyzeAnalytics, ctx, input)
    }),
})

import type { z } from "zod"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import { composePrompt } from "@/plugins/ai/prompt-builder"
import { checkOllamaHealth, generateText, generateTextStream } from "@/plugins/ai/client"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import { ForbiddenError, BadRequestError } from "@/exceptions"

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization admins can perform this action")
  }
}

function isPluginEnabled(enabledPlugins: unknown, pluginId: string): boolean {
  if (!enabledPlugins || typeof enabledPlugins !== "object") return false
  return (enabledPlugins as Record<string, boolean>)[pluginId] === true
}

export async function executeAIFeature<TInput extends z.ZodType>(
  feature: AIFeature<TInput>,
  ctx: AIFeatureContext,
  input: z.infer<TInput>
): Promise<string> {
  if (feature.access === "admin") {
    assertAdmin(ctx.membership.role)
  }

  const settings = await getOrCreateOrgSettings(ctx.activeOrganization.id)
  if (!isPluginEnabled(settings.enabledPlugins, "ai")) {
    throw new ForbiddenError("AI plugin is not enabled for this organization")
  }

  const healthy = await checkOllamaHealth()
  if (!healthy) {
    throw new BadRequestError("AI service is currently unavailable")
  }

  const context = await feature.fetchContext(ctx, input)
  const sections = feature.buildPrompt(input, context)
  const prompt = composePrompt(sections)

  return generateText({
    model: feature.model,
    prompt,
    stream: false,
    options: {
      temperature: feature.temperature ?? 0.7,
      top_p: feature.topP ?? 0.9,
    },
  })
}

export async function* executeAIFeatureStream<TInput extends z.ZodType>(
  feature: AIFeature<TInput>,
  ctx: AIFeatureContext,
  input: z.infer<TInput>
): AsyncGenerator<string> {
  if (feature.access === "admin") {
    assertAdmin(ctx.membership.role)
  }

  const settings = await getOrCreateOrgSettings(ctx.activeOrganization.id)
  if (!isPluginEnabled(settings.enabledPlugins, "ai")) {
    throw new ForbiddenError("AI plugin is not enabled for this organization")
  }

  const healthy = await checkOllamaHealth()
  if (!healthy) {
    throw new BadRequestError("AI service is currently unavailable")
  }

  const context = await feature.fetchContext(ctx, input)
  const sections = feature.buildPrompt(input, context)
  const prompt = composePrompt(sections)

  yield* generateTextStream({
    model: feature.model,
    prompt,
    options: {
      temperature: feature.temperature ?? 0.7,
      top_p: feature.topP ?? 0.9,
    },
  })
}

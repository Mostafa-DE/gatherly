import type { z } from "zod"
import type { AIFeature, AIFeatureContext } from "@/plugins/ai/types"
import { resolveAIModel, resolveAINumPredict } from "@/plugins/ai/config"
import { composePrompt } from "@/plugins/ai/prompt-builder"
import { generateText, generateTextStream } from "@/plugins/ai/client"
import { getOrCreateOrgSettings } from "@/data-access/organization-settings"
import { buildPIIReplacements, sanitizePrompt } from "@/plugins/ai/sanitize"
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

function toAIRequestError(error: unknown, model: string): BadRequestError {
  if (!(error instanceof Error)) {
    return new BadRequestError("AI service is currently unavailable")
  }

  if (error.name === "AbortError") {
    return new BadRequestError("AI request timed out")
  }

  if (error.message.includes("404")) {
    return new BadRequestError(`AI model "${model}" is not available`)
  }

  return new BadRequestError("AI service is currently unavailable")
}

function sanitize<TInput extends z.ZodType>(
  prompt: string,
  feature: AIFeature<TInput>,
  ctx: AIFeatureContext,
  context: unknown
): string {
  const additionalPII = feature.collectPII?.(context) ?? []
  const replacements = buildPIIReplacements(ctx, additionalPII)
  return sanitizePrompt(prompt, replacements)
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

  const context = await feature.fetchContext(ctx, input)
  const sections = feature.buildPrompt(input, context)
  const rawPrompt = composePrompt(sections)
  const prompt = sanitize(rawPrompt, feature, ctx, context)
  const model = resolveAIModel(feature)

  try {
    return await generateText({
      model,
      prompt,
      stream: false,
      options: {
        temperature: feature.temperature ?? 0.7,
        top_p: feature.topP ?? 0.9,
        num_predict: resolveAINumPredict(),
      },
    })
  } catch (error) {
    throw toAIRequestError(error, model)
  }
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

  const context = await feature.fetchContext(ctx, input)
  const sections = feature.buildPrompt(input, context)
  const rawPrompt = composePrompt(sections)
  const prompt = sanitize(rawPrompt, feature, ctx, context)
  const model = resolveAIModel(feature)

  try {
    yield* generateTextStream({
      model,
      prompt,
      options: {
        temperature: feature.temperature ?? 0.7,
        top_p: feature.topP ?? 0.9,
        num_predict: resolveAINumPredict(),
      },
    })
  } catch (error) {
    throw toAIRequestError(error, model)
  }
}

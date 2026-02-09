import type { PromptSections } from "@/plugins/ai/types"

export function composePrompt(sections: PromptSections): string {
  const parts: string[] = []

  parts.push(sections.role)
  parts.push(sections.task)

  if (sections.examples && sections.examples.length > 0) {
    const list = sections.examples.map((ex) => `- "${ex}"`).join("\n")
    parts.push(`Here are examples for tone and style reference:\n${list}`)
  }

  if (sections.rules.length > 0) {
    const list = sections.rules.map((r) => `- ${r}`).join("\n")
    parts.push(`Instructions:\n${list}`)
  }

  return parts.join("\n\n")
}

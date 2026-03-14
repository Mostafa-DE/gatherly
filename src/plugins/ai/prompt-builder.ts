import type { ChatMessage, PromptSections } from "@/plugins/ai/types"

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

  parts.push(
    [
      "IMPORTANT:",
      "- ONLY use information explicitly provided in the data above. Do NOT infer, assume, or fabricate any details.",
      "- If the provided data is insufficient or empty, explicitly state that not enough information is available rather than guessing.",
      "- Do not assume the user has any prior history, group membership, or interactions unless the data explicitly shows it.",
    ].join("\n")
  )

  return parts.join("\n\n")
}

export function composeMessages(sections: PromptSections): ChatMessage[] {
  const systemParts: string[] = [sections.role]

  if (sections.rules.length > 0) {
    const list = sections.rules.map((r) => `- ${r}`).join("\n")
    systemParts.push(`Instructions:\n${list}`)
  }

  systemParts.push(
    [
      "IMPORTANT:",
      "- ONLY use information explicitly provided in the data above. Do NOT infer, assume, or fabricate any details.",
      "- If the provided data is insufficient or empty, explicitly state that not enough information is available rather than guessing.",
      "- Do not assume the user has any prior history, group membership, or interactions unless the data explicitly shows it.",
    ].join("\n")
  )

  const userParts: string[] = [sections.task]

  if (sections.examples && sections.examples.length > 0) {
    const list = sections.examples.map((ex) => `- "${ex}"`).join("\n")
    userParts.push(`Here are examples for tone and style reference:\n${list}`)
  }

  return [
    { role: "system", content: systemParts.join("\n\n") },
    { role: "user", content: userParts.join("\n\n") },
  ]
}

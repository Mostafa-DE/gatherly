import { describe, it, expect } from "vitest"
import { composePrompt, composeMessages } from "@/plugins/ai/prompt-builder"
import type { PromptSections } from "@/plugins/ai/types"

const SAFETY_BLOCK = [
  "IMPORTANT:",
  "- ONLY use information explicitly provided in the data above. Do NOT infer, assume, or fabricate any details.",
  "- If the provided data is insufficient or empty, explicitly state that not enough information is available rather than guessing.",
  "- Do not assume the user has any prior history, group membership, or interactions unless the data explicitly shows it.",
].join("\n")

describe("composePrompt", () => {
  it("combines role, task, and rules into a single string", () => {
    const sections: PromptSections = {
      role: "You are a helpful assistant.",
      task: "Summarize the following text.",
      rules: ["Be concise", "Use bullet points"],
    }

    const result = composePrompt(sections)

    expect(result).toContain("You are a helpful assistant.")
    expect(result).toContain("Summarize the following text.")
    expect(result).toContain("Instructions:\n- Be concise\n- Use bullet points")
  })

  it("includes examples when provided", () => {
    const sections: PromptSections = {
      role: "You are a writer.",
      task: "Write a tagline.",
      examples: ["Just do it", "Think different"],
      rules: ["Keep it short"],
    }

    const result = composePrompt(sections)

    expect(result).toContain('Here are examples for tone and style reference:')
    expect(result).toContain('- "Just do it"')
    expect(result).toContain('- "Think different"')
  })

  it("omits examples section when not provided", () => {
    const sections: PromptSections = {
      role: "You are a writer.",
      task: "Write a tagline.",
      rules: ["Keep it short"],
    }

    const result = composePrompt(sections)

    expect(result).not.toContain("examples for tone and style reference")
  })

  it("omits examples section when examples array is empty", () => {
    const sections: PromptSections = {
      role: "You are a writer.",
      task: "Write a tagline.",
      examples: [],
      rules: ["Keep it short"],
    }

    const result = composePrompt(sections)

    expect(result).not.toContain("examples for tone and style reference")
  })

  it("always includes safety instructions at the end", () => {
    const sections: PromptSections = {
      role: "You are a bot.",
      task: "Do something.",
      rules: [],
    }

    const result = composePrompt(sections)

    expect(result).toContain(SAFETY_BLOCK)
    expect(result.endsWith(SAFETY_BLOCK)).toBe(true)
  })

  it("separates sections by double newlines", () => {
    const sections: PromptSections = {
      role: "Role text",
      task: "Task text",
      examples: ["Example one"],
      rules: ["Rule one"],
    }

    const result = composePrompt(sections)
    const parts = result.split("\n\n")

    expect(parts[0]).toBe("Role text")
    expect(parts[1]).toBe("Task text")
    expect(parts[2]).toContain("examples for tone and style reference")
    expect(parts[3]).toContain("Instructions:")
  })

  it("omits instructions section when rules array is empty", () => {
    const sections: PromptSections = {
      role: "You are a bot.",
      task: "Do something.",
      rules: [],
    }

    const result = composePrompt(sections)

    expect(result).not.toContain("Instructions:")
  })
})

describe("composeMessages", () => {
  it("returns exactly 2 messages (system + user)", () => {
    const sections: PromptSections = {
      role: "You are a helpful assistant.",
      task: "Summarize the data.",
      rules: ["Be concise"],
    }

    const messages = composeMessages(sections)

    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe("system")
    expect(messages[1].role).toBe("user")
  })

  it("system message contains role, rules, and safety instructions", () => {
    const sections: PromptSections = {
      role: "You are a helpful assistant.",
      task: "Summarize the data.",
      rules: ["Be concise", "Use bullet points"],
    }

    const messages = composeMessages(sections)
    const system = messages[0].content

    expect(system).toContain("You are a helpful assistant.")
    expect(system).toContain("Instructions:\n- Be concise\n- Use bullet points")
    expect(system).toContain(SAFETY_BLOCK)
  })

  it("user message contains task and examples", () => {
    const sections: PromptSections = {
      role: "You are a writer.",
      task: "Write a tagline.",
      examples: ["Just do it", "Think different"],
      rules: ["Keep it short"],
    }

    const messages = composeMessages(sections)
    const user = messages[1].content

    expect(user).toContain("Write a tagline.")
    expect(user).toContain('- "Just do it"')
    expect(user).toContain('- "Think different"')
  })

  it("examples go in user message, not system message", () => {
    const sections: PromptSections = {
      role: "You are a writer.",
      task: "Write a tagline.",
      examples: ["Just do it"],
      rules: ["Keep it short"],
    }

    const messages = composeMessages(sections)

    expect(messages[0].content).not.toContain("examples for tone and style reference")
    expect(messages[1].content).toContain("examples for tone and style reference")
  })

  it("rules go in system message, not user message", () => {
    const sections: PromptSections = {
      role: "You are a writer.",
      task: "Write a tagline.",
      rules: ["Keep it short", "Be creative"],
    }

    const messages = composeMessages(sections)

    expect(messages[0].content).toContain("Instructions:")
    expect(messages[1].content).not.toContain("Instructions:")
  })

  it("works with no examples", () => {
    const sections: PromptSections = {
      role: "You are a bot.",
      task: "Do the thing.",
      rules: ["Rule A"],
    }

    const messages = composeMessages(sections)

    expect(messages[1].content).toBe("Do the thing.")
    expect(messages[1].content).not.toContain("examples for tone and style reference")
  })

  it("works with empty examples array", () => {
    const sections: PromptSections = {
      role: "You are a bot.",
      task: "Do the thing.",
      examples: [],
      rules: ["Rule A"],
    }

    const messages = composeMessages(sections)

    expect(messages[1].content).toBe("Do the thing.")
    expect(messages[1].content).not.toContain("examples for tone and style reference")
  })

  it("works with no rules (empty array)", () => {
    const sections: PromptSections = {
      role: "You are a bot.",
      task: "Do the thing.",
      rules: [],
    }

    const messages = composeMessages(sections)
    const system = messages[0].content

    expect(system).toContain("You are a bot.")
    expect(system).not.toContain("Instructions:")
    expect(system).toContain(SAFETY_BLOCK)
  })
})

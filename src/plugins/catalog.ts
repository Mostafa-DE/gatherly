export type PluginMeta = {
  id: string
  name: string
  description: string
}

export const pluginCatalog: PluginMeta[] = [
  {
    id: "ai",
    name: "AI Assistant",
    description: "AI-powered suggestions for session descriptions, member insights, and more",
  },
]

export const pluginMetaMap = Object.fromEntries(
  pluginCatalog.map((p) => [p.id, p])
)

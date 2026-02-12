export type PluginMeta = {
  id: string
  name: string
  description: string
  alwaysEnabled?: boolean
  alwaysEnabledReason?: string
}

export const pluginCatalog: PluginMeta[] = [
  {
    id: "ai",
    name: "AI Assistant",
    description: "AI-powered suggestions for session descriptions, member insights, and more",
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Group analytics and insights for organizers",
    alwaysEnabled: true,
    alwaysEnabledReason:
      "Analytics is a core capability and is always enabled for every group.",
  },
]

export const pluginMetaMap = Object.fromEntries(
  pluginCatalog.map((p) => [p.id, p])
)

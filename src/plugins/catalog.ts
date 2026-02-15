export type PluginMeta = {
  id: string
  name: string
  description: string
  scope: "org" | "activity"
  alwaysEnabled?: boolean
  alwaysEnabledReason?: string
}

export const pluginCatalog: PluginMeta[] = [
  {
    id: "ai",
    name: "AI Assistant",
    description: "AI-powered suggestions for session descriptions, member insights, and more",
    scope: "org",
  },
  {
    id: "analytics",
    name: "Analytics",
    description: "Group analytics and insights for organizers",
    scope: "activity",
    alwaysEnabled: true,
    alwaysEnabledReason:
      "Analytics is a core capability and is always enabled for every group.",
  },
  {
    id: "ranking",
    name: "Rankings",
    description: "Member ranking system with levels and stats tracking per activity",
    scope: "activity",
  },
]

export const pluginMetaMap = Object.fromEntries(
  pluginCatalog.map((p) => [p.id, p])
)

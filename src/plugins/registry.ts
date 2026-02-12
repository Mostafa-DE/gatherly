import { router } from "@/trpc"
import { aiRouter } from "@/plugins/ai/router"
import { analyticsRouter } from "@/plugins/analytics/router"
import { pluginCatalog, pluginMetaMap } from "@/plugins/catalog"

export { pluginCatalog, pluginMetaMap }

export const pluginRouter = router({
  ai: aiRouter,
  analytics: analyticsRouter,
})

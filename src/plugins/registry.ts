import { router } from "@/trpc"
import { aiRouter } from "@/plugins/ai/router"
import { pluginCatalog, pluginMetaMap } from "@/plugins/catalog"

export { pluginCatalog, pluginMetaMap }

export const pluginRouter = router({
  ai: aiRouter,
})

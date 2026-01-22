import { createStart } from "@tanstack/react-start"
import { globalRequestMiddlewares } from "@/middlewares"

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [...globalRequestMiddlewares],
  }
})

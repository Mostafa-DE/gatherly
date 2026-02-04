import { defineConfig } from "vitest/config"
import viteTsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    name: "server",
    environment: "node",
    globalSetup: "./src/tests/global-setup.ts",
    include: ["src/**/*.server.spec.ts", "src/**/*.server.spec.tsx"],
  },
})

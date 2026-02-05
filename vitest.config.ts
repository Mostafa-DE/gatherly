import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"
import viteTsConfigPaths from "vite-tsconfig-paths"

const unitTests = {
  name: "unit",
  environment: "node",
  include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
  exclude: ["src/**/*.server.spec.ts", "src/**/*.server.spec.tsx"],
  passWithNoTests: true,
}

const serverTests = {
  name: "server",
  environment: "node",
  globalSetup: "./src/tests/global-setup.ts",
  include: ["src/**/*.server.spec.ts", "src/**/*.server.spec.tsx"],
}

const sharedConfig = {
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [viteTsConfigPaths({ projects: ["./tsconfig.json"] })],
}

export default defineConfig({
  test: {
    projects: [
      {
        ...sharedConfig,
        test: unitTests,
      },
      {
        ...sharedConfig,
        test: serverTests,
      },
    ],
  },
})

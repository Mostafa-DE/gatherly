import { execSync } from "node:child_process"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"

let container: StartedPostgreSqlContainer | undefined
let reuseEnabled = false

const shouldReuseContainers = () => {
  if (process.env.CI === "true") return false
  if (process.env.TESTCONTAINERS_REUSE_ENABLE === "false") return false
  return true
}

export async function setup() {
  process.env.NODE_ENV = "test"

  reuseEnabled = shouldReuseContainers()

  const baseContainer = new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("gatherly_test")
    .withUsername("user")
    .withPassword("password")

  container = await (reuseEnabled ? baseContainer.withReuse() : baseContainer).start()

  process.env.DATABASE_URL = container.getConnectionUri()

  execSync("pnpm db:migrate", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
    },
  })
}

export async function teardown() {
  if (!reuseEnabled) {
    await container?.stop()
  }
}

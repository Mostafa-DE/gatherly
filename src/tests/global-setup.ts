import { execSync } from "node:child_process"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"

let container: StartedPostgreSqlContainer | undefined

export async function setup() {
  process.env.NODE_ENV = "test"

  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("gatherly_test")
    .withUsername("user")
    .withPassword("password")
    .start()

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
  await container?.stop()
}

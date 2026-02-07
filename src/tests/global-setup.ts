import { execSync } from "node:child_process"
import { Client } from "pg"
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql"

let container: StartedPostgreSqlContainer | undefined
let reuseEnabled = false

const shouldReuseContainers = () => {
  if (process.env.CI === "true") return false
  if (process.env.TESTCONTAINERS_REUSE_ENABLE === "false") return false
  return true
}

async function resetPublicSchema(connectionString: string) {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE")
    await client.query('DROP SCHEMA IF EXISTS "drizzle" CASCADE')
    await client.query("CREATE SCHEMA public")
    await client.query("GRANT ALL ON SCHEMA public TO public")
  } finally {
    await client.end()
  }
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
  await resetPublicSchema(process.env.DATABASE_URL)

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

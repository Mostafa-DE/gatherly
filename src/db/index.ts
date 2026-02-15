import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "@/db/schema"
import * as rankingSchema from "@/plugins/ranking/schema"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema: { ...schema, ...rankingSchema } })

export type Database = typeof db

import { db } from "../src/db"
import { user, member } from "../src/db/auth-schema"
import { eq, and } from "drizzle-orm"
import { createOrUpdateTelegramLink } from "../src/plugins/assistant/data-access/telegram-identity-links"

const EMAIL = "moayad@gmail.com"
const TELEGRAM_USER_ID = "796244125"
const ORG_ID = "seed_org_community"

async function main() {
  const [u] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, EMAIL))
    .limit(1)

  if (u === undefined) {
    console.log("User not found:", EMAIL)
    process.exit(1)
  }
  console.log("User:", u)

  const [m] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, ORG_ID), eq(member.userId, u.id)))
    .limit(1)

  if (m === undefined) {
    console.log("User is not a member of org", ORG_ID)
    process.exit(1)
  }
  console.log("Role:", m.role)

  console.log(`Linking Telegram ${TELEGRAM_USER_ID} to ${u.name} in org ${ORG_ID}...`)
  await createOrUpdateTelegramLink(ORG_ID, u.id, TELEGRAM_USER_ID, u.id)

  console.log("Done!")
  process.exit(0)
}

main()

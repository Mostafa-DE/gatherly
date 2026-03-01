/**
 * Generate a random BOT_API_SECRET for authenticating the OpenClaw bot.
 *
 * Usage:
 *   pnpm exec tsx ./scripts/generate-bot-secret.ts
 *
 * Copy the output and add it to your .env file.
 */

import { randomBytes } from "node:crypto"

const secret = randomBytes(32).toString("hex")

console.log("\n========================================")
console.log("BOT_API_SECRET generated")
console.log("========================================")
console.log(`\nAdd this to your .env file:\n`)
console.log(`  BOT_API_SECRET="${secret}"`)
console.log(`\nTest with:`)
console.log(`  curl -s http://localhost:3000/api/trpc/plugin.assistant.getCapabilities \\`)
console.log(`    -H "Authorization: Bearer ${secret}" \\`)
console.log(`    -H "Content-Type: application/json" \\`)
console.log(`    -d '{"telegramUserId":"123"}' | jq`)
console.log()

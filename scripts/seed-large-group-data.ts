/**
 * Seed large reversible load data for one existing organization.
 *
 * Usage:
 *   pnpm db:seed:large-group -- --org-id=<ORG_ID>
 *   pnpm db:seed:large-group -- --org-slug=<ORG_SLUG>
 *   pnpm db:seed:large-group:clean -- --org-id=<ORG_ID>
 *
 * Optional size overrides:
 *   --members=3000
 *   --activities=15
 *   --activity-members=1200
 *   --sessions-per-activity=80
 *   --participants-per-session=30
 *   --batch-size=500
 */

import { and, eq, like } from "drizzle-orm"
import { db } from "../src/db"
import {
  user,
  member,
  organization,
  activity,
  activityMember,
  eventSession,
  participation,
  groupMemberProfile,
} from "../src/db/schema"
import { account, session as authSession } from "../src/db/auth-schema"

type Command = "seed" | "cleanup"

type CliOptions = {
  orgId?: string
  orgSlug?: string
  members: number
  activities: number
  activityMembersPerActivity: number
  sessionsPerActivity: number
  participantsPerSession: number
  batchSize: number
}

type SeedScope = {
  scopeKey: string
  idPrefix: string
  activitySlugPrefix: string
  emailPrefix: string
}

const DEFAULTS = {
  members: 3000,
  activities: 15,
  activityMembersPerActivity: 1200,
  sessionsPerActivity: 80,
  participantsPerSession: 30,
  batchSize: 500,
} as const

const SEED_DOMAIN = "loadseed.gatherly.test"
const SEED_BASE = "loadseed"

function usage() {
  return [
    "Usage:",
    "  pnpm db:seed:large-group -- --org-id=<ORG_ID>",
    "  pnpm db:seed:large-group -- --org-slug=<ORG_SLUG>",
    "  pnpm db:seed:large-group:clean -- --org-id=<ORG_ID>",
    "",
    "Optional size overrides:",
    "  --members=<n>",
    "  --activities=<n>",
    "  --activity-members=<n>",
    "  --sessions-per-activity=<n>",
    "  --participants-per-session=<n>",
    "  --batch-size=<n>",
  ].join("\n")
}

function parseCommand(argv: string[]): { command: Command; optionArgs: string[] } {
  const [first, ...rest] = argv
  if (first === "seed" || first === "cleanup") {
    return { command: first, optionArgs: rest }
  }
  if (first === "--clean") {
    return { command: "cleanup", optionArgs: rest }
  }
  return { command: "seed", optionArgs: argv }
}

function parseOptions(argv: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {}

  for (const arg of argv) {
    if (arg === "--") {
      continue
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument "${arg}".\n\n${usage()}`)
    }
    const payload = arg.slice(2)
    if (payload.length === 0) {
      throw new Error(`Invalid argument "${arg}".`)
    }

    const eqIndex = payload.indexOf("=")
    if (eqIndex === -1) {
      options[payload] = true
      continue
    }

    const key = payload.slice(0, eqIndex)
    const value = payload.slice(eqIndex + 1)
    if (!key || !value) {
      throw new Error(`Invalid argument "${arg}".`)
    }
    options[key] = value
  }

  return options
}

function readStringOption(
  options: Record<string, string | boolean>,
  key: string,
  envName?: string
): string | undefined {
  const fromArg = options[key]
  if (typeof fromArg === "string") {
    return fromArg
  }

  if (envName) {
    const fromEnv = process.env[envName]
    if (fromEnv && fromEnv.trim().length > 0) {
      return fromEnv.trim()
    }
  }

  return undefined
}

function readIntOption(
  options: Record<string, string | boolean>,
  key: string,
  fallback: number,
  min = 1
): number {
  const raw = options[key]
  if (raw === undefined) {
    return fallback
  }
  if (typeof raw !== "string") {
    throw new Error(`Expected value for --${key}`)
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`Invalid --${key} value "${raw}" (must be an integer >= ${min})`)
  }
  return parsed
}

function parseCliArgs(): { command: Command; options: CliOptions } {
  const argv = process.argv.slice(2)
  const { command, optionArgs } = parseCommand(argv)
  const parsed = parseOptions(optionArgs)

  const orgId = readStringOption(parsed, "org-id", "LOAD_TEST_ORG_ID")
  const orgSlug = readStringOption(parsed, "org-slug", "LOAD_TEST_ORG_SLUG")

  if (!orgId && !orgSlug) {
    throw new Error(`Missing org target. Provide --org-id or --org-slug.\n\n${usage()}`)
  }

  const options: CliOptions = {
    orgId,
    orgSlug,
    members: readIntOption(parsed, "members", DEFAULTS.members, 1),
    activities: readIntOption(parsed, "activities", DEFAULTS.activities, 1),
    activityMembersPerActivity: readIntOption(
      parsed,
      "activity-members",
      DEFAULTS.activityMembersPerActivity,
      1
    ),
    sessionsPerActivity: readIntOption(
      parsed,
      "sessions-per-activity",
      DEFAULTS.sessionsPerActivity,
      1
    ),
    participantsPerSession: readIntOption(
      parsed,
      "participants-per-session",
      DEFAULTS.participantsPerSession,
      1
    ),
    batchSize: readIntOption(parsed, "batch-size", DEFAULTS.batchSize, 50),
  }

  if (options.activityMembersPerActivity > options.members) {
    throw new Error(
      `Invalid size config: activity-members (${options.activityMembersPerActivity}) cannot exceed members (${options.members})`
    )
  }
  if (options.participantsPerSession > options.activityMembersPerActivity) {
    throw new Error(
      `Invalid size config: participants-per-session (${options.participantsPerSession}) cannot exceed activity-members (${options.activityMembersPerActivity})`
    )
  }

  return { command, options }
}

function toScopeKey(orgId: string): string {
  const normalized = orgId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return normalized.slice(0, 24) || "org"
}

function createSeedScope(orgId: string): SeedScope {
  const scopeKey = toScopeKey(orgId)
  return {
    scopeKey,
    idPrefix: `${SEED_BASE}_${scopeKey}_`,
    activitySlugPrefix: `${SEED_BASE}-${scopeKey}-activity-`,
    emailPrefix: `${SEED_BASE}-${scopeKey}`,
  }
}

function pad(value: number, size: number): string {
  return value.toString().padStart(size, "0")
}

function daysAgo(n: number): Date {
  const now = new Date()
  now.setDate(now.getDate() - n)
  return now
}

function pickSequential<T>(items: T[], start: number, count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return []
  }
  const out: T[] = []
  const safeCount = Math.min(count, items.length)
  for (let i = 0; i < safeCount; i++) {
    out.push(items[(start + i) % items.length])
  }
  return out
}

async function insertInChunks<T>(
  rows: T[],
  chunkSize: number,
  insertFn: (chunk: T[]) => Promise<void>
): Promise<void> {
  if (rows.length === 0) {
    return
  }
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await insertFn(chunk)
  }
}

async function resolveOrganizationId(options: CliOptions): Promise<string> {
  const whereClause = options.orgId
    ? eq(organization.id, options.orgId)
    : eq(organization.slug, options.orgSlug as string)

  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    })
    .from(organization)
    .where(whereClause)
    .limit(1)

  if (!org) {
    const target = options.orgId
      ? `id "${options.orgId}"`
      : `slug "${options.orgSlug}"`
    throw new Error(`Organization not found for ${target}`)
  }

  console.log(`Target org: ${org.name} (${org.id})`)
  return org.id
}

async function ensureNoExistingSeedData(orgId: string, scope: SeedScope): Promise<void> {
  const [existingMember] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, orgId),
        like(member.id, `${scope.idPrefix}member_%`)
      )
    )
    .limit(1)

  if (existingMember) {
    throw new Error(
      "Seed data already exists for this org/scope. Run cleanup first: pnpm db:seed:large-group:clean"
    )
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.id, `${scope.idPrefix}user_%`))
    .limit(1)

  if (existingUser) {
    throw new Error(
      "Found leftover scoped users from a previous run. Run cleanup first: pnpm db:seed:large-group:clean"
    )
  }
}

async function seedLargeGroupData(options: CliOptions): Promise<void> {
  const orgId = await resolveOrganizationId(options)
  const scope = createSeedScope(orgId)

  await ensureNoExistingSeedData(orgId, scope)

  console.log("\n=== Large Group Load Seed ===")
  console.log(`Scope key: ${scope.scopeKey}`)
  console.log(`Members: ${options.members}`)
  console.log(`Activities: ${options.activities}`)
  console.log(`Activity members/activity: ${options.activityMembersPerActivity}`)
  console.log(`Sessions/activity: ${options.sessionsPerActivity}`)
  console.log(`Participants/session: ${options.participantsPerSession}\n`)

  const seedUserIds: string[] = []

  console.log("1) Creating users...")
  const userRows: (typeof user.$inferInsert)[] = []
  for (let i = 1; i <= options.members; i++) {
    const idx = pad(i, 6)
    const userId = `${scope.idPrefix}user_${idx}`
    seedUserIds.push(userId)

    userRows.push({
      id: userId,
      name: `Load Seed Member ${idx}`,
      email: `${scope.emailPrefix}-${idx}@${SEED_DOMAIN}`,
      username: `${scope.scopeKey.slice(0, 8)}m${idx}`,
      onboardingCompleted: true,
      city: "Load City",
      country: "Load Country",
      intent: "load-testing",
    })
  }

  await insertInChunks(userRows, options.batchSize, async (chunk) => {
    await db.insert(user).values(chunk)
  })
  console.log(`   Created ${seedUserIds.length} users`)

  console.log("2) Adding members + group profiles...")
  const memberRows: (typeof member.$inferInsert)[] = []
  const profileRows: (typeof groupMemberProfile.$inferInsert)[] = []

  for (let i = 1; i <= seedUserIds.length; i++) {
    const idx = pad(i, 6)
    const userId = seedUserIds[i - 1]

    memberRows.push({
      id: `${scope.idPrefix}member_${idx}`,
      organizationId: orgId,
      userId,
      role: "member",
      createdAt: daysAgo((i % 120) + 1),
    })

    profileRows.push({
      id: `${scope.idPrefix}profile_${idx}`,
      organizationId: orgId,
      userId,
      nickname: `LS-${idx}`,
      answers: {
        generatedBy: "seed-large-group-data",
        skillLevel: i % 3 === 0 ? "advanced" : i % 2 === 0 ? "intermediate" : "beginner",
      },
    })
  }

  await insertInChunks(memberRows, options.batchSize, async (chunk) => {
    await db.insert(member).values(chunk)
  })
  await insertInChunks(profileRows, options.batchSize, async (chunk) => {
    await db.insert(groupMemberProfile).values(chunk)
  })
  console.log(`   Added ${memberRows.length} members and ${profileRows.length} profiles`)

  console.log("3) Creating activities...")
  const activityRows: (typeof activity.$inferInsert)[] = []
  const activityIds: string[] = []
  const activityUserMap = new Map<string, string[]>()

  for (let a = 1; a <= options.activities; a++) {
    const activityIdx = pad(a, 4)
    const activityId = `${scope.idPrefix}activity_${activityIdx}`
    activityIds.push(activityId)

    activityRows.push({
      id: activityId,
      organizationId: orgId,
      name: `Load Seed Activity ${activityIdx}`,
      slug: `${scope.activitySlugPrefix}${activityIdx}`,
      joinMode: "open",
      joinFormVersion: 1,
      joinFormSchema: {
        fields: [
          {
            id: "field_experience",
            type: "select",
            label: "Experience Level",
            options: ["Beginner", "Intermediate", "Advanced"],
          },
        ],
      },
      enabledPlugins: {},
      isActive: true,
      createdAt: daysAgo((a % 180) + 1),
    })

    const selectedUsers = pickSequential(
      seedUserIds,
      a * 97,
      options.activityMembersPerActivity
    )
    activityUserMap.set(activityId, selectedUsers)
  }

  await insertInChunks(activityRows, options.batchSize, async (chunk) => {
    await db.insert(activity).values(chunk)
  })
  console.log(`   Created ${activityRows.length} activities`)

  console.log("4) Creating activity memberships...")
  let totalActivityMembers = 0
  for (let a = 1; a <= activityIds.length; a++) {
    const activityId = activityIds[a - 1]
    const selectedUsers = activityUserMap.get(activityId) ?? []

    const activityMemberRows: {
      id: string
      activityId: string
      userId: string
      status: string
      role: string
    }[] = []

    for (let i = 0; i < selectedUsers.length; i++) {
      activityMemberRows.push({
        id: `${scope.idPrefix}activity_member_${pad(a, 4)}_${pad(i + 1, 6)}`,
        activityId,
        userId: selectedUsers[i],
        status: "active",
        role: "member",
      })
    }

    await insertInChunks(activityMemberRows, options.batchSize, async (chunk) => {
      await db.insert(activityMember).values(chunk)
    })

    totalActivityMembers += activityMemberRows.length
  }
  console.log(`   Created ${totalActivityMembers} activity_member rows`)

  console.log("5) Creating sessions + participations...")
  let totalSessions = 0
  let totalParticipations = 0

  for (let a = 1; a <= activityIds.length; a++) {
    const activityId = activityIds[a - 1]
    const activityUsers = activityUserMap.get(activityId) ?? []

    const sessionRows: (typeof eventSession.$inferInsert)[] = []
    const sessionMeta: { id: string; dateTime: Date; isCompleted: boolean; index: number }[] = []

    for (let s = 1; s <= options.sessionsPerActivity; s++) {
      const sessionId = `${scope.idPrefix}session_${pad(a, 4)}_${pad(s, 5)}`
      const sessionDate = new Date(
        Date.now() - ((options.sessionsPerActivity - s + 1) * 6 + a) * 60 * 60 * 1000
      )
      const isCompleted = s <= Math.floor(options.sessionsPerActivity * 0.85)
      sessionMeta.push({ id: sessionId, dateTime: sessionDate, isCompleted, index: s })

      sessionRows.push({
        id: sessionId,
        organizationId: orgId,
        activityId,
        title: `Load Seed Session ${pad(a, 4)}-${pad(s, 5)}`,
        description: "Generated load-testing session",
        dateTime: sessionDate,
        location: "Load Test Venue",
        maxCapacity: Math.max(options.participantsPerSession + 5, 20),
        maxWaitlist: 30,
        price: s % 3 === 0 ? "8.00" : null,
        joinMode: "open",
        status: isCompleted ? "completed" : "published",
      })
      totalSessions++

      if (sessionRows.length >= options.batchSize) {
        await db.insert(eventSession).values(sessionRows)
        sessionRows.length = 0
      }
    }

    if (sessionRows.length > 0) {
      await db.insert(eventSession).values(sessionRows)
    }

    const participationRows: (typeof participation.$inferInsert)[] = []
    for (const session of sessionMeta) {
      const selectedParticipants = pickSequential(
        activityUsers,
        (session.index - 1) * options.participantsPerSession + a * 53,
        options.participantsPerSession
      )

      for (let p = 0; p < selectedParticipants.length; p++) {
        participationRows.push({
          id: `${scope.idPrefix}participation_${pad(a, 4)}_${pad(session.index, 5)}_${pad(p + 1, 4)}`,
          sessionId: session.id,
          userId: selectedParticipants[p],
          status: "joined",
          attendance: session.isCompleted ? "show" : "pending",
          payment: session.index % 3 === 0 ? "paid" : "unpaid",
          joinedAt: new Date(session.dateTime.getTime() - (p + 1) * 3 * 60 * 1000),
        })
      }
      totalParticipations += selectedParticipants.length

      if (participationRows.length >= options.batchSize * 2) {
        await db.insert(participation).values(participationRows)
        participationRows.length = 0
      }
    }

    if (participationRows.length > 0) {
      await db.insert(participation).values(participationRows)
    }

    console.log(
      `   Activity ${a}/${activityIds.length}: +${options.sessionsPerActivity} sessions, +${options.sessionsPerActivity * options.participantsPerSession} participations`
    )
  }

  console.log("\n=== Large load seed complete ===")
  console.log(`Users: ${seedUserIds.length}`)
  console.log(`Activities: ${activityIds.length}`)
  console.log(`Sessions: ${totalSessions}`)
  console.log(`Participations: ${totalParticipations}`)
  console.log("Cleanup with: pnpm db:seed:large-group:clean -- --org-id=<ORG_ID>\n")
}

async function cleanupLargeGroupData(options: CliOptions): Promise<void> {
  const orgId = await resolveOrganizationId(options)
  const scope = createSeedScope(orgId)

  console.log("\n=== Cleaning large group load seed ===")
  console.log(`Scope key: ${scope.scopeKey}\n`)

  console.log("1) Deleting seeded participations...")
  await db
    .delete(participation)
    .where(like(participation.id, `${scope.idPrefix}participation_%`))

  console.log("2) Deleting seeded sessions...")
  await db
    .delete(eventSession)
    .where(
      and(
        eq(eventSession.organizationId, orgId),
        like(eventSession.id, `${scope.idPrefix}session_%`)
      )
    )

  console.log("3) Deleting seeded activity memberships...")
  await db
    .delete(activityMember)
    .where(like(activityMember.id, `${scope.idPrefix}activity_member_%`))

  console.log("4) Deleting seeded activities...")
  await db
    .delete(activity)
    .where(
      and(
        eq(activity.organizationId, orgId),
        like(activity.slug, `${scope.activitySlugPrefix}%`)
      )
    )

  console.log("5) Deleting seeded profiles...")
  await db
    .delete(groupMemberProfile)
    .where(
      and(
        eq(groupMemberProfile.organizationId, orgId),
        like(groupMemberProfile.id, `${scope.idPrefix}profile_%`)
      )
    )

  console.log("6) Collecting seeded member user IDs...")
  const seededMembers = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(
        eq(member.organizationId, orgId),
        like(member.id, `${scope.idPrefix}member_%`)
      )
    )
  const seededUserIds = seededMembers.map((m) => m.userId)

  console.log("7) Deleting seeded org members...")
  await db
    .delete(member)
    .where(
      and(
        eq(member.organizationId, orgId),
        like(member.id, `${scope.idPrefix}member_%`)
      )
    )

  if (seededUserIds.length > 0) {
    console.log(`8) Deleting auth rows for ${seededUserIds.length} users...`)
  } else {
    console.log("8) No seeded users linked by member rows. Checking scoped users directly...")
  }

  await db.delete(authSession).where(like(authSession.userId, `${scope.idPrefix}user_%`))
  await db.delete(account).where(like(account.userId, `${scope.idPrefix}user_%`))

  console.log("9) Deleting seeded users...")
  await db
    .delete(user)
    .where(like(user.id, `${scope.idPrefix}user_%`))

  console.log("\n=== Cleanup complete ===\n")
}

async function main() {
  const { command, options } = parseCliArgs()

  if (command === "seed") {
    await seedLargeGroupData(options)
    return
  }

  await cleanupLargeGroupData(options)
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n${message}\n`)
    process.exit(1)
  })

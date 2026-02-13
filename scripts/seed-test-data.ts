/**
 * Seed realistic test data for Gatherly.
 *
 * Usage:
 *   pnpm db:seed:test          # seed test data
 *   pnpm db:seed:test --clean  # remove seeded test data (restore previous state)
 *
 * What it creates:
 *   - 1 admin user (the "owner") + 24 member users
 *   - 1 organization with settings (analytics + ai plugins enabled)
 *   - All members added to the org
 *   - 3 activities: General (open, active), Competitive League (approval, active),
 *     Summer Camp 2025 (open, deactivated)
 *   - 20 sessions spanning the past 90 days (mix of completed/published)
 *   - ~300 participations with realistic attendance & payment distributions
 *   - Member notes, profiles, join requests, and invite links
 *
 * All seeded records use a deterministic ID prefix "seed_" so cleanup is safe.
 */

import { eq, like, inArray } from "drizzle-orm"
import { createId } from "@paralleldrive/cuid2"
import { auth } from "../src/auth"
import { db } from "../src/db"
import {
  user,
  organization,
  member,
  organizationSettings,
  activity,
  activityMember,
  eventSession,
  participation,
  joinRequest,
  groupMemberProfile,
  memberNote,
  inviteLink,
} from "../src/db/schema"

// ─── Config ──────────────────────────────────────────────────────────────────

const SEED_PREFIX = "seed_"
const OWNER_EMAIL = "seed-admin@gatherly.test"
const OWNER_USERNAME = "seedadmin"
const ORG_SLUG = `${OWNER_USERNAME}-basketball-crew`
const PASSWORD = "password123"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedId(suffix: string) {
  return `${SEED_PREFIX}${suffix}`
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function weighted<T>(options: [T, number][]): T {
  const total = options.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [val, w] of options) {
    r -= w
    if (r <= 0) return val
  }
  return options[options.length - 1][0]
}

// ─── Data definitions ────────────────────────────────────────────────────────

const MEMBER_DATA = [
  { name: "Lina Haddad", city: "Amman" },
  { name: "Omar Khalil", city: "Dubai" },
  { name: "Sara Nasser", city: "Beirut" },
  { name: "Youssef Farah", city: "Cairo" },
  { name: "Nadia Karam", city: "Amman" },
  { name: "Tariq Bazzi", city: "Riyadh" },
  { name: "Layla Mansour", city: "Istanbul" },
  { name: "Karim Saleh", city: "Amman" },
  { name: "Rania Attar", city: "Dubai" },
  { name: "Hassan Jaber", city: "Amman" },
  { name: "Dina Awad", city: "Beirut" },
  { name: "Fadi Tawil", city: "Amman" },
  { name: "Mira Sabbagh", city: "Cairo" },
  { name: "Sami Issa", city: "Amman" },
  { name: "Hana Rashed", city: "Dubai" },
  { name: "Ziad Mourad", city: "Amman" },
  { name: "Jana Khoury", city: "Beirut" },
  { name: "Bilal Saad", city: "Riyadh" },
  { name: "Noor Hamdan", city: "Amman" },
  { name: "Adam Darwish", city: "Istanbul" },
  { name: "Lara Nassar", city: "Amman" },
  { name: "Mahmoud Ali", city: "Cairo" },
  { name: "Aya Bishara", city: "Dubai" },
  { name: "Khaled Zein", city: "Amman" },
]

const SESSION_TEMPLATES = [
  { title: "Friday Night Pickup", location: "Al-Hussein Sports City", price: "5.00" },
  { title: "Saturday Morning Run", location: "Abdoun Park", price: null },
  { title: "3v3 Tournament", location: "Sports Arena JO", price: "10.00" },
  { title: "Beginner Friendly Scrimmage", location: "Community Center Court", price: null },
  { title: "Full Court 5v5", location: "Al-Hussein Sports City", price: "7.50" },
  { title: "Skills & Drills Workshop", location: "Pro Training Facility", price: "15.00" },
  { title: "Weekend Open Gym", location: "JU Gym", price: "3.00" },
  { title: "Evening Shootaround", location: "Abdali Court", price: null },
  { title: "Competitive League Night", location: "Sports Arena JO", price: "12.00" },
  { title: "Women's Session", location: "Community Center Court", price: "5.00" },
]

// ─── Seed functions ──────────────────────────────────────────────────────────

async function createUsers(): Promise<string[]> {
  console.log("Creating users...")

  // Owner
  const ownerResult = await auth.api.signUpEmail({
    body: {
      username: OWNER_USERNAME,
      name: "Seed Admin",
      email: OWNER_EMAIL,
      password: PASSWORD,
      phoneNumber: "+10000000000",
    },
  })
  if (!ownerResult?.user?.id) throw new Error("Failed to create owner user")
  const ownerId = ownerResult.user.id
  console.log(`  Owner: ${OWNER_EMAIL} (${ownerId})`)

  // Members
  const memberIds: string[] = []
  for (let i = 0; i < MEMBER_DATA.length; i++) {
    const m = MEMBER_DATA[i]
    const username = m.name.toLowerCase().replace(/\s+/g, "").slice(0, 12) + i
    const email = `seed-${username}@gatherly.test`
    const phone = `+1${String(1000000001 + i)}`

    const result = await auth.api.signUpEmail({
      body: {
        username,
        name: m.name,
        email,
        password: PASSWORD,
        phoneNumber: phone,
        city: m.city,
        onboardingCompleted: true,
      },
    })
    if (!result?.user?.id) throw new Error(`Failed to create user ${email}`)
    memberIds.push(result.user.id)
  }
  console.log(`  Created ${memberIds.length} member users`)

  return [ownerId, ...memberIds]
}

async function createOrganization(ownerId: string): Promise<string> {
  console.log("Creating organization...")

  const orgId = seedId("org_basketball")

  await db.insert(organization).values({
    id: orgId,
    name: "Amman Basketball Crew",
    slug: ORG_SLUG,
    createdAt: daysAgo(120),
    metadata: null,
    timezone: "Asia/Amman",
    defaultJoinMode: "open",
    userSlug: "basketball-crew",
    ownerUsername: OWNER_USERNAME,
  })

  // Owner member record
  await db.insert(member).values({
    id: seedId("member_owner"),
    organizationId: orgId,
    userId: ownerId,
    role: "owner",
    createdAt: daysAgo(120),
  })

  // Settings with plugins enabled
  await db.insert(organizationSettings).values({
    organizationId: orgId,
    currency: "JOD",
    enabledPlugins: { analytics: true, ai: true },
    joinFormSchema: {
      fields: [
        {
          id: "field_position",
          type: "select",
          label: "Preferred Position",
          required: true,
          options: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"],
        },
        {
          id: "field_experience",
          type: "select",
          label: "Experience Level",
          required: true,
          options: ["Beginner", "Intermediate", "Advanced", "Competitive"],
        },
        {
          id: "field_note",
          type: "textarea",
          label: "Anything we should know?",
          required: false,
          placeholder: "Injuries, availability, etc.",
        },
      ],
    },
    joinFormVersion: 1,
  })

  console.log(`  Org: Amman Basketball Crew (${orgId})`)
  return orgId
}

async function addMembers(
  orgId: string,
  memberUserIds: string[]
): Promise<void> {
  console.log("Adding members to org...")

  const positions = ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"]
  const levels = ["Beginner", "Intermediate", "Advanced", "Competitive"]

  for (let i = 0; i < memberUserIds.length; i++) {
    const userId = memberUserIds[i]
    const joinedDaysAgo = randomInt(5, 100)

    // Member record — some join early, some recently
    await db.insert(member).values({
      id: seedId(`member_${i}`),
      organizationId: orgId,
      userId,
      role: i < 2 ? "admin" : "member",
      createdAt: daysAgo(joinedDaysAgo),
    })

    // Profile with form answers
    await db.insert(groupMemberProfile).values({
      id: seedId(`profile_${i}`),
      organizationId: orgId,
      userId,
      answers: {
        field_position: pick(positions),
        field_experience: pick(levels),
        field_note: i % 3 === 0 ? "Available weekends only" : "",
      },
    })
  }

  console.log(`  Added ${memberUserIds.length} members with profiles`)
}

async function createActivities(
  orgId: string,
  ownerId: string,
  memberUserIds: string[]
): Promise<string[]> {
  console.log("Creating activities...")

  const allUserIds = [ownerId, ...memberUserIds]

  // Activity 1: General — open, active, all members
  const generalId = seedId("activity_general")
  await db.insert(activity).values({
    id: generalId,
    organizationId: orgId,
    name: "General",
    slug: "general",
    joinMode: "open",
    isActive: true,
    createdBy: ownerId,
    createdAt: daysAgo(120),
  })

  const generalMembers = allUserIds.map((userId, i) => ({
    id: seedId(`actmember_gen_${i}`),
    activityId: generalId,
    userId,
    status: "active",
    role: i === 0 ? "owner" : "member",
  }))
  await db.insert(activityMember).values(generalMembers)
  console.log(`  Activity: General (open, active) — ${allUserIds.length} members`)

  // Activity 2: Competitive League — require_approval, active, ~60% of members
  const compId = seedId("activity_competitive")
  await db.insert(activity).values({
    id: compId,
    organizationId: orgId,
    name: "Competitive League",
    slug: "competitive-league",
    joinMode: "require_approval",
    isActive: true,
    createdBy: ownerId,
    createdAt: daysAgo(90),
  })

  const compCount = Math.floor(memberUserIds.length * 0.6)
  const compUserIds = [ownerId, ...memberUserIds.slice(0, compCount)]
  const compMembers = compUserIds.map((userId, i) => ({
    id: seedId(`actmember_comp_${i}`),
    activityId: compId,
    userId,
    status: "active",
    role: i === 0 ? "owner" : "member",
  }))
  await db.insert(activityMember).values(compMembers)
  console.log(`  Activity: Competitive League (approval, active) — ${compUserIds.length} members`)

  // Activity 3: Summer Camp — open, deactivated, ~40% of members
  const campId = seedId("activity_summer_camp")
  await db.insert(activity).values({
    id: campId,
    organizationId: orgId,
    name: "Summer Camp 2025",
    slug: "summer-camp-2025",
    joinMode: "open",
    isActive: false,
    createdBy: ownerId,
    createdAt: daysAgo(60),
  })

  const campCount = Math.floor(memberUserIds.length * 0.4)
  const campUserIds = [ownerId, ...memberUserIds.slice(0, campCount)]
  const campMembers = campUserIds.map((userId, i) => ({
    id: seedId(`actmember_camp_${i}`),
    activityId: campId,
    userId,
    status: "active",
    role: i === 0 ? "owner" : "member",
  }))
  await db.insert(activityMember).values(campMembers)
  console.log(`  Activity: Summer Camp 2025 (open, deactivated) — ${campUserIds.length} members`)

  return [generalId, compId, campId]
}

async function createSessions(
  orgId: string,
  ownerId: string,
  activityIds: string[]
): Promise<string[]> {
  console.log("Creating sessions...")

  const sessionIds: string[] = []
  // Only create sessions for active activities (first two)
  const activeActivityIds = activityIds.filter((_, i) => i < 2)

  // 20 sessions spread over the past 90 days, distributed across active activities
  for (let i = 0; i < 20; i++) {
    const template = SESSION_TEMPLATES[i % SESSION_TEMPLATES.length]
    const sessionDaysAgo = Math.max(1, 90 - i * 4 + randomInt(-2, 2))
    const isCompleted = sessionDaysAgo > 3
    const id = seedId(`session_${i}`)
    // Alternate sessions between active activities (~70% general, ~30% competitive)
    const activityId = i % 3 === 0 ? activeActivityIds[1] : activeActivityIds[0]

    await db.insert(eventSession).values({
      id,
      organizationId: orgId,
      activityId,
      title: i < SESSION_TEMPLATES.length
        ? template.title
        : `${template.title} #${Math.floor(i / SESSION_TEMPLATES.length) + 1}`,
      description: `Regular ${template.title.toLowerCase()} session. All skill levels welcome.`,
      dateTime: daysAgo(sessionDaysAgo),
      location: template.location,
      maxCapacity: pick([10, 12, 15, 16, 20]),
      maxWaitlist: pick([0, 3, 5]),
      price: template.price,
      joinMode: "open",
      status: isCompleted ? "completed" : "published",
      createdBy: ownerId,
    })

    sessionIds.push(id)
  }

  console.log(`  Created ${sessionIds.length} sessions across ${activeActivityIds.length} activities`)
  return sessionIds
}

async function createParticipations(
  sessionIds: string[],
  memberUserIds: string[],
  ownerId: string
): Promise<void> {
  console.log("Creating participations...")

  const allUserIds = [ownerId, ...memberUserIds]
  let total = 0

  for (const sessionId of sessionIds) {
    // Fetch session to know capacity & price
    const [sess] = await db
      .select({
        maxCapacity: eventSession.maxCapacity,
        price: eventSession.price,
        status: eventSession.status,
        dateTime: eventSession.dateTime,
      })
      .from(eventSession)
      .where(eq(eventSession.id, sessionId))

    if (!sess) continue

    // 50-90% of members join each session
    const joinCount = randomInt(
      Math.floor(allUserIds.length * 0.5),
      Math.min(allUserIds.length, sess.maxCapacity + 3)
    )

    // Shuffle and pick
    const shuffled = [...allUserIds].sort(() => Math.random() - 0.5)
    const joiners = shuffled.slice(0, joinCount)

    for (let j = 0; j < joiners.length; j++) {
      const userId = joiners[j]
      const isOverCapacity = j >= sess.maxCapacity
      const isCompleted = sess.status === "completed"

      const status: "joined" | "waitlisted" | "cancelled" = isOverCapacity
        ? "waitlisted"
        : weighted([
            ["joined", 85],
            ["cancelled", 15],
          ])

      // Attendance — only for completed sessions with joined status
      let attendance: "pending" | "show" | "no_show" = "pending"
      if (isCompleted && status === "joined") {
        attendance = weighted([
          ["show", 75],
          ["no_show", 18],
          ["pending", 7],
        ])
      }

      // Payment — only for priced sessions with joined status
      let payment: "paid" | "unpaid" = "unpaid"
      if (sess.price && status === "joined") {
        payment = weighted([
          ["paid", 80],
          ["unpaid", 20],
        ])
      }

      await db.insert(participation).values({
        id: seedId(`part_${sessionId.replace(SEED_PREFIX, "")}_${j}`),
        sessionId,
        userId,
        status,
        attendance,
        payment,
        joinedAt: new Date(
          sess.dateTime.getTime() - randomInt(1, 72) * 60 * 60 * 1000
        ),
        cancelledAt: status === "cancelled" ? daysAgo(randomInt(1, 5)) : null,
      })
      total++
    }
  }

  console.log(`  Created ${total} participations`)
}

async function createMemberNotes(
  orgId: string,
  ownerId: string,
  memberUserIds: string[]
): Promise<void> {
  console.log("Creating member notes...")

  const noteTexts = [
    "Great team player, very consistent attendance.",
    "New member — seems enthusiastic, keep an eye on progress.",
    "Tends to arrive late, mentioned traffic issues.",
    "Strong defensive player. Consider for competitive team.",
    "Missed last 3 sessions without notice.",
    "Brought 2 new members to the group last month.",
    "Requested to help organize weekend tournaments.",
    "Recovering from knee injury, taking it easy.",
  ]

  let count = 0
  for (let i = 0; i < Math.min(8, memberUserIds.length); i++) {
    await db.insert(memberNote).values({
      id: seedId(`note_${i}`),
      organizationId: orgId,
      targetUserId: memberUserIds[i],
      authorUserId: ownerId,
      content: noteTexts[i],
      createdAt: daysAgo(randomInt(1, 30)),
    })
    count++
  }

  console.log(`  Created ${count} member notes`)
}

async function createJoinRequests(
  orgId: string,
  memberUserIds: string[]
): Promise<void> {
  console.log("Creating join requests...")

  // Create a few pending/rejected join requests from later members
  // (simulating approval flow history)
  const statuses: ("pending" | "approved" | "rejected")[] = [
    "pending",
    "pending",
    "rejected",
    "approved",
    "approved",
  ]

  let count = 0
  for (let i = 0; i < statuses.length && i < memberUserIds.length; i++) {
    const targetIdx = memberUserIds.length - 1 - i
    await db.insert(joinRequest).values({
      id: seedId(`joinreq_${i}`),
      organizationId: orgId,
      userId: memberUserIds[targetIdx],
      status: statuses[i],
      message: pick([
        "Hey! I'd love to join your basketball sessions.",
        "Friend recommended this group. Can I join?",
        "Looking for a regular basketball group in Amman.",
        null,
      ]),
      formAnswers: {
        field_position: pick(["Point Guard", "Center", "Small Forward"]),
        field_experience: pick(["Beginner", "Intermediate"]),
      },
      reviewedAt: statuses[i] !== "pending" ? daysAgo(randomInt(1, 10)) : null,
      createdAt: daysAgo(randomInt(5, 30)),
    })
    count++
  }

  console.log(`  Created ${count} join requests`)
}

async function createInviteLinks(
  orgId: string,
  ownerId: string
): Promise<void> {
  console.log("Creating invite links...")

  await db.insert(inviteLink).values([
    {
      id: seedId("invite_active"),
      token: createId(),
      organizationId: orgId,
      createdBy: ownerId,
      role: "member",
      maxUses: 50,
      usedCount: 12,
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    {
      id: seedId("invite_expired"),
      token: createId(),
      organizationId: orgId,
      createdBy: ownerId,
      role: "member",
      maxUses: 10,
      usedCount: 10,
      isActive: false,
      expiresAt: daysAgo(5),
    },
  ])

  console.log(`  Created 2 invite links`)
}

// ─── Main seed ───────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n=== Gatherly Test Data Seed ===\n")

  // Check if already seeded
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))
    .limit(1)

  if (existing.length > 0) {
    console.log("Test data already exists. Run with --clean to remove it first.\n")
    return
  }

  const [ownerId, ...memberUserIds] = await createUsers()
  const orgId = await createOrganization(ownerId)
  await addMembers(orgId, memberUserIds)
  const activityIds = await createActivities(orgId, ownerId, memberUserIds)
  const sessionIds = await createSessions(orgId, ownerId, activityIds)
  await createParticipations(sessionIds, memberUserIds, ownerId)
  await createMemberNotes(orgId, ownerId, memberUserIds)
  await createJoinRequests(orgId, memberUserIds)
  await createInviteLinks(orgId, ownerId)

  console.log("\n=== Seed complete! ===")
  console.log(`\n  Login:    ${OWNER_EMAIL} / ${PASSWORD}`)
  console.log(`  Org:      Amman Basketball Crew`)
  console.log(`  Members:  ${memberUserIds.length + 1}`)
  console.log(`  Sessions: ${sessionIds.length}`)
  console.log(`  URL:      /${OWNER_USERNAME}/basketball-crew\n`)
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function clean() {
  console.log("\n=== Cleaning Gatherly Test Data ===\n")

  // Find org
  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))

  if (!org) {
    console.log("No test data found (org does not exist).\n")
    return
  }

  const orgId = org.id

  // Find all seed user IDs (by email pattern)
  const seedUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, "%@gatherly.test"))

  const seedUserIds = seedUsers.map((u) => u.id)

  // Delete in reverse dependency order
  console.log("Deleting participations...")
  const orgSessions = await db
    .select({ id: eventSession.id })
    .from(eventSession)
    .where(eq(eventSession.organizationId, orgId))
  const orgSessionIds = orgSessions.map((s) => s.id)

  if (orgSessionIds.length > 0) {
    await db
      .delete(participation)
      .where(inArray(participation.sessionId, orgSessionIds))
  }

  console.log("Deleting sessions...")
  await db
    .delete(eventSession)
    .where(eq(eventSession.organizationId, orgId))

  console.log("Deleting activity members...")
  const orgActivities = await db
    .select({ id: activity.id })
    .from(activity)
    .where(eq(activity.organizationId, orgId))
  const orgActivityIds = orgActivities.map((a) => a.id)

  if (orgActivityIds.length > 0) {
    await db
      .delete(activityMember)
      .where(inArray(activityMember.activityId, orgActivityIds))
  }

  console.log("Deleting activities...")
  await db
    .delete(activity)
    .where(eq(activity.organizationId, orgId))

  console.log("Deleting member notes...")
  await db
    .delete(memberNote)
    .where(eq(memberNote.organizationId, orgId))

  console.log("Deleting join requests...")
  await db
    .delete(joinRequest)
    .where(eq(joinRequest.organizationId, orgId))

  console.log("Deleting profiles...")
  await db
    .delete(groupMemberProfile)
    .where(eq(groupMemberProfile.organizationId, orgId))

  console.log("Deleting invite links...")
  await db
    .delete(inviteLink)
    .where(eq(inviteLink.organizationId, orgId))

  console.log("Deleting members...")
  await db
    .delete(member)
    .where(eq(member.organizationId, orgId))

  console.log("Deleting org settings...")
  await db
    .delete(organizationSettings)
    .where(eq(organizationSettings.organizationId, orgId))

  console.log("Deleting organization...")
  await db
    .delete(organization)
    .where(eq(organization.id, orgId))

  // Delete seed users and their auth records
  if (seedUserIds.length > 0) {
    console.log(`Deleting ${seedUserIds.length} seed users...`)

    // Auth sessions
    const { session: authSession } = await import("../src/db/auth-schema")
    await db
      .delete(authSession)
      .where(inArray(authSession.userId, seedUserIds))

    // Auth accounts
    const { account } = await import("../src/db/auth-schema")
    await db
      .delete(account)
      .where(inArray(account.userId, seedUserIds))

    // Users
    await db
      .delete(user)
      .where(inArray(user.id, seedUserIds))
  }

  console.log("\n=== Cleanup complete! All test data removed. ===\n")
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const isClean = process.argv.includes("--clean")

const run = isClean ? clean : seed

run()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`\n${isClean ? "Cleanup" : "Seed"} failed: ${msg}\n`)
    if (err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    process.exit(1)
  })

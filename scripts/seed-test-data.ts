/**
 * Seed realistic test data for Gatherly.
 *
 * Usage:
 *   pnpm db:seed:test          # seed test data
 *   pnpm db:seed:test --clean  # remove seeded test data (restore previous state)
 *
 * What it creates:
 *   - 1 admin user (the "owner") + 24 member users
 *   - 1 organization ("Seed Community TEST") with settings
 *   - All members added to the org
 *   - 7 domain-specific activities: Padel, Football, Badminton, Volleyball,
 *     Tennis, Ping Pong, Laser Tag — each with ranking definitions
 *   - ~25 sessions across all activities
 *   - Match records with realistic scores per domain
 *   - Member ranks with accumulated stats and levels
 *   - Participations, member notes, join requests, invite links
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
import {
  rankingDefinition,
  rankingLevel,
  memberRank,
  matchRecord,
  rankStatEntry,
} from "../src/plugins/ranking/schema"
import { resolvePadelMatch } from "../src/plugins/ranking/domains/padel"
import { resolveFootballMatch } from "../src/plugins/ranking/domains/football"
import { resolveBadmintonMatch } from "../src/plugins/ranking/domains/badminton"
import { resolveVolleyballMatch } from "../src/plugins/ranking/domains/volleyball"
import { resolveTennisMatch } from "../src/plugins/ranking/domains/tennis"
import { resolvePingPongMatch } from "../src/plugins/ranking/domains/ping-pong"
import { resolveLaserTagMatch } from "../src/plugins/ranking/domains/laser-tag"

// ─── Config ──────────────────────────────────────────────────────────────────

const SEED_PREFIX = "seed_"
const OWNER_EMAIL = "seed-admin@gatherly.test"
const OWNER_USERNAME = "seedadmin"
const ORG_SLUG = `${OWNER_USERNAME}-seed-community-test`
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

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
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

// ─── Domain configs for seed ─────────────────────────────────────────────────

type DomainSeedConfig = {
  domainId: string
  activityName: string
  activitySlug: string
  defaultFormat: string
  playersPerTeam: number
  memberPercent: number // what % of total members join this activity
  sessionsCount: number
  matchesPerSession: number
  generateScores: () => unknown
  resolveMatch: (scores: unknown) => {
    winner: "team1" | "team2" | "draw"
    team1Stats: Record<string, number>
    team2Stats: Record<string, number>
  }
  levels: { name: string; color: string; order: number }[]
  sessionTemplates: { title: string; location: string; price: string | null }[]
}

const DOMAIN_CONFIGS: DomainSeedConfig[] = [
  {
    domainId: "padel",
    activityName: "Padel",
    activitySlug: "padel",
    defaultFormat: "doubles",
    playersPerTeam: 2,
    memberPercent: 60,
    sessionsCount: 5,
    matchesPerSession: 4,
    generateScores: generatePadelScores,
    resolveMatch: resolvePadelMatch,
    levels: [
      { name: "D-", color: "#9CA3AF", order: 0 },
      { name: "D", color: "#6B7280", order: 1 },
      { name: "D+", color: "#4B5563", order: 2 },
      { name: "C-", color: "#60A5FA", order: 3 },
      { name: "C", color: "#3B82F6", order: 4 },
      { name: "C+", color: "#2563EB", order: 5 },
      { name: "B-", color: "#34D399", order: 6 },
      { name: "B", color: "#10B981", order: 7 },
      { name: "B+", color: "#059669", order: 8 },
    ],
    sessionTemplates: [
      { title: "Padel Doubles Night", location: "Padel Club Amman", price: "10.00" },
      { title: "Weekend Padel Session", location: "Sports Arena JO", price: "8.00" },
      { title: "Padel Open Play", location: "Al-Hussein Sports City", price: null },
      { title: "Padel Tournament", location: "Padel Club Amman", price: "15.00" },
      { title: "Padel Training & Matches", location: "Pro Padel Courts", price: "12.00" },
    ],
  },
  {
    domainId: "football",
    activityName: "Football",
    activitySlug: "football",
    defaultFormat: "5v5",
    playersPerTeam: 5,
    memberPercent: 80,
    sessionsCount: 5,
    matchesPerSession: 3,
    generateScores: generateFootballScores,
    resolveMatch: resolveFootballMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Elite", color: "#F97316", order: 3 },
      { name: "Pro", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Friday Night Football", location: "Al-Hussein Sports City", price: "5.00" },
      { title: "5-a-Side Pickup", location: "Community Center Field", price: null },
      { title: "Weekend Football", location: "JU Stadium", price: "7.00" },
      { title: "Evening Kickabout", location: "Abdoun Park", price: null },
      { title: "Football League Night", location: "Sports Arena JO", price: "10.00" },
    ],
  },
  {
    domainId: "badminton",
    activityName: "Badminton",
    activitySlug: "badminton",
    defaultFormat: "singles",
    playersPerTeam: 1,
    memberPercent: 40,
    sessionsCount: 3,
    matchesPerSession: 4,
    generateScores: generateBadmintonScores,
    resolveMatch: resolveBadmintonMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Lower Intermediate", color: "#60A5FA", order: 1 },
      { name: "Intermediate", color: "#3B82F6", order: 2 },
      { name: "Upper Intermediate", color: "#34D399", order: 3 },
      { name: "Advanced", color: "#F97316", order: 4 },
    ],
    sessionTemplates: [
      { title: "Badminton Singles Night", location: "Community Center Court", price: "3.00" },
      { title: "Open Badminton Session", location: "JU Gym", price: null },
      { title: "Badminton Round Robin", location: "Pro Training Facility", price: "5.00" },
    ],
  },
  {
    domainId: "volleyball",
    activityName: "Volleyball",
    activitySlug: "volleyball",
    defaultFormat: "4v4",
    playersPerTeam: 4,
    memberPercent: 50,
    sessionsCount: 3,
    matchesPerSession: 3,
    generateScores: generateVolleyballScores,
    resolveMatch: resolveVolleyballMatch,
    levels: [
      { name: "Recreational", color: "#9CA3AF", order: 0 },
      { name: "B", color: "#60A5FA", order: 1 },
      { name: "B+", color: "#3B82F6", order: 2 },
      { name: "BB", color: "#34D399", order: 3 },
      { name: "BB+", color: "#10B981", order: 4 },
      { name: "A", color: "#F97316", order: 5 },
    ],
    sessionTemplates: [
      { title: "Beach Volleyball", location: "Aqaba Beach Club", price: "8.00" },
      { title: "Indoor Volleyball", location: "JU Gym", price: "5.00" },
      { title: "Volleyball Tournament", location: "Sports Arena JO", price: "12.00" },
    ],
  },
  {
    domainId: "tennis",
    activityName: "Tennis",
    activitySlug: "tennis",
    defaultFormat: "singles",
    playersPerTeam: 1,
    memberPercent: 35,
    sessionsCount: 3,
    matchesPerSession: 3,
    generateScores: generateTennisScores,
    resolveMatch: resolveTennisMatch,
    levels: [
      { name: "NTRP 2.0", color: "#9CA3AF", order: 0 },
      { name: "NTRP 2.5", color: "#6B7280", order: 1 },
      { name: "NTRP 3.0", color: "#60A5FA", order: 2 },
      { name: "NTRP 3.5", color: "#3B82F6", order: 3 },
      { name: "NTRP 4.0", color: "#34D399", order: 4 },
      { name: "NTRP 4.5", color: "#10B981", order: 5 },
      { name: "NTRP 5.0", color: "#F97316", order: 6 },
    ],
    sessionTemplates: [
      { title: "Tennis Singles Ladder", location: "Royal Tennis Club", price: "10.00" },
      { title: "Morning Tennis", location: "Abdoun Courts", price: "7.00" },
      { title: "Tennis Match Day", location: "Royal Tennis Club", price: "10.00" },
    ],
  },
  {
    domainId: "ping-pong",
    activityName: "Ping Pong",
    activitySlug: "ping-pong",
    defaultFormat: "singles",
    playersPerTeam: 1,
    memberPercent: 45,
    sessionsCount: 3,
    matchesPerSession: 5,
    generateScores: generatePingPongScores,
    resolveMatch: resolvePingPongMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Expert", color: "#F97316", order: 3 },
      { name: "Pro", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Ping Pong Night", location: "Community Center", price: null },
      { title: "Table Tennis Tournament", location: "JU Rec Room", price: "3.00" },
      { title: "Lunchtime Ping Pong", location: "Office Lounge", price: null },
    ],
  },
  {
    domainId: "laser-tag",
    activityName: "Laser Tag",
    activitySlug: "laser-tag",
    defaultFormat: "team",
    playersPerTeam: 5, // use 5 per team for seed (within 1-13 range)
    memberPercent: 55,
    sessionsCount: 2,
    matchesPerSession: 3,
    generateScores: generateLaserTagScores,
    resolveMatch: resolveLaserTagMatch,
    levels: [
      { name: "Beginner", color: "#9CA3AF", order: 0 },
      { name: "Intermediate", color: "#3B82F6", order: 1 },
      { name: "Advanced", color: "#10B981", order: 2 },
      { name: "Elite", color: "#F97316", order: 3 },
      { name: "Pro", color: "#EF4444", order: 4 },
    ],
    sessionTemplates: [
      { title: "Laser Tag Battle", location: "Fun Zone Amman", price: "15.00" },
      { title: "Team Laser Tag Night", location: "Action Park", price: "12.00" },
    ],
  },
]

// ─── Score generators ────────────────────────────────────────────────────────

function generatePadelScores(): [number, number][] {
  const validScores: [number, number][] = [
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
    [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 7], [6, 7],
  ]
  const numSets = randomInt(2, 3)
  const sets: [number, number][] = []
  for (let i = 0; i < numSets; i++) {
    sets.push(pick(validScores))
  }
  return sets
}

function generateFootballScores(): { team1: number; team2: number } {
  return { team1: randomInt(0, 6), team2: randomInt(0, 6) }
}

function generateBadmintonScores(): [number, number][] {
  const numGames = randomInt(2, 3)
  const games: [number, number][] = []
  for (let i = 0; i < numGames; i++) {
    // Valid BWF scores: first to 21, win by 2, max 30-29
    const r = Math.random()
    if (r < 0.6) {
      // Clear win: 21 vs 5-19
      const loserScore = randomInt(5, 19)
      if (Math.random() < 0.5) games.push([21, loserScore])
      else games.push([loserScore, 21])
    } else if (r < 0.85) {
      // Deuce: 22-20 through 28-26
      const extra = randomInt(0, 4)
      const winner = 22 + extra
      const loser = 20 + extra
      if (Math.random() < 0.5) games.push([winner, loser])
      else games.push([loser, winner])
    } else {
      // Max score: 30-29
      if (Math.random() < 0.5) games.push([30, 29])
      else games.push([29, 30])
    }
  }
  return games
}

function generateVolleyballScores(): [number, number][] {
  const numSets = randomInt(2, 3)
  const sets: [number, number][] = []
  for (let i = 0; i < numSets; i++) {
    const isDecidingSet = i === 2
    const targetScore = isDecidingSet ? 15 : 25
    const r = Math.random()
    if (r < 0.7) {
      // Clear win
      const loserScore = randomInt(
        isDecidingSet ? 5 : 15,
        targetScore - 2
      )
      if (Math.random() < 0.5) sets.push([targetScore, loserScore])
      else sets.push([loserScore, targetScore])
    } else {
      // Deuce: win by 2
      const extra = randomInt(0, 3)
      const winner = targetScore + extra
      const loser = targetScore - 2 + extra
      if (Math.random() < 0.5) sets.push([winner, loser])
      else sets.push([loser, winner])
    }
  }
  return sets
}

function generateTennisScores(): [number, number][] {
  const validScores: [number, number][] = [
    [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [7, 5], [7, 6],
    [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 7], [6, 7],
  ]
  const numSets = randomInt(2, 3)
  const sets: [number, number][] = []
  for (let i = 0; i < numSets; i++) {
    sets.push(pick(validScores))
  }
  return sets
}

function generatePingPongScores(): [number, number][] {
  const numGames = randomInt(3, 5)
  const games: [number, number][] = []
  for (let i = 0; i < numGames; i++) {
    const r = Math.random()
    if (r < 0.65) {
      // Clear win: 11 vs 2-9
      const loserScore = randomInt(2, 9)
      if (Math.random() < 0.5) games.push([11, loserScore])
      else games.push([loserScore, 11])
    } else if (r < 0.9) {
      // Deuce: 12-10 through 16-14
      const extra = randomInt(0, 3)
      const winner = 12 + extra
      const loser = 10 + extra
      if (Math.random() < 0.5) games.push([winner, loser])
      else games.push([loser, winner])
    } else {
      // Close deuce: 11-9
      if (Math.random() < 0.5) games.push([11, 9])
      else games.push([9, 11])
    }
  }
  return games
}

function generateLaserTagScores(): { team1: number; team2: number } {
  return {
    team1: randomInt(200, 600),
    team2: randomInt(200, 600),
  }
}

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
      onboardingCompleted: true,
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

  const orgId = seedId("org_community")

  await db.insert(organization).values({
    id: orgId,
    name: "Seed Community TEST",
    slug: ORG_SLUG,
    createdAt: daysAgo(120),
    metadata: null,
    timezone: "Asia/Amman",
    defaultJoinMode: "open",
    userSlug: "seed-community-test",
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
    enabledPlugins: { analytics: true, ai: true, ranking: true },
    joinFormSchema: {
      fields: [
        {
          id: "field_sport",
          type: "select",
          label: "Favourite Sport",
          required: true,
          options: ["Padel", "Football", "Tennis", "Badminton", "Volleyball", "Ping Pong", "Laser Tag"],
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

  console.log(`  Org: Seed Community TEST (${orgId})`)
  return orgId
}

async function addMembers(
  orgId: string,
  memberUserIds: string[]
): Promise<void> {
  console.log("Adding members to org...")

  const sports = ["Padel", "Football", "Tennis", "Badminton", "Volleyball", "Ping Pong", "Laser Tag"]
  const levels = ["Beginner", "Intermediate", "Advanced", "Competitive"]

  for (let i = 0; i < memberUserIds.length; i++) {
    const userId = memberUserIds[i]
    const joinedDaysAgo = randomInt(5, 100)

    await db.insert(member).values({
      id: seedId(`member_${i}`),
      organizationId: orgId,
      userId,
      role: i < 2 ? "admin" : "member",
      createdAt: daysAgo(joinedDaysAgo),
    })

    await db.insert(groupMemberProfile).values({
      id: seedId(`profile_${i}`),
      organizationId: orgId,
      userId,
      answers: {
        field_sport: pick(sports),
        field_experience: pick(levels),
        field_note: i % 3 === 0 ? "Available weekends only" : "",
      },
    })
  }

  console.log(`  Added ${memberUserIds.length} members with profiles`)
}

async function createActivitiesAndRankings(
  orgId: string,
  ownerId: string,
  memberUserIds: string[]
): Promise<{ activityIds: string[]; sessionIds: string[] }> {
  console.log("Creating activities with rankings...")

  const allActivityIds: string[] = []
  const allSessionIds: string[] = []

  for (let d = 0; d < DOMAIN_CONFIGS.length; d++) {
    const cfg = DOMAIN_CONFIGS[d]
    const activityId = seedId(`activity_${cfg.domainId}`)
    allActivityIds.push(activityId)

    // 1. Create activity
    await db.insert(activity).values({
      id: activityId,
      organizationId: orgId,
      name: cfg.activityName,
      slug: cfg.activitySlug,
      joinMode: "open",
      isActive: true,
      enabledPlugins: { ranking: true },
      createdBy: ownerId,
      createdAt: daysAgo(120 - d * 5),
    })

    // 2. Assign random subset of members to this activity
    const memberCount = Math.max(
      cfg.playersPerTeam * 2 + 2, // minimum: enough for 1 match + spare
      Math.floor(memberUserIds.length * cfg.memberPercent / 100)
    )
    const activityMemberIds = [ownerId, ...pickN(memberUserIds, memberCount)]
    // Deduplicate (owner always included)
    const uniqueActivityMemberIds = [...new Set(activityMemberIds)]

    const actMembers = uniqueActivityMemberIds.map((userId, i) => ({
      id: seedId(`actmember_${cfg.domainId}_${i}`),
      activityId,
      userId,
      status: "active",
      role: i === 0 ? "owner" : "member",
    }))
    await db.insert(activityMember).values(actMembers)

    console.log(`  Activity: ${cfg.activityName} — ${uniqueActivityMemberIds.length} members`)

    // 3. Create ranking definition
    const defId = seedId(`ranking_${cfg.domainId}`)
    await db.insert(rankingDefinition).values({
      id: defId,
      organizationId: orgId,
      activityId,
      name: `${cfg.activityName} Rankings`,
      domainId: cfg.domainId,
      createdBy: ownerId,
      createdAt: daysAgo(110 - d * 5),
    })

    // 4. Create levels (if any)
    const levelIds: string[] = []
    for (const lvl of cfg.levels) {
      const id = seedId(`level_${cfg.domainId}_${lvl.order}`)
      levelIds.push(id)
      await db.insert(rankingLevel).values({
        id,
        organizationId: orgId,
        rankingDefinitionId: defId,
        name: lvl.name,
        color: lvl.color,
        order: lvl.order,
      })
    }
    if (cfg.levels.length > 0) {
      console.log(`    ${cfg.levels.length} levels`)
    }

    // 5. Create sessions and matches
    const activitySessionIds: string[] = []
    let totalMatches = 0
    // Track cumulative stats per user for this ranking
    const userStats: Record<string, Record<string, number>> = {}

    for (let s = 0; s < cfg.sessionsCount; s++) {
      const template = cfg.sessionTemplates[s % cfg.sessionTemplates.length]
      const sessionDaysAgo = Math.max(1, 80 - s * 14 + randomInt(-3, 3))
      const sessionId = seedId(`session_${cfg.domainId}_${s}`)
      activitySessionIds.push(sessionId)
      allSessionIds.push(sessionId)

      await db.insert(eventSession).values({
        id: sessionId,
        organizationId: orgId,
        activityId,
        title: s < cfg.sessionTemplates.length
          ? template.title
          : `${template.title} #${Math.floor(s / cfg.sessionTemplates.length) + 1}`,
        description: `${cfg.activityName} session. All levels welcome.`,
        dateTime: daysAgo(sessionDaysAgo),
        location: template.location,
        maxCapacity: pick([10, 12, 16, 20]),
        maxWaitlist: pick([0, 3, 5]),
        price: template.price,
        joinMode: "open",
        status: sessionDaysAgo > 3 ? "completed" : "published",
        createdBy: ownerId,
      })

      // Generate matches for this session
      for (let m = 0; m < cfg.matchesPerSession; m++) {
        const ppt = cfg.playersPerTeam
        const neededPlayers = ppt * 2
        if (uniqueActivityMemberIds.length < neededPlayers) continue

        const players = pickN(uniqueActivityMemberIds, neededPlayers)
        const team1 = players.slice(0, ppt)
        const team2 = players.slice(ppt, ppt * 2)

        const scores = cfg.generateScores()
        const result = cfg.resolveMatch(scores)

        // Build derived stats per player
        const derivedStats: Record<string, Record<string, number>> = {}
        for (const userId of team1) {
          derivedStats[userId] = { ...result.team1Stats }
          // Accumulate for member ranks
          if (!userStats[userId]) userStats[userId] = {}
          for (const [k, v] of Object.entries(result.team1Stats)) {
            userStats[userId][k] = (userStats[userId][k] ?? 0) + v
          }
        }
        for (const userId of team2) {
          derivedStats[userId] = { ...result.team2Stats }
          if (!userStats[userId]) userStats[userId] = {}
          for (const [k, v] of Object.entries(result.team2Stats)) {
            userStats[userId][k] = (userStats[userId][k] ?? 0) + v
          }
        }

        await db.insert(matchRecord).values({
          id: seedId(`match_${cfg.domainId}_s${s}_m${m}`),
          organizationId: orgId,
          rankingDefinitionId: defId,
          sessionId,
          matchFormat: cfg.defaultFormat,
          team1,
          team2,
          scores,
          winner: result.winner,
          derivedStats,
          recordedBy: ownerId,
          createdAt: daysAgo(sessionDaysAgo - randomInt(0, 1)),
        })
        totalMatches++
      }
    }

    console.log(`    ${cfg.sessionsCount} sessions, ${totalMatches} matches`)

    // 6. Create member ranks from accumulated stats
    const rankedUserIds = Object.keys(userStats)
    // Sort by wins descending for level assignment
    rankedUserIds.sort(
      (a, b) => (userStats[b].wins ?? 0) - (userStats[a].wins ?? 0)
    )

    for (let i = 0; i < rankedUserIds.length; i++) {
      const userId = rankedUserIds[i]

      // Assign level based on position in ranking (top players get highest levels)
      let currentLevelId: string | null = null
      if (levelIds.length > 0) {
        // i=0 is best player → highest level index, last player → lowest level index
        const levelIdx = Math.min(
          levelIds.length - 1,
          Math.floor((rankedUserIds.length - 1 - i) / rankedUserIds.length * levelIds.length)
        )
        currentLevelId = levelIds[levelIdx]
      }

      await db.insert(memberRank).values({
        id: seedId(`mrank_${cfg.domainId}_${i}`),
        organizationId: orgId,
        rankingDefinitionId: defId,
        userId,
        currentLevelId,
        stats: userStats[userId],
        lastActivityAt: daysAgo(randomInt(1, 30)),
      })
    }

    console.log(`    ${rankedUserIds.length} member ranks`)
  }

  return { activityIds: allActivityIds, sessionIds: allSessionIds }
}

async function createParticipations(
  sessionIds: string[]
): Promise<void> {
  console.log("Creating participations...")

  let total = 0

  for (const sessionId of sessionIds) {
    // Fetch session to know capacity & price
    const [sess] = await db
      .select({
        maxCapacity: eventSession.maxCapacity,
        price: eventSession.price,
        status: eventSession.status,
        dateTime: eventSession.dateTime,
        activityId: eventSession.activityId,
      })
      .from(eventSession)
      .where(eq(eventSession.id, sessionId))

    if (!sess) continue

    // Get activity members for this session's activity
    const actMembers = await db
      .select({ userId: activityMember.userId })
      .from(activityMember)
      .where(eq(activityMember.activityId, sess.activityId))
    const actMemberIds = actMembers.map((r) => r.userId)

    // 50-90% of activity members join each session
    const joinCount = randomInt(
      Math.floor(actMemberIds.length * 0.5),
      Math.min(actMemberIds.length, sess.maxCapacity + 3)
    )

    const shuffled = [...actMemberIds].sort(() => Math.random() - 0.5)
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

      let attendance: "pending" | "show" | "no_show" = "pending"
      if (isCompleted && status === "joined") {
        attendance = weighted([
          ["show", 75],
          ["no_show", 18],
          ["pending", 7],
        ])
      }

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
    "Strong player. Consider for competitive matches.",
    "Missed last 3 sessions without notice.",
    "Brought 2 new members to the group last month.",
    "Requested to help organize weekend tournaments.",
    "Recovering from injury, taking it easy.",
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
        "Hey! I'd love to join your community.",
        "Friend recommended this group. Can I join?",
        "Looking for a sports community in Amman.",
        null,
      ]),
      formAnswers: {
        field_sport: pick(["Padel", "Football", "Tennis"]),
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
  const { sessionIds } = await createActivitiesAndRankings(
    orgId,
    ownerId,
    memberUserIds
  )
  await createParticipations(sessionIds)
  await createMemberNotes(orgId, ownerId, memberUserIds)
  await createJoinRequests(orgId, memberUserIds)
  await createInviteLinks(orgId, ownerId)

  console.log("\n=== Seed complete! ===")
  console.log(`\n  Login:    ${OWNER_EMAIL} / ${PASSWORD}`)
  console.log(`  Org:      Seed Community TEST`)
  console.log(`  Members:  ${memberUserIds.length + 1}`)
  console.log(`  Sessions: ${sessionIds.length}`)
  console.log(`  Activities: ${DOMAIN_CONFIGS.length} (${DOMAIN_CONFIGS.map((c) => c.activityName).join(", ")})`)
  console.log(`  URL:      /${OWNER_USERNAME}/seed-community-test\n`)
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

  console.log("Deleting ranking data...")
  await db
    .delete(matchRecord)
    .where(eq(matchRecord.organizationId, orgId))
  await db
    .delete(rankStatEntry)
    .where(eq(rankStatEntry.organizationId, orgId))
  await db
    .delete(memberRank)
    .where(eq(memberRank.organizationId, orgId))
  await db
    .delete(rankingLevel)
    .where(eq(rankingLevel.organizationId, orgId))
  await db
    .delete(rankingDefinition)
    .where(eq(rankingDefinition.organizationId, orgId))

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

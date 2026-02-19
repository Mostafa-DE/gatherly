/**
 * Seed LocalMinds scenario data (reversible).
 *
 * Usage:
 *   pnpm db:seed:localminds
 *   pnpm db:seed:localminds:clean
 */

import { and, eq, inArray, like } from "drizzle-orm"
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
  groupMemberProfile,
} from "../src/db/schema"
import { account, session as authSession } from "../src/db/auth-schema"
import { smartGroupConfig } from "../src/plugins/smart-groups/schema"
import type { JoinFormSchema } from "../src/types/form"

const PASSWORD = "password123"

const OWNER_USERNAME = "localmindsseedadmin"
const OWNER_EMAIL = "localminds-seed-admin@gatherly.test"
const OWNER_PHONE = "+962790000000"

const ORG_NAME = "Local Minds JO!"
const ORG_USER_SLUG = "local-minds-jo"
const ORG_SLUG = `${OWNER_USERNAME}-${ORG_USER_SLUG}`

const USER_EMAIL_PREFIX = "localminds-seed-"
const USERNAME_PREFIX = "localmindsseed"
const MEMBER_COUNT = 96

const ACTIVITY_NAME = "LocalMinds Coffee Circles"
const ACTIVITY_SLUG = "localminds-coffee-circles"
const UPCOMING_SESSION_COUNT = 12
const PARTICIPANTS_PER_SESSION = 6

const LOCAL_MINDS_DESCRIPTION =
  "LocalMinds is a community-driven platform that brings people together. " +
  "Over a cup of coffee, you will meet five other like-minded individuals not just for small talk, " +
  "but to build meaningful connections. Each group is carefully matched through our algorithm, " +
  "based on the personality test you take when joining. Whether you are seeking new friends, " +
  "potential co-workers, or future collaborators, LocalMinds helps you connect with people who share " +
  "your values, interests, and ambitions. It is about creating real bonds, one coffee at a time."

const LOCAL_MINDS_QUESTIONS: JoinFormSchema = {
  fields: [
    {
      id: "q_conversations",
      type: "select",
      label: "What kind of conversations do you enjoy most?",
      required: true,
      options: ["Deep & thoughtful", "Fun & lighthearted", "A mix of both"],
    },
    {
      id: "q_free_evening",
      type: "select",
      label: "How do you usually spend a free evening?",
      required: true,
      options: [
        "Out socializing (cafes, events, parties)",
        "Active (gym, sports, outdoor activities)",
        "Relaxing (books, movies, gaming, home time)",
      ],
    },
    {
      id: "q_focus_life",
      type: "multiselect",
      label: "What is your current focus in life?",
      required: true,
      options: [
        "Personal growth & learning",
        "Career & business",
        "Relationships & community",
        "Fun & new experiences",
      ],
    },
    {
      id: "q_extroversion",
      type: "number",
      label: "I am an extroverted person (1-10)",
      required: true,
      validation: { min: 1, max: 10 },
    },
    {
      id: "q_topics",
      type: "multiselect",
      label: "Which topics excite you the most? (Pick one or two)",
      required: true,
      options: [
        "Business & careers",
        "Arts & music",
        "Sports & fitness",
        "Travel & food",
        "Science & technology",
      ],
    },
    {
      id: "q_meeting_preference",
      type: "select",
      label: "Do you prefer meeting...",
      required: true,
      options: [
        "Like-minded people with similar interests",
        "Different people with new perspectives",
        "A mix of both",
      ],
    },
    {
      id: "q_relationship_status",
      type: "select",
      label: "What is your relationship status?",
      required: false,
      options: [
        "Single",
        "Married",
        "It is complicated",
        "In a relationship",
        "I would prefer not to say",
      ],
    },
    {
      id: "info_name",
      type: "text",
      label: "Name",
      required: true,
    },
    {
      id: "info_city",
      type: "text",
      label: "City",
      required: true,
    },
    {
      id: "info_whatsapp",
      type: "phone",
      label: "Whatsapp number",
      required: true,
      validation: { pattern: "^\\+?[0-9]{8,15}$" },
    },
    {
      id: "info_instagram",
      type: "text",
      label: "Instagram @",
      required: false,
    },
    {
      id: "info_school",
      type: "text",
      label: "School",
      required: false,
    },
    {
      id: "info_university",
      type: "text",
      label: "University",
      required: false,
    },
    {
      id: "info_identity",
      type: "select",
      label: "What best describes you",
      required: true,
      options: ["Student", "Working professional", "Entrepreneur", "Freelancer", "Other"],
    },
    {
      id: "info_gender",
      type: "select",
      label: "Gender",
      required: true,
      options: ["Female", "Male", "Prefer not to say"],
    },
    {
      id: "info_date_of_birth",
      type: "date",
      label: "Date of Birth",
      required: true,
    },
    {
      id: "info_languages",
      type: "multiselect",
      label: "What language(s) are you willing to speak?",
      required: true,
      options: ["English", "Arabic"],
    },
  ],
}

const FIRST_NAMES = [
  "Lina",
  "Omar",
  "Sara",
  "Yousef",
  "Rana",
  "Noor",
  "Hadi",
  "Maya",
  "Ali",
  "Haya",
  "Khaled",
  "Dana",
  "Zaid",
  "Mariam",
  "Tareq",
  "Aya",
]

const LAST_NAMES = [
  "Haddad",
  "Khalil",
  "Nasser",
  "Farah",
  "Mansour",
  "Attar",
  "Jaber",
  "Khoury",
  "Saad",
  "Darwish",
  "Awad",
  "Bazzi",
  "Rashed",
  "Saleh",
  "Hamdan",
  "Mourad",
]

const CITIES = ["Amman", "Irbid", "Zarqa", "Aqaba", "Madaba", "Salt"]
const SCHOOLS = ["King's Academy", "Jubilee School", "International School of Choueifat", "Baccalaureate School", "Rosary School"]
const UNIVERSITIES = ["University of Jordan", "GJU", "PSUT", "Yarmouk University", "AUB", "Just University"]

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

function pad(value: number, size: number): string {
  return value.toString().padStart(size, "0")
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickCount<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function randomDateString(yearMin: number, yearMax: number): string {
  const year = yearMin + Math.floor(Math.random() * (yearMax - yearMin + 1))
  const month = 1 + Math.floor(Math.random() * 12)
  const day = 1 + Math.floor(Math.random() * 28)
  return `${year}-${pad(month, 2)}-${pad(day, 2)}`
}

type SeedUser = {
  id: string
  name: string
  email: string
  phone: string
  city: string
}

function buildProfileAnswers(seedUser: SeedUser): Record<string, unknown> {
  return {
    q_conversations: pick([
      "Deep & thoughtful",
      "Fun & lighthearted",
      "A mix of both",
    ]),
    q_free_evening: pick([
      "Out socializing (cafes, events, parties)",
      "Active (gym, sports, outdoor activities)",
      "Relaxing (books, movies, gaming, home time)",
    ]),
    q_focus_life: pickCount(
      [
        "Personal growth & learning",
        "Career & business",
        "Relationships & community",
        "Fun & new experiences",
      ],
      1,
      2
    ),
    q_extroversion: 1 + Math.floor(Math.random() * 10),
    q_topics: pickCount(
      [
        "Business & careers",
        "Arts & music",
        "Sports & fitness",
        "Travel & food",
        "Science & technology",
      ],
      1,
      2
    ),
    q_meeting_preference: pick([
      "Like-minded people with similar interests",
      "Different people with new perspectives",
      "A mix of both",
    ]),
    q_relationship_status: pick([
      "Single",
      "Married",
      "It is complicated",
      "In a relationship",
      "I would prefer not to say",
    ]),
    info_name: seedUser.name,
    info_city: seedUser.city,
    info_whatsapp: seedUser.phone,
    info_instagram: `@${seedUser.email.split("@")[0]}`,
    info_school: pick(SCHOOLS),
    info_university: pick(UNIVERSITIES),
    info_identity: pick([
      "Student",
      "Working professional",
      "Entrepreneur",
      "Freelancer",
      "Other",
    ]),
    info_gender: pick(["Female", "Male", "Prefer not to say"]),
    info_date_of_birth: randomDateString(1988, 2005),
    info_languages: pickCount(["English", "Arabic"], 1, 2),
  }
}

async function createUsers(): Promise<{ ownerId: string; users: SeedUser[] }> {
  console.log("Creating LocalMinds users...")

  const ownerResult = await auth.api.signUpEmail({
    body: {
      username: OWNER_USERNAME,
      name: "LocalMinds Admin",
      email: OWNER_EMAIL,
      password: PASSWORD,
      phoneNumber: OWNER_PHONE,
      city: "Amman",
      onboardingCompleted: true,
    },
  })

  if (!ownerResult?.user?.id) {
    throw new Error("Failed to create LocalMinds owner")
  }

  const users: SeedUser[] = []

  for (let i = 1; i <= MEMBER_COUNT; i++) {
    const number = pad(i, 3)
    const first = FIRST_NAMES[(i - 1) % FIRST_NAMES.length]
    const last = LAST_NAMES[Math.floor((i - 1) / FIRST_NAMES.length) % LAST_NAMES.length]
    const name = `${first} ${last}`
    const city = CITIES[(i - 1) % CITIES.length]
    const username = `${USERNAME_PREFIX}${number}`
    const email = `${USER_EMAIL_PREFIX}${number}@gatherly.test`
    const phone = `+96279${pad(100000 + i, 6)}`

    const result = await auth.api.signUpEmail({
      body: {
        username,
        name,
        email,
        password: PASSWORD,
        phoneNumber: phone,
        city,
        onboardingCompleted: true,
      },
    })

    if (!result?.user?.id) {
      throw new Error(`Failed to create user ${email}`)
    }

    users.push({
      id: result.user.id,
      name,
      email,
      phone,
      city,
    })
  }

  console.log(`  Owner created: ${OWNER_EMAIL}`)
  console.log(`  Members created: ${users.length}`)
  return { ownerId: ownerResult.user.id, users }
}

async function createOrganizationData(ownerId: string): Promise<string> {
  const orgId = `localminds_seed_org_${createId()}`

  console.log("Creating organization + settings...")

  await db.insert(organization).values({
    id: orgId,
    name: ORG_NAME,
    slug: ORG_SLUG,
    createdAt: new Date(),
    metadata: JSON.stringify({
      description: LOCAL_MINDS_DESCRIPTION,
      scenario: "localminds-seed",
    }),
    timezone: "Asia/Amman",
    defaultJoinMode: "open",
    userSlug: ORG_USER_SLUG,
    ownerUsername: OWNER_USERNAME,
  })

  await db.insert(member).values({
    id: `localminds_seed_member_owner_${createId()}`,
    organizationId: orgId,
    userId: ownerId,
    role: "owner",
    createdAt: new Date(),
  })

  await db.insert(organizationSettings).values({
    organizationId: orgId,
    currency: "JOD",
    enabledPlugins: {
      analytics: true,
      ai: true,
      "smart-groups": true,
    },
    joinFormSchema: LOCAL_MINDS_QUESTIONS,
    joinFormVersion: 1,
  })

  return orgId
}

async function addMembersAndProfiles(orgId: string, users: SeedUser[]): Promise<void> {
  console.log("Creating organization members + profile answers...")

  const memberRows = users.map((u) => ({
    id: `localminds_seed_member_${createId()}`,
    organizationId: orgId,
    userId: u.id,
    role: "member" as const,
    createdAt: new Date(),
  }))

  const profileRows = users.map((u) => ({
    id: `localminds_seed_profile_${createId()}`,
    organizationId: orgId,
    userId: u.id,
    answers: buildProfileAnswers(u),
  }))

  const chunkSize = 200
  for (let i = 0; i < memberRows.length; i += chunkSize) {
    await db.insert(member).values(memberRows.slice(i, i + chunkSize))
  }
  for (let i = 0; i < profileRows.length; i += chunkSize) {
    await db.insert(groupMemberProfile).values(profileRows.slice(i, i + chunkSize))
  }
}

async function createActivityData(orgId: string, ownerId: string, users: SeedUser[]): Promise<string> {
  console.log("Creating LocalMinds activity + smart-group config...")

  const [createdActivity] = await db
    .insert(activity)
    .values({
      organizationId: orgId,
      name: ACTIVITY_NAME,
      slug: ACTIVITY_SLUG,
      joinMode: "open",
      enabledPlugins: {
        "smart-groups": true,
      },
      createdBy: ownerId,
    })
    .returning({ id: activity.id })

  const activityMemberRows = users.map((u) => ({
    id: `localminds_seed_activity_member_${createId()}`,
    activityId: createdActivity.id,
    userId: u.id,
    status: "active" as const,
  }))

  const chunkSize = 200
  for (let i = 0; i < activityMemberRows.length; i += chunkSize) {
    await db.insert(activityMember).values(activityMemberRows.slice(i, i + chunkSize))
  }

  await db.insert(smartGroupConfig).values({
    organizationId: orgId,
    activityId: createdActivity.id,
    name: "LocalMinds Matching",
    defaultCriteria: {
      mode: "similarity",
      fields: [
        { sourceId: "org:q_conversations", weight: 0.2 },
        { sourceId: "org:q_free_evening", weight: 0.15 },
        { sourceId: "org:q_focus_life", weight: 0.2 },
        { sourceId: "org:q_extroversion", weight: 0.2 },
        { sourceId: "org:q_topics", weight: 0.15 },
        { sourceId: "org:q_meeting_preference", weight: 0.1 },
      ],
      groupCount: 6,
      varietyWeight: 0.2,
    },
    visibleFields: [
      "org:q_conversations",
      "org:q_free_evening",
      "org:q_focus_life",
      "org:q_extroversion",
      "org:q_topics",
      "org:q_meeting_preference",
      "org:info_city",
      "org:info_languages",
    ],
    createdBy: ownerId,
  })

  return createdActivity.id
}

async function createUpcomingSessions(orgId: string, activityId: string, ownerId: string, users: SeedUser[]) {
  console.log("Creating upcoming coffee sessions + participations...")

  const locations = [
    "Jabal Amman Coffee House",
    "Rainbow Street Cafe",
    "Abdali Lounge",
    "Shmeisani Coffee Spot",
    "Dabouq Roastery",
  ]

  for (let i = 0; i < UPCOMING_SESSION_COUNT; i++) {
    const [sessionRow] = await db
      .insert(eventSession)
      .values({
        id: `localminds_seed_session_${createId()}`,
        organizationId: orgId,
        activityId,
        title: `LocalMinds Coffee Circle #${i + 1}`,
        description: LOCAL_MINDS_DESCRIPTION,
        dateTime: daysFromNow(2 + i * 3),
        location: locations[i % locations.length],
        maxCapacity: PARTICIPANTS_PER_SESSION,
        maxWaitlist: 12,
        price: "4.00",
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning({ id: eventSession.id })

    const start = (i * PARTICIPANTS_PER_SESSION) % users.length
    const participants = Array.from({ length: PARTICIPANTS_PER_SESSION }, (_, idx) => {
      return users[(start + idx) % users.length]
    })

    await db.insert(participation).values(
      participants.map((participant) => ({
        id: `localminds_seed_participation_${createId()}`,
        sessionId: sessionRow.id,
        userId: participant.id,
        status: "joined",
        joinedAt: new Date(),
      }))
    )
  }
}

async function seed() {
  console.log("\n=== LocalMinds Scenario Seed ===\n")

  const [existingOrg] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))
    .limit(1)

  if (existingOrg) {
    console.log("LocalMinds seed already exists. Run cleanup first.\n")
    return
  }

  const { ownerId, users } = await createUsers()
  const orgId = await createOrganizationData(ownerId)
  await addMembersAndProfiles(orgId, users)
  const activityId = await createActivityData(orgId, ownerId, users)
  await createUpcomingSessions(orgId, activityId, ownerId, users)

  console.log("\n=== LocalMinds seed complete ===")
  console.log(`  Org: ${ORG_NAME}`)
  console.log(`  Slug: ${ORG_SLUG}`)
  console.log(`  URL: /${OWNER_USERNAME}/${ORG_USER_SLUG}`)
  console.log(`  Login: ${OWNER_EMAIL} / ${PASSWORD}`)
  console.log(`  Members: ${users.length + 1}`)
  console.log(`  Activity: ${ACTIVITY_NAME}`)
  console.log(`  Upcoming sessions: ${UPCOMING_SESSION_COUNT}\n`)
}

async function cleanup() {
  console.log("\n=== Cleaning LocalMinds Scenario Seed ===\n")

  const [org] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))
    .limit(1)

  if (org) {
    const orgId = org.id

    const sessions = await db
      .select({ id: eventSession.id })
      .from(eventSession)
      .where(eq(eventSession.organizationId, orgId))
    const sessionIds = sessions.map((s) => s.id)

    if (sessionIds.length > 0) {
      await db
        .delete(participation)
        .where(inArray(participation.sessionId, sessionIds))
    }

    await db
      .delete(eventSession)
      .where(eq(eventSession.organizationId, orgId))

    await db
      .delete(smartGroupConfig)
      .where(eq(smartGroupConfig.organizationId, orgId))

    const activities = await db
      .select({ id: activity.id })
      .from(activity)
      .where(eq(activity.organizationId, orgId))
    const activityIds = activities.map((a) => a.id)

    if (activityIds.length > 0) {
      await db
        .delete(activityMember)
        .where(inArray(activityMember.activityId, activityIds))
    }

    await db
      .delete(activity)
      .where(eq(activity.organizationId, orgId))

    await db
      .delete(groupMemberProfile)
      .where(eq(groupMemberProfile.organizationId, orgId))

    await db
      .delete(member)
      .where(eq(member.organizationId, orgId))

    await db
      .delete(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))

    await db
      .delete(organization)
      .where(eq(organization.id, orgId))
  } else {
    console.log("No LocalMinds seed organization found, cleaning seeded users only...")
  }

  const seededUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        like(user.email, `${USER_EMAIL_PREFIX}%@gatherly.test`)
      )
    )

  const userIds = seededUsers.map((u) => u.id)

  const [ownerUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, OWNER_EMAIL))
    .limit(1)

  if (ownerUser) {
    userIds.push(ownerUser.id)
  }

  if (userIds.length > 0) {
    const dedupedUserIds = [...new Set(userIds)]

    await db
      .delete(authSession)
      .where(inArray(authSession.userId, dedupedUserIds))

    await db
      .delete(account)
      .where(inArray(account.userId, dedupedUserIds))

    await db
      .delete(user)
      .where(inArray(user.id, dedupedUserIds))
  }

  console.log("LocalMinds seed data removed.\n")
}

const isClean = process.argv.includes("--clean")
const run = isClean ? cleanup : seed

run()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`\n${isClean ? "Cleanup" : "Seed"} failed: ${message}\n`)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  })

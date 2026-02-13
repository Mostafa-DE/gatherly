import { randomUUID } from "node:crypto"
import { inArray } from "drizzle-orm"
import { db } from "@/db"
import { member, organization, user, activity, activityMember } from "@/db/schema"

function createToken(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`
}

function createUniquePhoneNumber(): string {
  const entropy = BigInt(`0x${randomUUID().replaceAll("-", "").slice(0, 15)}`)
  const localNumber = (entropy % 10_000_000_000n).toString().padStart(10, "0")
  return `+1${localNumber}`
}

export async function createTestUser(name = "Test User") {
  const username = createToken("user").toLowerCase()
  const [createdUser] = await db
    .insert(user)
    .values({
      id: createToken("usr"),
      name,
      email: `${createToken("email")}@example.com`,
      emailVerified: true,
      phoneNumber: createUniquePhoneNumber(),
      username,
    })
    .returning()

  return createdUser
}

export async function createTestOrganization(ownerUsername = "testowner") {
  const userSlug = createToken("slug")
  const [createdOrganization] = await db
    .insert(organization)
    .values({
      id: createToken("org"),
      name: "Test Organization",
      slug: `${ownerUsername}-${userSlug}`,
      userSlug,
      ownerUsername,
      createdAt: new Date(),
      defaultJoinMode: "open",
    })
    .returning()

  return createdOrganization
}

export async function createTestMembership(input: {
  organizationId: string
  userId: string
  role: "owner" | "admin" | "member"
}) {
  const [createdMembership] = await db
    .insert(member)
    .values({
      id: createToken("mem"),
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role,
      createdAt: new Date(),
    })
    .returning()

  return createdMembership
}

export async function createTestActivity(input: {
  organizationId: string
  createdBy: string
  name?: string
  slug?: string
  joinMode?: "open" | "require_approval" | "invite"
}) {
  const [createdActivity] = await db
    .insert(activity)
    .values({
      id: createToken("act"),
      organizationId: input.organizationId,
      name: input.name ?? "Test Activity",
      slug: input.slug ?? createToken("slug").toLowerCase(),
      joinMode: input.joinMode ?? "open",
      createdBy: input.createdBy,
      createdAt: new Date(),
    })
    .returning()

  return createdActivity
}

export async function createTestActivityMember(input: {
  activityId: string
  userId: string
  status?: "pending" | "active" | "rejected"
}) {
  const [createdMember] = await db
    .insert(activityMember)
    .values({
      id: createToken("amem"),
      activityId: input.activityId,
      userId: input.userId,
      status: input.status ?? "active",
      createdAt: new Date(),
    })
    .returning()

  return createdMember
}

export async function cleanupTestData(input: {
  organizationIds: string[]
  userIds: string[]
}) {
  if (input.organizationIds.length > 0) {
    await db
      .delete(organization)
      .where(inArray(organization.id, input.organizationIds))
  }

  if (input.userIds.length > 0) {
    await db
      .delete(user)
      .where(inArray(user.id, input.userIds))
  }
}

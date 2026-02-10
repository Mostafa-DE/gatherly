import { eq, asc } from "drizzle-orm"
import { db } from "@/db"
import {
  interestCategory,
  interest,
  userInterest,
  organizationInterest,
} from "@/db/schema"

export async function getAllInterestsGrouped() {
  const categories = await db
    .select()
    .from(interestCategory)
    .orderBy(asc(interestCategory.displayOrder))

  const interests = await db
    .select()
    .from(interest)
    .orderBy(asc(interest.name))

  return categories.map((cat) => ({
    ...cat,
    interests: interests.filter((i) => i.categoryId === cat.id),
  }))
}

export async function getUserInterests(userId: string) {
  const rows = await db
    .select({ interestId: userInterest.interestId })
    .from(userInterest)
    .where(eq(userInterest.userId, userId))
  return rows.map((r) => r.interestId)
}

export async function setUserInterests(userId: string, interestIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(userInterest).where(eq(userInterest.userId, userId))
    if (interestIds.length > 0) {
      await tx.insert(userInterest).values(
        interestIds.map((interestId) => ({ userId, interestId }))
      )
    }
  })
}

export async function getOrganizationInterests(orgId: string) {
  const rows = await db
    .select({ interestId: organizationInterest.interestId })
    .from(organizationInterest)
    .where(eq(organizationInterest.organizationId, orgId))
  return rows.map((r) => r.interestId)
}

export async function setOrganizationInterests(orgId: string, interestIds: string[]) {
  await db.transaction(async (tx) => {
    await tx
      .delete(organizationInterest)
      .where(eq(organizationInterest.organizationId, orgId))
    if (interestIds.length > 0) {
      await tx.insert(organizationInterest).values(
        interestIds.map((interestId) => ({ organizationId: orgId, interestId }))
      )
    }
  })
}

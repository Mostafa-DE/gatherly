import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import { groupMemberProfile } from "@/db/schema"
import { getProfileByOrgAndUser, upsertProfile } from "@/data-access/group-member-profiles"
import { getOrgSettings, updateJoinFormSchema } from "@/data-access/organization-settings"
import { ValidationError } from "@/exceptions"
import {
  cleanupTestData,
  createTestMembership,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"
import { validateAndUpsertGroupMemberProfile } from "@/use-cases/group-member-profile"

describe("group-member-profile use-case", () => {
  let organizationId = ""
  let userId = ""
  const userIds: string[] = []

  beforeEach(async () => {
    const organization = await createTestOrganization()
    const user = await createTestUser("Profile User")

    organizationId = organization.id
    userId = user.id
    userIds.push(user.id)

    await createTestMembership({
      organizationId,
      userId,
      role: "member",
    })
  })

  afterEach(async () => {
    if (organizationId) {
      await cleanupTestData({
        organizationIds: [organizationId],
        userIds,
      })
    }

    organizationId = ""
    userId = ""
    userIds.length = 0
  })

  it("rejects missing required fields from join form schema", async () => {
    await updateJoinFormSchema(organizationId, {
      fields: [
        {
          id: "full_name",
          type: "text",
          label: "Full Name",
          required: true,
        },
      ],
    })

    await expect(
      validateAndUpsertGroupMemberProfile(
        {
          getOrgSettings,
          upsertProfile,
        },
        {
          organizationId,
          userId,
          answers: {},
        }
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejects unknown answer fields not present in schema", async () => {
    await updateJoinFormSchema(organizationId, {
      fields: [
        {
          id: "phone",
          type: "text",
          label: "Phone",
          required: false,
        },
      ],
    })

    await expect(
      validateAndUpsertGroupMemberProfile(
        {
          getOrgSettings,
          upsertProfile,
        },
        {
          organizationId,
          userId,
          answers: { unknown_field: "value" },
        }
      )
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("stores and updates answers when validation passes", async () => {
    await updateJoinFormSchema(organizationId, {
      fields: [
        {
          id: "full_name",
          type: "text",
          label: "Full Name",
          required: true,
          validation: { min: 2 },
        },
        {
          id: "attendance_mode",
          type: "select",
          label: "Attendance Mode",
          required: true,
          options: ["online", "in-person"],
        },
      ],
    })

    const created = await validateAndUpsertGroupMemberProfile(
      {
        getOrgSettings,
        upsertProfile,
      },
      {
        organizationId,
        userId,
        answers: {
          full_name: "Alex",
          attendance_mode: "online",
        },
      }
    )

    const updated = await validateAndUpsertGroupMemberProfile(
      {
        getOrgSettings,
        upsertProfile,
      },
      {
        organizationId,
        userId,
        answers: {
          full_name: "Alex Doe",
          attendance_mode: "in-person",
        },
      }
    )

    expect(updated.id).toBe(created.id)

    const profile = await getProfileByOrgAndUser(organizationId, userId)
    expect(profile?.answers).toEqual({
      full_name: "Alex Doe",
      attendance_mode: "in-person",
    })

    const rows = await db
      .select()
      .from(groupMemberProfile)
      .where(
        and(
          eq(groupMemberProfile.organizationId, organizationId),
          eq(groupMemberProfile.userId, userId)
        )
      )
    expect(rows.length).toBe(1)
  })
})

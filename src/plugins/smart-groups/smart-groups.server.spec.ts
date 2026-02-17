import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import { eventSession, participation, groupMemberProfile } from "@/db/schema"
import {
  cleanupTestData,
  createTestActivity,
  createTestActivityMember,
  createTestOrganization,
  createTestUser,
  createTestMembership,
} from "@/tests/server/db-fixtures"
import { createConfig, getConfigByActivity } from "./data-access/configs"
import { createRunWithEntries, getRunDetails, confirmRun } from "./data-access/runs"
import { createProposals, getProposalsByRun, updateProposalMembers } from "./data-access/proposals"
import { splitByAttributes } from "./algorithm"
import { buildMemberProfiles } from "@/data-access/member-profiles"

describe("smart-groups data-access", () => {
  let organizationId = ""
  let ownerId = ""
  let activityId = ""
  let user1Id = ""
  let user2Id = ""
  let user3Id = ""
  let user4Id = ""

  const organizationIds: string[] = []
  const userIds: string[] = []

  beforeEach(async () => {
    const org = await createTestOrganization()
    organizationId = org.id
    organizationIds.push(organizationId)

    const owner = await createTestUser("Owner")
    ownerId = owner.id
    userIds.push(ownerId)

    await createTestMembership({
      organizationId,
      userId: ownerId,
      role: "owner",
    })

    const act = await createTestActivity({
      organizationId,
      createdBy: ownerId,
      name: "Test Activity",
      joinMode: "open",
    })
    activityId = act.id

    // Create 4 users and add them as activity members
    const u1 = await createTestUser("Alice")
    const u2 = await createTestUser("Bob")
    const u3 = await createTestUser("Charlie")
    const u4 = await createTestUser("Diana")
    user1Id = u1.id
    user2Id = u2.id
    user3Id = u3.id
    user4Id = u4.id
    userIds.push(user1Id, user2Id, user3Id, user4Id)

    for (const uid of [user1Id, user2Id, user3Id, user4Id]) {
      await createTestMembership({ organizationId, userId: uid, role: "member" })
      await createTestActivityMember({ activityId, userId: uid, status: "active" })
    }

    // Add org profiles with form answers
    await db.insert(groupMemberProfile).values([
      {
        organizationId,
        userId: user1Id,
        answers: { field_gender: "Female", field_level: "Advanced" },
      },
      {
        organizationId,
        userId: user2Id,
        answers: { field_gender: "Male", field_level: "Beginner" },
      },
      {
        organizationId,
        userId: user3Id,
        answers: { field_gender: "Female", field_level: "Beginner" },
      },
      {
        organizationId,
        userId: user4Id,
        answers: { field_gender: "Male", field_level: "Advanced" },
      },
    ])
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({ organizationIds, userIds })
    }
    organizationIds.length = 0
    userIds.length = 0
  })

  // ==========================================================================
  // Config
  // ==========================================================================

  describe("configs", () => {
    it("creates and retrieves a config", async () => {
      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Test Groups",
      })

      expect(config.name).toBe("Test Groups")
      expect(config.activityId).toBe(activityId)

      const fetched = await getConfigByActivity(activityId, organizationId)
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(config.id)
    })

    it("rejects duplicate config for same activity", async () => {
      await createConfig(organizationId, ownerId, {
        activityId,
        name: "First",
      })

      await expect(
        createConfig(organizationId, ownerId, {
          activityId,
          name: "Second",
        })
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })
  })

  // ==========================================================================
  // Full flow: generate → update proposal → confirm
  // ==========================================================================

  describe("full flow", () => {
    it("generates groups, allows editing, and confirms", async () => {
      // Create config
      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Test Groups",
      })

      // Build member profiles
      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        userIds: [user1Id, user2Id, user3Id, user4Id],
      })

      expect(profiles).toHaveLength(4)

      // Run algorithm
      const entries = profiles.map((p) => ({
        userId: p.userId,
        data: p.merged,
      }))
      const groups = splitByAttributes(entries, ["org:field_gender"])

      expect(groups).toHaveLength(2)

      // Create run + entries + proposals in transaction
      const run = await db.transaction(async (tx) => {
        const createdRun = await createRunWithEntries(
          tx,
          {
            organizationId,
            smartGroupConfigId: config.id,
            scope: "activity",
            criteriaSnapshot: { fields: [{ sourceId: "org:field_gender", strategy: "split" }] },
            entryCount: profiles.length,
            groupCount: groups.length,
            generatedBy: ownerId,
          },
          profiles.map((p) => ({
            userId: p.userId,
            dataSnapshot: p.merged,
          }))
        )

        await createProposals(
          tx,
          createdRun.id,
          groups.map((g, i) => ({
            groupIndex: i,
            groupName: g.groupName,
            memberIds: g.memberIds,
          }))
        )

        return createdRun
      })

      expect(run.status).toBe("generated")
      expect(run.entryCount).toBe(4)
      expect(run.groupCount).toBe(2)

      // Verify run details
      const details = await getRunDetails(run.id, organizationId)
      expect(details).not.toBeNull()
      expect(details!.entries).toHaveLength(4)
      expect(details!.proposals).toHaveLength(2)

      // Verify proposals
      const proposals = await getProposalsByRun(run.id)
      expect(proposals).toHaveLength(2)

      const femaleGroup = proposals.find((p) => p.groupName === "Female")!
      const maleGroup = proposals.find((p) => p.groupName === "Male")!

      expect(femaleGroup).toBeDefined()
      expect(maleGroup).toBeDefined()
      expect((femaleGroup.memberIds as string[]).sort()).toEqual([user1Id, user3Id].sort())
      expect((maleGroup.memberIds as string[]).sort()).toEqual([user2Id, user4Id].sort())

      // Edit: move user3 from Female to Male group
      const updated = await updateProposalMembers(
        maleGroup.id,
        organizationId,
        [user2Id, user4Id, user3Id],
        maleGroup.version
      )
      expect(updated.status).toBe("modified")
      expect(updated.version).toBe(2)

      // Also update female group to remove user3
      await updateProposalMembers(
        femaleGroup.id,
        organizationId,
        [user1Id],
        femaleGroup.version
      )

      // Confirm
      const confirmed = await confirmRun(run.id, organizationId, ownerId, run.version)
      expect(confirmed.status).toBe("confirmed")
      expect(confirmed.confirmedBy).toBe(ownerId)
    })

    it("rejects confirm when member appears in multiple groups", async () => {
      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Test Groups",
      })

      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        userIds: [user1Id, user2Id],
      })

      const run = await db.transaction(async (tx) => {
        const createdRun = await createRunWithEntries(
          tx,
          {
            organizationId,
            smartGroupConfigId: config.id,
            scope: "activity",
            criteriaSnapshot: { fields: [] },
            entryCount: 2,
            groupCount: 2,
            generatedBy: ownerId,
          },
          profiles.map((p) => ({ userId: p.userId, dataSnapshot: p.merged }))
        )

        await createProposals(tx, createdRun.id, [
          { groupIndex: 0, groupName: "A", memberIds: [user1Id, user2Id] },
          { groupIndex: 1, groupName: "B", memberIds: [user2Id] },
        ])

        return createdRun
      })

      // user2 is in both groups — confirm should fail
      await expect(
        confirmRun(run.id, organizationId, ownerId, run.version)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("rejects confirm on already-confirmed run", async () => {
      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Test Groups",
      })

      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        userIds: [user1Id, user2Id],
      })

      const run = await db.transaction(async (tx) => {
        const createdRun = await createRunWithEntries(
          tx,
          {
            organizationId,
            smartGroupConfigId: config.id,
            scope: "activity",
            criteriaSnapshot: { fields: [] },
            entryCount: 2,
            groupCount: 2,
            generatedBy: ownerId,
          },
          profiles.map((p) => ({ userId: p.userId, dataSnapshot: p.merged }))
        )

        await createProposals(tx, createdRun.id, [
          { groupIndex: 0, groupName: "A", memberIds: [user1Id] },
          { groupIndex: 1, groupName: "B", memberIds: [user2Id] },
        ])

        return createdRun
      })

      // First confirm succeeds
      await confirmRun(run.id, organizationId, ownerId, run.version)

      // Second confirm fails
      await expect(
        confirmRun(run.id, organizationId, ownerId, run.version)
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })

    it("rejects proposal edit on confirmed run", async () => {
      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Test Groups",
      })

      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        userIds: [user1Id, user2Id],
      })

      const run = await db.transaction(async (tx) => {
        const createdRun = await createRunWithEntries(
          tx,
          {
            organizationId,
            smartGroupConfigId: config.id,
            scope: "activity",
            criteriaSnapshot: { fields: [] },
            entryCount: 2,
            groupCount: 1,
            generatedBy: ownerId,
          },
          profiles.map((p) => ({ userId: p.userId, dataSnapshot: p.merged }))
        )

        await createProposals(tx, createdRun.id, [
          { groupIndex: 0, groupName: "All", memberIds: [user1Id, user2Id] },
        ])

        return createdRun
      })

      await confirmRun(run.id, organizationId, ownerId, run.version)

      const proposals = await getProposalsByRun(run.id)

      await expect(
        updateProposalMembers(proposals[0].id, organizationId, [user1Id], proposals[0].version)
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })

    it("rejects optimistic lock conflict on proposal update", async () => {
      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Test Groups",
      })

      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        userIds: [user1Id, user2Id],
      })

      const run = await db.transaction(async (tx) => {
        const createdRun = await createRunWithEntries(
          tx,
          {
            organizationId,
            smartGroupConfigId: config.id,
            scope: "activity",
            criteriaSnapshot: { fields: [] },
            entryCount: 2,
            groupCount: 1,
            generatedBy: ownerId,
          },
          profiles.map((p) => ({ userId: p.userId, dataSnapshot: p.merged }))
        )

        await createProposals(tx, createdRun.id, [
          { groupIndex: 0, groupName: "All", memberIds: [user1Id, user2Id] },
        ])

        return createdRun
      })

      const proposals = await getProposalsByRun(run.id)
      const proposal = proposals[0]

      // First update succeeds
      await updateProposalMembers(proposal.id, organizationId, [user1Id], proposal.version)

      // Second update with stale version fails
      await expect(
        updateProposalMembers(proposal.id, organizationId, [user2Id], proposal.version)
      ).rejects.toMatchObject({ code: "CONFLICT" })
    })
  })

  // ==========================================================================
  // Session-scoped groups
  // ==========================================================================

  describe("session scope", () => {
    it("generates groups from session participants", async () => {
      // Create a session
      const [session] = await db
        .insert(eventSession)
        .values({
          organizationId,
          activityId,
          title: "Test Session",
          dateTime: new Date(),
          maxCapacity: 10,
          status: "published",
          createdBy: ownerId,
        })
        .returning()

      // Add participants
      await db.insert(participation).values([
        {
          sessionId: session.id,
          userId: user1Id,
          status: "joined",
          formAnswers: { field_skill: "High" },
        },
        {
          sessionId: session.id,
          userId: user2Id,
          status: "joined",
          formAnswers: { field_skill: "Low" },
        },
      ])

      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Session Groups",
      })

      // Build profiles with session context
      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        sessionId: session.id,
        userIds: [user1Id, user2Id],
      })

      // Verify session form data is included
      expect(profiles[0].sources.sessionForm).not.toBeNull()

      // Split by session field
      const entries = profiles.map((p) => ({
        userId: p.userId,
        data: p.merged,
      }))
      const groups = splitByAttributes(entries, ["session:field_skill"])

      expect(groups).toHaveLength(2)

      // Create session-scoped run
      const run = await db.transaction(async (tx) => {
        const createdRun = await createRunWithEntries(
          tx,
          {
            organizationId,
            smartGroupConfigId: config.id,
            sessionId: session.id,
            scope: "session",
            criteriaSnapshot: { fields: [{ sourceId: "session:field_skill", strategy: "split" }] },
            entryCount: profiles.length,
            groupCount: groups.length,
            generatedBy: ownerId,
          },
          profiles.map((p) => ({ userId: p.userId, dataSnapshot: p.merged }))
        )

        await createProposals(
          tx,
          createdRun.id,
          groups.map((g, i) => ({
            groupIndex: i,
            groupName: g.groupName,
            memberIds: g.memberIds,
          }))
        )

        return createdRun
      })

      expect(run.scope).toBe("session")
      expect(run.sessionId).toBe(session.id)

      // Confirm
      const confirmed = await confirmRun(run.id, organizationId, ownerId, run.version)
      expect(confirmed.status).toBe("confirmed")
    })
  })

  // ==========================================================================
  // Multi-field split
  // ==========================================================================

  describe("multi-field split", () => {
    it("creates cross-product groups from 2 fields", async () => {
      await createConfig(organizationId, ownerId, {
        activityId,
        name: "Multi-field Groups",
      })

      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        userIds: [user1Id, user2Id, user3Id, user4Id],
      })

      const entries = profiles.map((p) => ({
        userId: p.userId,
        data: p.merged,
      }))

      const groups = splitByAttributes(entries, [
        "org:field_gender",
        "org:field_level",
      ])

      // Should have 4 cross-product groups: Female+Advanced, Female+Beginner, Male+Advanced, Male+Beginner
      expect(groups).toHaveLength(4)

      const groupNames = groups.map((g) => g.groupName).sort()
      expect(groupNames).toEqual([
        "Female + Advanced",
        "Female + Beginner",
        "Male + Advanced",
        "Male + Beginner",
      ])

      // Each group should have exactly 1 member
      for (const group of groups) {
        expect(group.memberIds).toHaveLength(1)
      }
    })
  })

  // ==========================================================================
  // Data snapshot freezing
  // ==========================================================================

  describe("data snapshots", () => {
    it("freezes member data at generation time", async () => {
      const config = await createConfig(organizationId, ownerId, {
        activityId,
        name: "Snapshot Groups",
      })

      const profiles = await buildMemberProfiles({
        organizationId,
        activityId,
        userIds: [user1Id],
      })

      const run = await db.transaction(async (tx) => {
        const createdRun = await createRunWithEntries(
          tx,
          {
            organizationId,
            smartGroupConfigId: config.id,
            scope: "activity",
            criteriaSnapshot: { fields: [] },
            entryCount: 1,
            groupCount: 1,
            generatedBy: ownerId,
          },
          profiles.map((p) => ({ userId: p.userId, dataSnapshot: p.merged }))
        )
        return createdRun
      })

      // Modify the profile data after snapshot was taken
      const { eq, and } = await import("drizzle-orm")
      await db
        .update(groupMemberProfile)
        .set({ answers: { field_gender: "NonBinary" } })
        .where(
          and(
            eq(groupMemberProfile.organizationId, organizationId),
            eq(groupMemberProfile.userId, user1Id)
          )
        )

      // The snapshot should still have the original data
      const details = await getRunDetails(run.id, organizationId)
      expect(details).not.toBeNull()
      const snapshot = details!.entries[0].dataSnapshot as Record<string, unknown>
      expect(snapshot["org:field_gender"]).toBe("Female")
    })
  })
})

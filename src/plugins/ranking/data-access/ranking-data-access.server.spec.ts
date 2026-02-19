import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { db } from "@/db"
import { activityMember, eventSession } from "@/db/schema"
import {
  createRankingDefinition,
  getRankingDefinitionByActivity,
  getRankingDefinitionById,
  updateDefinitionName,
} from "@/plugins/ranking/data-access/ranking-definitions"
import { correctMatch, listMatchesByDefinition, listMatchesBySession, recordMatch } from "@/plugins/ranking/data-access/match-records"
import {
  assignLevel,
  correctStatEntry,
  getLeaderboard,
  getMemberRank,
  getMemberRankWithLevel,
  getMemberRanksByUser,
  recordStats,
} from "@/plugins/ranking/data-access/member-ranks"
import { deleteLevel, getLevelsForDefinition, upsertLevels } from "@/plugins/ranking/data-access/ranking-levels"
import { matchRecord, memberRank, rankStatEntry } from "@/plugins/ranking/schema"
import {
  cleanupTestData,
  createTestActivity,
  createTestActivityMember,
  createTestOrganization,
  createTestUser,
} from "@/tests/server/db-fixtures"

describe("ranking data-access", () => {
  let organizationId = ""
  let otherOrganizationId = ""
  let ownerId = ""
  let ownerName = ""
  let alphaId = ""
  let betaId = ""
  let charlieId = ""
  let deltaId = ""
  let activityId = ""
  let secondaryActivityId = ""
  let otherOrgActivityId = ""

  const organizationIds: string[] = []
  const userIds: string[] = []

  const sleep = async (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })

  const createDefinition = async (input?: {
    activityId?: string
    domainId?: string
    name?: string
    levels?: {
      id?: string
      name: string
      color?: string | null
      order: number
    }[]
    organizationId?: string
  }) => {
    return createRankingDefinition(
      input?.organizationId ?? organizationId,
      ownerId,
      {
        activityId: input?.activityId ?? activityId,
        name: input?.name ?? "Skill Ladder",
        domainId: input?.domainId ?? "football",
        levels: input?.levels ?? [],
      }
    )
  }

  const createSession = async (
    sessionActivityId = activityId,
    title = "Ranking Session"
  ) => {
    const [session] = await db
      .insert(eventSession)
      .values({
        organizationId,
        activityId: sessionActivityId,
        title,
        dateTime: new Date(Date.now() + 60 * 60 * 1000),
        maxCapacity: 20,
        maxWaitlist: 0,
        joinMode: "open",
        status: "published",
        createdBy: ownerId,
      })
      .returning()

    return session
  }

  beforeEach(async () => {
    const organization = await createTestOrganization("ranking-owner")
    const otherOrganization = await createTestOrganization("ranking-other")

    const owner = await createTestUser("Ranking Owner")
    const alpha = await createTestUser("Alpha")
    const beta = await createTestUser("Beta")
    const charlie = await createTestUser("Charlie")
    const delta = await createTestUser("Delta")

    organizationId = organization.id
    otherOrganizationId = otherOrganization.id
    ownerId = owner.id
    ownerName = owner.name
    alphaId = alpha.id
    betaId = beta.id
    charlieId = charlie.id
    deltaId = delta.id

    organizationIds.push(organizationId, otherOrganizationId)
    userIds.push(ownerId, alphaId, betaId, charlieId, deltaId)

    const activity = await createTestActivity({
      organizationId,
      createdBy: ownerId,
      name: "Ranking Activity",
    })
    activityId = activity.id

    const secondaryActivity = await createTestActivity({
      organizationId,
      createdBy: ownerId,
      name: "Secondary Ranking Activity",
    })
    secondaryActivityId = secondaryActivity.id

    const otherOrgActivity = await createTestActivity({
      organizationId: otherOrganizationId,
      createdBy: ownerId,
      name: "Other Org Activity",
    })
    otherOrgActivityId = otherOrgActivity.id
  })

  afterEach(async () => {
    if (organizationIds.length > 0 || userIds.length > 0) {
      await cleanupTestData({
        organizationIds,
        userIds,
      })
    }

    organizationId = ""
    otherOrganizationId = ""
    ownerId = ""
    ownerName = ""
    alphaId = ""
    betaId = ""
    charlieId = ""
    deltaId = ""
    activityId = ""
    secondaryActivityId = ""
    otherOrgActivityId = ""
    organizationIds.length = 0
    userIds.length = 0
  })

  describe("ranking definitions", () => {
    it("creates a definition with levels and fetches levels ordered by rank order", async () => {
      const created = await createRankingDefinition(organizationId, ownerId, {
        activityId,
        name: "Football Ladder",
        domainId: "football",
        levels: [
          { name: "Gold", color: "#FFD700", order: 2 },
          { name: "Bronze", color: "#CD7F32", order: 0 },
          { name: "Silver", color: "#C0C0C0", order: 1 },
        ],
      })

      expect(created.name).toBe("Football Ladder")
      expect(created.levels).toHaveLength(3)

      const byActivity = await getRankingDefinitionByActivity(activityId, organizationId)
      expect(byActivity?.id).toBe(created.id)
      expect(byActivity?.levels.map((level) => level.name)).toEqual([
        "Bronze",
        "Silver",
        "Gold",
      ])

      const byId = await getRankingDefinitionById(created.id, organizationId)
      expect(byId?.name).toBe("Football Ladder")
      expect(byId?.activityId).toBe(activityId)
    })

    it("returns null when definition does not exist or belongs to another organization", async () => {
      const missingByActivity = await getRankingDefinitionByActivity(
        activityId,
        organizationId
      )
      expect(missingByActivity).toBeNull()

      const definition = await createDefinition()

      const wrongOrgByActivity = await getRankingDefinitionByActivity(
        activityId,
        otherOrganizationId
      )
      expect(wrongOrgByActivity).toBeNull()

      const wrongOrgById = await getRankingDefinitionById(
        definition.id,
        otherOrganizationId
      )
      expect(wrongOrgById).toBeNull()
    })

    it("prevents creating duplicate definitions for the same activity", async () => {
      await createDefinition()

      await expect(createDefinition()).rejects.toMatchObject({
        code: "CONFLICT",
      })
    })

    it("updates definition name and throws not found for wrong organization", async () => {
      const definition = await createDefinition({ name: "Before Rename" })

      const updated = await updateDefinitionName(
        definition.id,
        organizationId,
        "After Rename"
      )
      expect(updated.name).toBe("After Rename")

      await expect(
        updateDefinitionName(definition.id, otherOrganizationId, "No Access")
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
    })
  })

  describe("ranking levels", () => {
    it("returns levels ordered by order", async () => {
      const definition = await createDefinition({
        levels: [
          { name: "Level 3", order: 3 },
          { name: "Level 1", order: 1 },
          { name: "Level 2", order: 2 },
        ],
      })

      const levels = await getLevelsForDefinition(definition.id)

      expect(levels.map((level) => level.name)).toEqual([
        "Level 1",
        "Level 2",
        "Level 3",
      ])
    })

    it("upserts levels by updating existing, inserting new, and deleting removed unassigned levels", async () => {
      const definition = await createDefinition({
        levels: [
          { name: "Bronze", color: "#cd7f32", order: 0 },
          { name: "Silver", color: "#c0c0c0", order: 1 },
        ],
      })

      const [bronze, silver] = await getLevelsForDefinition(definition.id)

      const updated = await upsertLevels(definition.id, organizationId, [
        {
          id: silver.id,
          name: "Silver Elite",
          color: "#e5e7eb",
          order: 0,
        },
        {
          name: "Gold",
          color: "#ffd700",
          order: 1,
        },
      ])

      expect(updated).toHaveLength(2)
      expect(updated.map((level) => level.name)).toEqual(["Silver Elite", "Gold"])

      const persisted = await getLevelsForDefinition(definition.id)
      expect(persisted).toHaveLength(2)
      expect(persisted.find((level) => level.id === bronze.id)).toBeUndefined()
      expect(persisted.map((level) => level.name)).toEqual(["Silver Elite", "Gold"])
    })

    it("blocks deleting levels through upsert when members are still assigned", async () => {
      const definition = await createDefinition({
        levels: [
          { name: "Bronze", order: 0 },
          { name: "Silver", order: 1 },
        ],
      })

      const [bronze, silver] = await getLevelsForDefinition(definition.id)

      await assignLevel(definition.id, organizationId, alphaId, bronze.id)

      await expect(
        upsertLevels(definition.id, organizationId, [
          {
            id: silver.id,
            name: "Silver",
            order: 0,
          },
        ])
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      })

      const remaining = await getLevelsForDefinition(definition.id)
      expect(remaining).toHaveLength(2)
      expect(remaining.map((level) => level.name)).toEqual(["Bronze", "Silver"])
    })

    it("deletes an unassigned level", async () => {
      const definition = await createDefinition({
        levels: [{ name: "Only Level", order: 0 }],
      })

      const [onlyLevel] = await getLevelsForDefinition(definition.id)
      const deleted = await deleteLevel(definition.id, onlyLevel.id)

      expect(deleted.id).toBe(onlyLevel.id)
      expect(await getLevelsForDefinition(definition.id)).toHaveLength(0)
    })

    it("rejects deleting an assigned level and rejects missing level", async () => {
      const assignedDefinition = await createDefinition({
        levels: [{ name: "Assigned Level", order: 0 }],
      })
      const [assignedLevel] = await getLevelsForDefinition(assignedDefinition.id)

      await assignLevel(assignedDefinition.id, organizationId, alphaId, assignedLevel.id)

      await expect(
        deleteLevel(assignedDefinition.id, assignedLevel.id)
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      })

      const missingDefinition = await createDefinition({
        activityId: secondaryActivityId,
        levels: [{ name: "Another Level", order: 0 }],
      })

      await expect(
        deleteLevel(missingDefinition.id, "missing-level-id")
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
    })
  })

  describe("member ranks", () => {
    it("assignLevel creates a member rank, updates it, and supports unassigning level", async () => {
      const definition = await createDefinition({
        levels: [
          { name: "Bronze", order: 0 },
          { name: "Silver", order: 1 },
        ],
      })
      const [bronze, silver] = await getLevelsForDefinition(definition.id)

      const created = await assignLevel(
        definition.id,
        organizationId,
        alphaId,
        bronze.id
      )
      expect(created.currentLevelId).toBe(bronze.id)

      const updated = await assignLevel(
        definition.id,
        organizationId,
        alphaId,
        silver.id
      )
      expect(updated.id).toBe(created.id)
      expect(updated.currentLevelId).toBe(silver.id)

      const unassigned = await assignLevel(
        definition.id,
        organizationId,
        alphaId,
        null
      )
      expect(unassigned.id).toBe(created.id)
      expect(unassigned.currentLevelId).toBeNull()

      const rows = await db
        .select()
        .from(memberRank)
        .where(
          and(
            eq(memberRank.rankingDefinitionId, definition.id),
            eq(memberRank.userId, alphaId)
          )
        )
      expect(rows).toHaveLength(1)
    })

    it("gets member rank values with and without joined level metadata", async () => {
      const definition = await createDefinition({
        levels: [{ name: "Gold", color: "#ffd700", order: 0 }],
      })
      const [gold] = await getLevelsForDefinition(definition.id)

      const missing = await getMemberRank(definition.id, alphaId)
      expect(missing).toBeNull()

      await assignLevel(definition.id, organizationId, alphaId, gold.id)

      const plain = await getMemberRank(definition.id, alphaId)
      expect(plain?.userId).toBe(alphaId)
      expect(plain?.currentLevelId).toBe(gold.id)

      const withLevel = await getMemberRankWithLevel(definition.id, alphaId)
      expect(withLevel?.levelName).toBe("Gold")
      expect(withLevel?.levelColor).toBe("#ffd700")
      expect(withLevel?.levelOrder).toBe(0)
    })

    it("gets user ranks for one organization only with definition metadata", async () => {
      const firstDefinition = await createDefinition({
        activityId,
        name: "Primary Ladder",
      })
      const secondDefinition = await createDefinition({
        activityId: secondaryActivityId,
        name: "Secondary Ladder",
      })
      const externalDefinition = await createDefinition({
        organizationId: otherOrganizationId,
        activityId: otherOrgActivityId,
        name: "External Ladder",
      })

      await assignLevel(firstDefinition.id, organizationId, alphaId, null)
      await assignLevel(secondDefinition.id, organizationId, alphaId, null)
      await assignLevel(externalDefinition.id, otherOrganizationId, alphaId, null)

      const scoped = await getMemberRanksByUser(alphaId, organizationId)

      expect(scoped).toHaveLength(2)
      expect(scoped.map((rank) => rank.rankingDefinitionId).sort()).toEqual(
        [firstDefinition.id, secondDefinition.id].sort()
      )
      expect(scoped.map((rank) => rank.definitionName).sort()).toEqual([
        "Primary Ladder",
        "Secondary Ladder",
      ])
    })

    it("records stats as audit entries and aggregates cumulative member stats", async () => {
      const definition = await createDefinition()

      const first = await recordStats(
        organizationId,
        definition.id,
        alphaId,
        ownerId,
        {
          stats: { wins: 2, losses: 1 },
          notes: "Initial record",
        }
      )

      expect(first.entry.stats).toEqual({ wins: 2, losses: 1 })
      expect(first.memberRank.stats).toEqual({ wins: 2, losses: 1 })
      expect(first.memberRank.lastActivityAt).toBeTruthy()

      const second = await recordStats(
        organizationId,
        definition.id,
        alphaId,
        ownerId,
        {
          stats: { wins: 1, games_won: 3 },
        }
      )

      expect(second.memberRank.stats).toEqual({
        wins: 3,
        losses: 1,
        games_won: 3,
      })

      const entries = await db
        .select()
        .from(rankStatEntry)
        .where(
          and(
            eq(rankStatEntry.rankingDefinitionId, definition.id),
            eq(rankStatEntry.userId, alphaId)
          )
        )
      expect(entries).toHaveLength(2)
    })

    it("corrects a stat entry by reversing original stats and applying corrected stats", async () => {
      const definition = await createDefinition()

      const first = await recordStats(
        organizationId,
        definition.id,
        alphaId,
        ownerId,
        {
          stats: { wins: 2, losses: 1 },
        }
      )

      await recordStats(organizationId, definition.id, alphaId, ownerId, {
        stats: { wins: 1 },
      })

      const correction = await correctStatEntry(
        organizationId,
        definition.id,
        first.entry.id,
        ownerId,
        {
          correctedStats: { wins: 0, losses: 2 },
          notes: "Correction",
        }
      )

      expect(correction.memberRank.stats).toEqual({ wins: 1, losses: 2 })
      expect(correction.entry.id).not.toBe(first.entry.id)

      const oldEntry = await db
        .select()
        .from(rankStatEntry)
        .where(eq(rankStatEntry.id, first.entry.id))
        .limit(1)
      expect(oldEntry).toHaveLength(0)

      const entriesAfterCorrection = await db
        .select()
        .from(rankStatEntry)
        .where(
          and(
            eq(rankStatEntry.rankingDefinitionId, definition.id),
            eq(rankStatEntry.userId, alphaId)
          )
        )
      expect(entriesAfterCorrection).toHaveLength(2)
    })

    it("throws when correcting a missing stat entry or when member rank is missing", async () => {
      const definition = await createDefinition()

      await expect(
        correctStatEntry(
          organizationId,
          definition.id,
          "missing-entry",
          ownerId,
          { correctedStats: { wins: 1 } }
        )
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      })

      const [orphanEntry] = await db
        .insert(rankStatEntry)
        .values({
          organizationId,
          rankingDefinitionId: definition.id,
          userId: betaId,
          stats: { wins: 1 },
          recordedBy: ownerId,
          notes: null,
        })
        .returning()

      await expect(
        correctStatEntry(
          organizationId,
          definition.id,
          orphanEntry.id,
          ownerId,
          { correctedStats: { wins: 2 } }
        )
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
    })

    it("builds leaderboard with active-member filtering and deterministic sorting", async () => {
      const definition = await createDefinition({
        levels: [
          { name: "Bronze", order: 0 },
          { name: "Gold", order: 1 },
        ],
      })
      const [bronze, gold] = await getLevelsForDefinition(definition.id)

      await createTestActivityMember({ activityId, userId: alphaId, status: "active" })
      await createTestActivityMember({ activityId, userId: betaId, status: "active" })
      await createTestActivityMember({ activityId, userId: charlieId, status: "active" })
      await db.insert(activityMember).values({
        activityId,
        userId: deltaId,
        status: "rejected",
      })

      await assignLevel(definition.id, organizationId, alphaId, bronze.id)
      await assignLevel(definition.id, organizationId, betaId, bronze.id)
      await assignLevel(definition.id, organizationId, charlieId, gold.id)

      await recordStats(organizationId, definition.id, alphaId, ownerId, {
        stats: { wins: 1 },
      })
      await recordStats(organizationId, definition.id, betaId, ownerId, {
        stats: { wins: 3 },
      })
      await recordStats(organizationId, definition.id, charlieId, ownerId, {
        stats: { wins: 0 },
      })
      await recordStats(organizationId, definition.id, deltaId, ownerId, {
        stats: { wins: 10 },
      })

      const activeOnly = await getLeaderboard(definition.id, false)
      expect(activeOnly.map((row) => row.userId)).toEqual([
        betaId,
        alphaId,
        charlieId,
      ])

      const includingFormer = await getLeaderboard(definition.id, true)
      expect(includingFormer.map((row) => row.userId)).toEqual([
        betaId,
        alphaId,
        charlieId,
        deltaId,
      ])
    })

    it("throws not found when leaderboard definition is missing", async () => {
      await expect(getLeaderboard("missing-definition", false)).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
    })

    it("uses domain tie-break rules for non-wins stat models (padel match_wins/set diff)", async () => {
      const definition = await createDefinition({
        domainId: "padel",
        levels: [{ name: "Open", order: 0 }],
      })

      await createTestActivityMember({ activityId, userId: alphaId, status: "active" })
      await createTestActivityMember({ activityId, userId: betaId, status: "active" })
      await createTestActivityMember({ activityId, userId: charlieId, status: "active" })

      // Same level for everyone; order should follow domain tie-break:
      // 1) match_wins desc
      // 2) (set_wins - set_losses) desc
      await recordStats(organizationId, definition.id, alphaId, ownerId, {
        stats: { match_wins: 2, set_wins: 8, set_losses: 4 }, // diff: 4
      })
      await recordStats(organizationId, definition.id, betaId, ownerId, {
        stats: { match_wins: 2, set_wins: 7, set_losses: 4 }, // diff: 3
      })
      await recordStats(organizationId, definition.id, charlieId, ownerId, {
        stats: { match_wins: 1, set_wins: 9, set_losses: 1 }, // lower primary tie-break
      })

      const leaderboard = await getLeaderboard(definition.id, false)
      expect(leaderboard.map((row) => row.userId)).toEqual([alphaId, betaId, charlieId])
    })
  })

  describe("match records", () => {
    it("rejects recording a match for domains without match support", async () => {
      const definition = await createDefinition({ domainId: "reading" })

      await expect(
        recordMatch({
          organizationId,
          rankingDefinitionId: definition.id,
          domainId: "reading",
          sessionId: "unused-session",
          matchFormat: "singles",
          team1: [alphaId],
          team2: [betaId],
          scores: { team1: 2, team2: 1 },
          recordedBy: ownerId,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      })
    })

    it("rejects invalid match scores", async () => {
      const definition = await createDefinition({ domainId: "football" })
      const session = await createSession()

      await expect(
        recordMatch({
          organizationId,
          rankingDefinitionId: definition.id,
          domainId: "football",
          sessionId: session.id,
          matchFormat: "5v5",
          team1: [alphaId],
          team2: [betaId],
          scores: { team1: -1, team2: 0 },
          recordedBy: ownerId,
        })
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      })
    })

    it("records a match and aggregates derived stats into member ranks", async () => {
      const definition = await createDefinition({ domainId: "football" })
      const session = await createSession()

      const first = await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 2, team2: 1 },
        recordedBy: ownerId,
        notes: "First match",
      })

      expect(first.match.winner).toBe("team1")
      expect(first.updatedRanks).toHaveLength(2)

      await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 0, team2: 1 },
        recordedBy: ownerId,
      })

      const alphaRank = await getMemberRank(definition.id, alphaId)
      const betaRank = await getMemberRank(definition.id, betaId)

      expect(alphaRank?.stats).toEqual({
        matches_played: 2,
        wins: 1,
        draws: 0,
        losses: 1,
        goals_scored: 2,
        goals_conceded: 2,
      })
      expect(betaRank?.stats).toEqual({
        matches_played: 2,
        wins: 1,
        draws: 0,
        losses: 1,
        goals_scored: 2,
        goals_conceded: 2,
      })
    })

    it("corrects a match by reversing old stats, inserting a new match, and applying corrected stats", async () => {
      const definition = await createDefinition({ domainId: "football" })
      const session = await createSession()

      const original = await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 3, team2: 1 },
        recordedBy: ownerId,
      })

      const corrected = await correctMatch({
        matchId: original.match.id,
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 0, team2: 2 },
        recordedBy: ownerId,
      })

      expect(corrected.match.id).not.toBe(original.match.id)
      expect(corrected.match.winner).toBe("team2")
      expect(corrected.updatedRanks).toHaveLength(2)

      const [oldMatch] = await db
        .select()
        .from(matchRecord)
        .where(eq(matchRecord.id, original.match.id))
        .limit(1)
      expect(oldMatch).toBeUndefined()

      const alphaRank = await getMemberRank(definition.id, alphaId)
      const betaRank = await getMemberRank(definition.id, betaId)

      expect(alphaRank?.stats).toEqual({
        matches_played: 1,
        wins: 0,
        draws: 0,
        losses: 1,
        goals_scored: 0,
        goals_conceded: 2,
      })
      expect(betaRank?.stats).toEqual({
        matches_played: 1,
        wins: 1,
        draws: 0,
        losses: 0,
        goals_scored: 2,
        goals_conceded: 0,
      })
    })

    it("throws not found when correcting a missing match", async () => {
      const definition = await createDefinition({ domainId: "football" })
      const session = await createSession()

      await expect(
        correctMatch({
          matchId: "missing-match",
          organizationId,
          rankingDefinitionId: definition.id,
          domainId: "football",
          sessionId: session.id,
          matchFormat: "5v5",
          team1: [alphaId],
          team2: [betaId],
          scores: { team1: 1, team2: 0 },
          recordedBy: ownerId,
        })
      ).rejects.toMatchObject({
        code: "NOT_FOUND",
      })
    })

    it("lists matches by session in descending creation order with recorder names", async () => {
      const definition = await createDefinition({ domainId: "football" })
      const session = await createSession()

      const first = await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 1, team2: 0 },
        recordedBy: ownerId,
      })

      await sleep(5)

      const second = await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [charlieId],
        team2: [deltaId],
        scores: { team1: 0, team2: 2 },
        recordedBy: ownerId,
      })

      const matches = await listMatchesBySession(definition.id, session.id)

      expect(matches).toHaveLength(2)
      expect(matches[0]?.id).toBe(second.match.id)
      expect(matches[1]?.id).toBe(first.match.id)
      expect(matches[0]?.recordedByName).toBe(ownerName)
    })

    it("lists matches by definition with pagination", async () => {
      const definition = await createDefinition({ domainId: "football" })
      const session = await createSession()

      const first = await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 1, team2: 0 },
        recordedBy: ownerId,
      })

      await sleep(5)

      const second = await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 2, team2: 1 },
        recordedBy: ownerId,
      })

      await sleep(5)

      const third = await recordMatch({
        organizationId,
        rankingDefinitionId: definition.id,
        domainId: "football",
        sessionId: session.id,
        matchFormat: "5v5",
        team1: [alphaId],
        team2: [betaId],
        scores: { team1: 0, team2: 3 },
        recordedBy: ownerId,
      })

      const firstPage = await listMatchesByDefinition(definition.id, {
        limit: 2,
        offset: 0,
      })
      expect(firstPage).toHaveLength(2)
      expect(firstPage[0]?.id).toBe(third.match.id)
      expect(firstPage[1]?.id).toBe(second.match.id)

      const secondPage = await listMatchesByDefinition(definition.id, {
        limit: 2,
        offset: 2,
      })
      expect(secondPage).toHaveLength(1)
      expect(secondPage[0]?.id).toBe(first.match.id)
    })
  })
})

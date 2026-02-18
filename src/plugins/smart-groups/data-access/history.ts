import { eq, and, inArray, sql, desc } from "drizzle-orm"
import { db } from "@/db"
import type { Database } from "@/db"
import {
  smartGroupHistory,
  smartGroupRun,
  smartGroupConfig,
} from "@/plugins/smart-groups/schema"
import type { SmartGroupProposal } from "@/db/types"

const CHUNK_SIZE = 500
const LOOKBACK_RUNS = 10

// =============================================================================
// Pair Generation (pure helper)
// =============================================================================

/**
 * Generate all unique pairs from a list of member IDs.
 * Pairs are canonical: user1Id < user2Id (string comparison).
 */
export function generatePairs(memberIds: string[]): [string, string][] {
  const sorted = [...memberIds].sort()
  const pairs: [string, string][] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push([sorted[i], sorted[j]])
    }
  }
  return pairs
}

// =============================================================================
// Record History from Proposals
// =============================================================================

export async function recordHistoryFromProposals(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  params: {
    organizationId: string
    activityId: string
    smartGroupRunId: string
    proposals: SmartGroupProposal[]
  }
): Promise<void> {
  const { organizationId, activityId, smartGroupRunId, proposals } = params
  const allRows: Array<{
    organizationId: string
    activityId: string
    smartGroupRunId: string
    user1Id: string
    user2Id: string
  }> = []

  for (const proposal of proposals) {
    const effectiveIds = (proposal.modifiedMemberIds ?? proposal.memberIds) as string[]
    const pairs = generatePairs(effectiveIds)
    for (const [user1Id, user2Id] of pairs) {
      allRows.push({
        organizationId,
        activityId,
        smartGroupRunId,
        user1Id,
        user2Id,
      })
    }
  }

  // Bulk insert in chunks
  for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
    await tx.insert(smartGroupHistory).values(allRows.slice(i, i + CHUNK_SIZE))
  }
}

// =============================================================================
// Get Co-occurrence Counts
// =============================================================================

/**
 * Query the last N confirmed runs for an activity and count how many times
 * each pair of users was co-grouped. Returns a Map keyed by "user1:user2"
 * (canonical order).
 */
export async function getCooccurrenceCounts(
  activityId: string,
  userIds: string[]
): Promise<Map<string, number>> {
  if (userIds.length < 2) return new Map()

  // Find last N confirmed run IDs for this activity
  const recentRuns = await db
    .select({ id: smartGroupRun.id })
    .from(smartGroupRun)
    .innerJoin(
      smartGroupConfig,
      eq(smartGroupRun.smartGroupConfigId, smartGroupConfig.id)
    )
    .where(
      and(
        eq(smartGroupConfig.activityId, activityId),
        eq(smartGroupRun.status, "confirmed")
      )
    )
    .orderBy(desc(smartGroupRun.confirmedAt))
    .limit(LOOKBACK_RUNS)

  if (recentRuns.length === 0) return new Map()

  const runIds = recentRuns.map((r) => r.id)

  // Query history for these runs where both users are in our set
  const rows = await db
    .select({
      user1Id: smartGroupHistory.user1Id,
      user2Id: smartGroupHistory.user2Id,
      count: sql<number>`count(*)::int`,
    })
    .from(smartGroupHistory)
    .where(
      and(
        inArray(smartGroupHistory.smartGroupRunId, runIds),
        inArray(smartGroupHistory.user1Id, userIds),
        inArray(smartGroupHistory.user2Id, userIds)
      )
    )
    .groupBy(smartGroupHistory.user1Id, smartGroupHistory.user2Id)

  const result = new Map<string, number>()
  for (const row of rows) {
    result.set(`${row.user1Id}:${row.user2Id}`, row.count)
  }

  return result
}

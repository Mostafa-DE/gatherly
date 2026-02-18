import { eq, and, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  smartGroupRun,
  smartGroupEntry,
  smartGroupProposal,
  smartGroupConfig,
} from "@/plugins/smart-groups/schema"
import { recordHistoryFromProposals } from "./history"
import type { SmartGroupRun, SmartGroupEntry, SmartGroupProposal } from "@/db/types"
import { ConflictError, NotFoundError, ValidationError } from "@/exceptions"
import type { Database } from "@/db"

const CHUNK_SIZE = 500

// =============================================================================
// Queries
// =============================================================================

export async function getLatestRunBySession(
  sessionId: string,
  organizationId: string
): Promise<(SmartGroupRun & { proposals: SmartGroupProposal[] }) | null> {
  const [run] = await db
    .select()
    .from(smartGroupRun)
    .where(
      and(
        eq(smartGroupRun.sessionId, sessionId),
        eq(smartGroupRun.organizationId, organizationId)
      )
    )
    .orderBy(desc(smartGroupRun.createdAt))
    .limit(1)

  if (!run) return null

  const proposals = await db
    .select()
    .from(smartGroupProposal)
    .where(eq(smartGroupProposal.smartGroupRunId, run.id))
    .orderBy(smartGroupProposal.groupIndex)

  return { ...run, proposals }
}

export async function getLatestRunByConfig(
  configId: string,
  organizationId: string,
  scope: "activity"
): Promise<(SmartGroupRun & { proposals: SmartGroupProposal[] }) | null> {
  const [run] = await db
    .select()
    .from(smartGroupRun)
    .where(
      and(
        eq(smartGroupRun.smartGroupConfigId, configId),
        eq(smartGroupRun.organizationId, organizationId),
        eq(smartGroupRun.scope, scope),
        sql`${smartGroupRun.sessionId} IS NULL`
      )
    )
    .orderBy(desc(smartGroupRun.createdAt))
    .limit(1)

  if (!run) return null

  const proposals = await db
    .select()
    .from(smartGroupProposal)
    .where(eq(smartGroupProposal.smartGroupRunId, run.id))
    .orderBy(smartGroupProposal.groupIndex)

  return { ...run, proposals }
}

export async function getRunsByActivity(
  configId: string,
  organizationId: string,
  limit: number,
  offset: number
): Promise<SmartGroupRun[]> {
  return db
    .select()
    .from(smartGroupRun)
    .where(
      and(
        eq(smartGroupRun.smartGroupConfigId, configId),
        eq(smartGroupRun.organizationId, organizationId)
      )
    )
    .orderBy(desc(smartGroupRun.createdAt))
    .limit(limit)
    .offset(offset)
}

export async function getRunDetails(
  runId: string,
  organizationId: string
): Promise<{
  run: SmartGroupRun
  entries: SmartGroupEntry[]
  proposals: SmartGroupProposal[]
} | null> {
  const [run] = await db
    .select()
    .from(smartGroupRun)
    .where(
      and(
        eq(smartGroupRun.id, runId),
        eq(smartGroupRun.organizationId, organizationId)
      )
    )
    .limit(1)

  if (!run) return null

  const [entries, proposals] = await Promise.all([
    db
      .select()
      .from(smartGroupEntry)
      .where(eq(smartGroupEntry.smartGroupRunId, runId)),
    db
      .select()
      .from(smartGroupProposal)
      .where(eq(smartGroupProposal.smartGroupRunId, runId))
      .orderBy(smartGroupProposal.groupIndex),
  ])

  return { run, entries, proposals }
}

// =============================================================================
// Create Run with Entries (transactional)
// =============================================================================

export async function createRunWithEntries(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  runData: {
    organizationId: string
    smartGroupConfigId: string
    sessionId?: string
    scope: "session" | "activity"
    criteriaSnapshot: unknown
    entryCount: number
    groupCount: number
    excludedCount?: number
    generatedBy: string
  },
  entries: Array<{
    userId: string
    dataSnapshot: unknown
  }>
): Promise<SmartGroupRun> {
  const [run] = await tx
    .insert(smartGroupRun)
    .values({
      organizationId: runData.organizationId,
      smartGroupConfigId: runData.smartGroupConfigId,
      sessionId: runData.sessionId ?? null,
      scope: runData.scope,
      criteriaSnapshot: runData.criteriaSnapshot,
      entryCount: runData.entryCount,
      groupCount: runData.groupCount,
      excludedCount: runData.excludedCount ?? 0,
      generatedBy: runData.generatedBy,
    })
    .returning()

  // Chunk inserts for large member sets
  if (entries.length > 0) {
    const entryRows = entries.map((e) => ({
      smartGroupRunId: run.id,
      userId: e.userId,
      dataSnapshot: e.dataSnapshot,
    }))

    for (let i = 0; i < entryRows.length; i += CHUNK_SIZE) {
      await tx.insert(smartGroupEntry).values(entryRows.slice(i, i + CHUNK_SIZE))
    }
  }

  return run
}

// =============================================================================
// Confirm Run (concurrency-safe)
// =============================================================================

export async function confirmRun(
  runId: string,
  organizationId: string,
  confirmedBy: string,
  expectedVersion: number
): Promise<SmartGroupRun> {
  return db.transaction(async (tx) => {
    // Fetch run with config (to get activityId for history)
    const [runWithConfig] = await tx
      .select({
        run: smartGroupRun,
        activityId: smartGroupConfig.activityId,
      })
      .from(smartGroupRun)
      .innerJoin(smartGroupConfig, eq(smartGroupRun.smartGroupConfigId, smartGroupConfig.id))
      .where(
        and(
          eq(smartGroupRun.id, runId),
          eq(smartGroupRun.organizationId, organizationId)
        )
      )
      .limit(1)

    if (!runWithConfig) {
      throw new NotFoundError("Run not found")
    }

    const run = runWithConfig.run
    const { activityId } = runWithConfig

    if (run.status !== "generated") {
      throw new ConflictError("Run is already confirmed")
    }

    // Fetch all proposals
    const proposals = await tx
      .select()
      .from(smartGroupProposal)
      .where(eq(smartGroupProposal.smartGroupRunId, runId))

    // Member-uniqueness check: each user must appear in exactly one proposal
    const allEntries = await tx
      .select({ userId: smartGroupEntry.userId })
      .from(smartGroupEntry)
      .where(eq(smartGroupEntry.smartGroupRunId, runId))

    const entryUserIds = new Set(allEntries.map((e) => e.userId))
    const seenInProposals = new Map<string, number>()

    for (const proposal of proposals) {
      const effectiveIds = (proposal.modifiedMemberIds ?? proposal.memberIds) as string[]
      for (const id of effectiveIds) {
        seenInProposals.set(id, (seenInProposals.get(id) ?? 0) + 1)
      }
    }

    // Check for duplicate members across groups
    for (const [userId, count] of seenInProposals) {
      if (count > 1) {
        throw new ValidationError(
          `Member ${userId} appears in ${count} groups — each member must be in exactly one group`
        )
      }
    }

    // Check for members not in any group
    for (const userId of entryUserIds) {
      if (!seenInProposals.has(userId)) {
        throw new ValidationError(
          `Member ${userId} is not assigned to any group`
        )
      }
    }

    // Optimistic lock: update status
    const [confirmed] = await tx
      .update(smartGroupRun)
      .set({
        status: "confirmed",
        confirmedBy,
        confirmedAt: new Date(),
        version: sql`${smartGroupRun.version} + 1`,
      })
      .where(
        and(
          eq(smartGroupRun.id, runId),
          eq(smartGroupRun.version, expectedVersion),
          eq(smartGroupRun.status, "generated")
        )
      )
      .returning()

    if (!confirmed) {
      throw new ConflictError("Run was already confirmed or modified by another user")
    }

    // Mark all proposals as accepted/modified
    for (const proposal of proposals) {
      const newStatus = proposal.modifiedMemberIds ? "modified" : "accepted"
      await tx
        .update(smartGroupProposal)
        .set({ status: newStatus })
        .where(eq(smartGroupProposal.id, proposal.id))
    }

    // Record pairwise history for variety tracking
    await recordHistoryFromProposals(tx, {
      organizationId,
      activityId,
      smartGroupRunId: runId,
      proposals,
    })

    return confirmed
  })
}

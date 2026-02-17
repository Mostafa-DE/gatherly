import { eq, and, sql } from "drizzle-orm"
import { db } from "@/db"
import {
  smartGroupProposal,
  smartGroupRun,
  smartGroupConfig,
} from "@/plugins/smart-groups/schema"
import type { SmartGroupProposal } from "@/db/types"
import { ConflictError, NotFoundError } from "@/exceptions"
import type { Database } from "@/db"

const CHUNK_SIZE = 500

export async function createProposals(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  runId: string,
  proposals: Array<{
    groupIndex: number
    groupName: string
    memberIds: string[]
  }>
): Promise<void> {
  if (proposals.length === 0) return

  const rows = proposals.map((p) => ({
    smartGroupRunId: runId,
    groupIndex: p.groupIndex,
    groupName: p.groupName,
    memberIds: p.memberIds,
  }))

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await tx.insert(smartGroupProposal).values(rows.slice(i, i + CHUNK_SIZE))
  }
}

export async function getProposalsByRun(
  runId: string
): Promise<SmartGroupProposal[]> {
  return db
    .select()
    .from(smartGroupProposal)
    .where(eq(smartGroupProposal.smartGroupRunId, runId))
    .orderBy(smartGroupProposal.groupIndex)
}

export async function updateProposalMembers(
  proposalId: string,
  organizationId: string,
  modifiedMemberIds: string[],
  expectedVersion: number
): Promise<SmartGroupProposal> {
  // Verify proposal belongs to org through run → config chain
  const proposalRows = await db
    .select({
      proposal: smartGroupProposal,
      orgId: smartGroupConfig.organizationId,
      runStatus: smartGroupRun.status,
    })
    .from(smartGroupProposal)
    .innerJoin(smartGroupRun, eq(smartGroupProposal.smartGroupRunId, smartGroupRun.id))
    .innerJoin(smartGroupConfig, eq(smartGroupRun.smartGroupConfigId, smartGroupConfig.id))
    .where(eq(smartGroupProposal.id, proposalId))
    .limit(1)

  if (proposalRows.length === 0) {
    throw new NotFoundError("Proposal not found")
  }

  const row = proposalRows[0]
  if (row.orgId !== organizationId) {
    throw new NotFoundError("Proposal not found")
  }

  if (row.runStatus !== "generated") {
    throw new ConflictError("Cannot modify proposals for a confirmed run")
  }

  // Optimistic lock update
  const [updated] = await db
    .update(smartGroupProposal)
    .set({
      modifiedMemberIds,
      status: "modified",
      version: sql`${smartGroupProposal.version} + 1`,
    })
    .where(
      and(
        eq(smartGroupProposal.id, proposalId),
        eq(smartGroupProposal.version, expectedVersion)
      )
    )
    .returning()

  if (!updated) {
    throw new ConflictError("Proposal was modified by another user")
  }

  return updated
}

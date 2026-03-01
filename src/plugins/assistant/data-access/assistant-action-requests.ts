import { and, eq, desc, inArray } from "drizzle-orm"
import { db } from "@/db"
import { activity, eventSession, groupMemberProfile } from "@/db/schema"
import { assistantActionRequest } from "@/plugins/assistant/schema"
import { user } from "@/db/auth-schema"
import { BadRequestError } from "@/exceptions"

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_approval: ["approved", "rejected"],
  approved: ["executed", "failed"],
}

function assertValidTransition(currentStatus: string, newStatus: string) {
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed || !allowed.includes(newStatus)) {
    throw new BadRequestError(
      `Invalid status transition: ${currentStatus} → ${newStatus}`
    )
  }
}

type ActionRequestRow = {
  request: typeof assistantActionRequest.$inferSelect
  requestedByName: string
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

async function enrichActionRequests(
  organizationId: string,
  rows: ActionRequestRow[]
) {
  if (rows.length === 0) return []

  const userIds = new Set<string>()
  const sessionIds = new Set<string>()
  const activityIds = new Set<string>()

  function collectPayload(actionType: string, payload: unknown) {
    if (!isObjectRecord(payload)) return

    if (typeof payload.sessionId === "string") {
      sessionIds.add(payload.sessionId)
    }
    if (typeof payload.activityId === "string") {
      activityIds.add(payload.activityId)
    }

    if (actionType === "mark_attendance") {
      const updates = Array.isArray(payload.updates) ? payload.updates : []
      for (const update of updates) {
        if (!isObjectRecord(update) || typeof update.userId !== "string") continue
        userIds.add(update.userId)
      }
      return
    }

    if (actionType === "mark_payment") {
      const updates = Array.isArray(payload.updates) ? payload.updates : []
      for (const update of updates) {
        if (!isObjectRecord(update) || typeof update.userId !== "string") continue
        userIds.add(update.userId)
      }
      return
    }

    if (actionType === "add_note") {
      if (typeof payload.userId === "string") {
        userIds.add(payload.userId)
      }
      return
    }

    if (actionType === "add_participant" || actionType === "remove_participant") {
      if (typeof payload.userId === "string") {
        userIds.add(payload.userId)
      }
      return
    }

    if (actionType === "record_match_result") {
      for (const userId of asStringArray(payload.team1)) userIds.add(userId)
      for (const userId of asStringArray(payload.team2)) userIds.add(userId)
    }
  }

  for (const row of rows) {
    collectPayload(row.request.action, row.request.requestedPayload)
    collectPayload(row.request.action, row.request.resolvedPayload)
  }

  const userIdList = [...userIds]
  const sessionIdList = [...sessionIds]
  const activityIdList = [...activityIds]

  const userRows =
    userIdList.length > 0
      ? await db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(inArray(user.id, userIdList))
      : []

  const nicknameRows =
    userIdList.length > 0
      ? await db
          .select({
            userId: groupMemberProfile.userId,
            nickname: groupMemberProfile.nickname,
          })
          .from(groupMemberProfile)
          .where(
            and(
              eq(groupMemberProfile.organizationId, organizationId),
              inArray(groupMemberProfile.userId, userIdList)
            )
          )
      : []

  const sessionRows =
    sessionIdList.length > 0
      ? await db
          .select({
            id: eventSession.id,
            title: eventSession.title,
            dateTime: eventSession.dateTime,
            activityId: eventSession.activityId,
          })
          .from(eventSession)
          .where(
            and(
              eq(eventSession.organizationId, organizationId),
              inArray(eventSession.id, sessionIdList)
            )
          )
      : []

  const activityRows =
    activityIdList.length > 0
      ? await db
          .select({
            id: activity.id,
            name: activity.name,
          })
          .from(activity)
          .where(
            and(
              eq(activity.organizationId, organizationId),
              inArray(activity.id, activityIdList)
            )
          )
      : []

  const nameByUserId = new Map(userRows.map((u) => [u.id, u.name]))
  const nicknameByUserId = new Map(nicknameRows.map((n) => [n.userId, n.nickname]))
  const sessionById = new Map(sessionRows.map((s) => [s.id, s]))
  const activityNameById = new Map(activityRows.map((a) => [a.id, a.name]))

  const toMemberSummary = (userId: string) => {
    const userName = nameByUserId.get(userId) ?? null
    const nickname = nicknameByUserId.get(userId) ?? null
    const displayName = nickname ?? userName ?? userId

    return {
      userId,
      userName,
      nickname,
      displayName,
    }
  }

  function enrichPayload(actionType: string, payload: unknown): unknown {
    if (!isObjectRecord(payload)) return payload

    if (actionType === "mark_attendance") {
      const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
      const session = sessionId ? sessionById.get(sessionId) : null
      const updates = Array.isArray(payload.updates)
        ? payload.updates.map((update) => {
            if (!isObjectRecord(update) || typeof update.userId !== "string") return update
            return {
              ...update,
              ...toMemberSummary(update.userId),
            }
          })
        : payload.updates

      return {
        ...payload,
        updates,
        sessionTitle: session?.title ?? null,
        sessionDateTime: session?.dateTime.toISOString() ?? null,
      }
    }

    if (actionType === "mark_payment") {
      const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
      const session = sessionId ? sessionById.get(sessionId) : null
      const updates = Array.isArray(payload.updates)
        ? payload.updates.map((update) => {
            if (!isObjectRecord(update) || typeof update.userId !== "string") return update
            return {
              ...update,
              ...toMemberSummary(update.userId),
            }
          })
        : payload.updates

      return {
        ...payload,
        updates,
        sessionTitle: session?.title ?? null,
        sessionDateTime: session?.dateTime.toISOString() ?? null,
      }
    }

    if (actionType === "add_note") {
      const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
      const session = sessionId ? sessionById.get(sessionId) : null
      const userId = typeof payload.userId === "string" ? payload.userId : null
      const memberSummary = userId ? toMemberSummary(userId) : {}

      return {
        ...payload,
        ...memberSummary,
        sessionTitle: session?.title ?? null,
        sessionDateTime: session?.dateTime.toISOString() ?? null,
      }
    }

    if (actionType === "add_participant" || actionType === "remove_participant") {
      const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
      const session = sessionId ? sessionById.get(sessionId) : null
      const userId = typeof payload.userId === "string" ? payload.userId : null
      const memberSummary = userId ? toMemberSummary(userId) : {}

      return {
        ...payload,
        ...memberSummary,
        sessionTitle: session?.title ?? null,
        sessionDateTime: session?.dateTime.toISOString() ?? null,
      }
    }

    if (actionType === "record_match_result") {
      const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : null
      const session = sessionId ? sessionById.get(sessionId) : null
      const activityId =
        typeof payload.activityId === "string" ? payload.activityId : session?.activityId ?? null
      const team1 = asStringArray(payload.team1)
      const team2 = asStringArray(payload.team2)

      return {
        ...payload,
        activityName: activityId ? activityNameById.get(activityId) ?? null : null,
        sessionTitle: session?.title ?? null,
        sessionDateTime: session?.dateTime.toISOString() ?? null,
        team1Members: team1.map((userId) => toMemberSummary(userId)),
        team2Members: team2.map((userId) => toMemberSummary(userId)),
      }
    }

    return payload
  }

  return rows.map((row) => ({
    ...row.request,
    requestedPayload: enrichPayload(row.request.action, row.request.requestedPayload),
    resolvedPayload:
      row.request.resolvedPayload == null
        ? row.request.resolvedPayload
        : enrichPayload(row.request.action, row.request.resolvedPayload),
    requestedByName: row.requestedByName,
  }))
}

export async function createActionRequest(input: {
  organizationId: string
  requestedBy: string
  source: string
  sourceEventId: string
  action: string
  transcript?: string | null
  requestedPayload: unknown
  resolvedPayload?: unknown | null
  status?: string
}) {
  // Idempotency check
  const [existing] = await db
    .select()
    .from(assistantActionRequest)
    .where(
      and(
        eq(assistantActionRequest.organizationId, input.organizationId),
        eq(assistantActionRequest.source, input.source),
        eq(assistantActionRequest.sourceEventId, input.sourceEventId)
      )
    )
    .limit(1)

  if (existing) {
    return { record: existing, created: false }
  }

  const status = input.status ?? "pending_approval"

  const [record] = await db
    .insert(assistantActionRequest)
    .values({
      organizationId: input.organizationId,
      requestedBy: input.requestedBy,
      source: input.source,
      sourceEventId: input.sourceEventId,
      action: input.action,
      status,
      transcript: input.transcript ?? null,
      requestedPayload: input.requestedPayload,
      resolvedPayload: input.resolvedPayload ?? null,
    })
    .returning()

  return { record, created: true }
}

export async function getActionRequestById(
  id: string,
  organizationId: string
) {
  const result = await db
    .select({
      request: assistantActionRequest,
      requestedByName: user.name,
    })
    .from(assistantActionRequest)
    .innerJoin(user, eq(assistantActionRequest.requestedBy, user.id))
    .where(
      and(
        eq(assistantActionRequest.id, id),
        eq(assistantActionRequest.organizationId, organizationId)
      )
    )
    .limit(1)

  const row = result[0]
  if (!row) return null

  const [enriched] = await enrichActionRequests(organizationId, [row])
  return enriched ?? null
}

export async function updateActionStatus(
  id: string,
  organizationId: string,
  newStatus: string,
  extra?: {
    approvedBy?: string
    resolvedPayload?: unknown
    executionResult?: unknown
    executionError?: string
  }
) {
  const current = await getActionRequestById(id, organizationId)
  if (!current) return null

  assertValidTransition(current.status, newStatus)

  const now = new Date()
  const updates: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  }

  if (newStatus === "approved") {
    updates.approvedBy = extra?.approvedBy ?? null
    updates.approvedAt = now
  }
  if (newStatus === "executed") {
    updates.executedAt = now
    updates.executionResult = extra?.executionResult ?? null
  }
  if (newStatus === "failed") {
    updates.executionError = extra?.executionError ?? null
  }
  if (extra?.resolvedPayload !== undefined) {
    updates.resolvedPayload = extra.resolvedPayload
  }

  const [updated] = await db
    .update(assistantActionRequest)
    .set(updates)
    .where(
      and(
        eq(assistantActionRequest.id, id),
        eq(assistantActionRequest.organizationId, organizationId)
      )
    )
    .returning()

  return updated ?? null
}

export async function listActionRequests(
  organizationId: string,
  options: {
    statuses?: string[]
    limit?: number
    offset?: number
  } = {}
) {
  const { statuses, limit = 20, offset = 0 } = options

  const conditions = [eq(assistantActionRequest.organizationId, organizationId)]
  if (statuses && statuses.length > 0) {
    conditions.push(inArray(assistantActionRequest.status, statuses))
  }

  const result = await db
    .select({
      request: assistantActionRequest,
      requestedByName: user.name,
    })
    .from(assistantActionRequest)
    .innerJoin(user, eq(assistantActionRequest.requestedBy, user.id))
    .where(and(...conditions))
    .orderBy(desc(assistantActionRequest.createdAt))
    .limit(limit)
    .offset(offset)

  return enrichActionRequests(organizationId, result)
}

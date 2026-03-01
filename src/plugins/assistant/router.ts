import { TRPCError } from "@trpc/server"
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { and, eq, ne, gt, lte, isNull, inArray, asc, desc, ilike } from "drizzle-orm"
import { router, orgProcedure, botProcedure } from "@/trpc"
import { db } from "@/db"
import {
  eventSession,
  participation,
  activity,
  groupMemberProfile,
} from "@/db/schema"
import { user, member, organization } from "@/db/auth-schema"
import { ForbiddenError, NotFoundError } from "@/exceptions"
import { withOrgScope } from "@/data-access/org-scope"
import {
  createOrUpdateTelegramLink,
  findLinksByTelegramUserId,
  findLinkedOrgsWithRoles,
  findLinkByUserId,
  deleteTelegramLinkByUserId,
} from "@/plugins/assistant/data-access/telegram-identity-links"
import {
  createActionRequest,
  getActionRequestById,
  updateActionStatus,
  listActionRequests,
} from "@/plugins/assistant/data-access/assistant-action-requests"
import { bulkUpdateAttendance, bulkUpdatePayment, updateParticipation, adminAddParticipant, cancelParticipation } from "@/data-access/participations"
import { getEngagementStats } from "@/data-access/engagement-stats"
import { getMemberRanksByUser } from "@/plugins/ranking/data-access/member-ranks"
import { getRankingDefinitionByActivity } from "@/plugins/ranking/data-access/ranking-definitions"
import { recordMatch } from "@/plugins/ranking/data-access/match-records"
import { getDomain, getMatchModeFormats } from "@/plugins/ranking/domains"
import { rankingDefinition } from "@/plugins/ranking/schema"
import { getActiveActivityMemberIds } from "@/data-access/activity-members"
import {
  telegramWidgetAuthSchema,
  botIdentitySchema,
  botGetActivitiesSchema,
  botGetSessionsSchema,
  botSearchSessionsSchema,
  botGetParticipantsSchema,
  submitMarkAttendanceSchema,
  submitRecordMatchSchema,
  submitMarkPaymentSchema,
  submitAddNoteSchema,
  submitAddParticipantSchema,
  submitRemoveParticipantSchema,
  botGetMemberSummarySchema,
  markAttendancePayloadSchema,
  recordMatchResultPayloadSchema,
  markPaymentPayloadSchema,
  addNotePayloadSchema,
  addParticipantPayloadSchema,
  removeParticipantPayloadSchema,
  listActionRequestsSchema,
  actionRequestByIdSchema,
  approveActionRequestSchema,
  rejectActionRequestSchema,
} from "@/plugins/assistant/schemas"

function assertAdmin(role: string): void {
  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Only organization owners and admins can perform this action")
  }
}

/**
 * Verify a user has admin/owner role in an organization.
 */
async function verifyAdminRole(orgId: string, userId: string) {
  const [memberRow] = await db
    .select({ role: member.role, orgName: organization.name })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(
      and(
        eq(member.organizationId, orgId),
        eq(member.userId, userId)
      )
    )
    .limit(1)

  if (!memberRow || (memberRow.role !== "owner" && memberRow.role !== "admin")) {
    return null
  }

  return memberRow
}

type ResolvedAdmin = {
  status: "resolved"
  link: Awaited<ReturnType<typeof findLinksByTelegramUserId>>[number]
  orgId: string
  orgName: string
  role: string
}

type OrgSelectionRequired = {
  status: "org_selection_required"
  linkedOrgs: Array<{
    organizationId: string
    name: string
    role: string
  }>
}

type ResolveResult = ResolvedAdmin | OrgSelectionRequired

/**
 * Resolve a Telegram user to their linked org and verify admin/owner role.
 * Supports multi-org: when organizationId is provided, resolves to that org.
 * When omitted, auto-resolves if only one admin org, otherwise returns org list.
 */
async function resolveLinkedAdmin(
  telegramUserId: string,
  organizationId?: string
): Promise<ResolveResult> {
  const links = await findLinksByTelegramUserId(telegramUserId)
  if (links.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Telegram user is not linked to any Gatherly account",
    })
  }

  // Case 1: organizationId provided — find matching link and verify
  if (organizationId) {
    const link = links.find((l) => l.organizationId === organizationId)
    if (!link) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Telegram user is not linked to this organization",
      })
    }

    const memberRow = await verifyAdminRole(link.organizationId, link.userId)
    if (!memberRow) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Linked user is not an admin of this organization",
      })
    }

    return {
      status: "resolved",
      link,
      orgId: link.organizationId,
      orgName: memberRow.orgName,
      role: memberRow.role,
    }
  }

  // Case 2: single link — auto-resolve
  if (links.length === 1) {
    const link = links[0]
    const memberRow = await verifyAdminRole(link.organizationId, link.userId)
    if (!memberRow) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Linked user is not an admin of this organization",
      })
    }

    return {
      status: "resolved",
      link,
      orgId: link.organizationId,
      orgName: memberRow.orgName,
      role: memberRow.role,
    }
  }

  // Case 3: multiple links — check which ones have admin/owner role
  const orgsWithRoles = await findLinkedOrgsWithRoles(telegramUserId)
  const adminOrgs = orgsWithRoles.filter(
    (o) => o.role === "owner" || o.role === "admin"
  )

  // If exactly 1 admin org, auto-resolve
  if (adminOrgs.length === 1) {
    const adminOrg = adminOrgs[0]
    const link = links.find((l) => l.organizationId === adminOrg.organizationId)!

    return {
      status: "resolved",
      link,
      orgId: adminOrg.organizationId,
      orgName: adminOrg.orgName,
      role: adminOrg.role,
    }
  }

  // If no admin orgs at all
  if (adminOrgs.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Linked user is not an admin of any linked organization",
    })
  }

  // Multiple admin orgs — return selection required
  return {
    status: "org_selection_required",
    linkedOrgs: adminOrgs.map((o) => ({
      organizationId: o.organizationId,
      name: o.orgName,
      role: o.role,
    })),
  }
}

/**
 * Require a fully resolved admin. Throws BAD_REQUEST if org selection is needed.
 */
async function requireResolvedAdmin(
  telegramUserId: string,
  organizationId?: string
): Promise<ResolvedAdmin> {
  const result = await resolveLinkedAdmin(telegramUserId, organizationId)
  if (result.status === "org_selection_required") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Organization selection required. Call getCapabilities first.",
    })
  }
  return result
}

function requireVerifiedBotSender(
  botSenderId: string | undefined,
  telegramUserId: string
): string {
  if (!botSenderId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Missing bot sender identity",
    })
  }

  if (botSenderId !== telegramUserId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Bot sender mismatch",
    })
  }

  return botSenderId
}

type ResolvedUser = {
  status: "resolved"
  link: Awaited<ReturnType<typeof findLinksByTelegramUserId>>[number]
  orgId: string
  orgName: string
  role: string
}

type UserResolveResult = ResolvedUser | OrgSelectionRequired

/**
 * Resolve a Telegram user to their linked org — accepts ANY member role.
 * Returns the user's role (owner/admin/member) so callers can gate actions.
 */
async function resolveLinkedUser(
  telegramUserId: string,
  organizationId?: string
): Promise<UserResolveResult> {
  const links = await findLinksByTelegramUserId(telegramUserId)
  if (links.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Telegram user is not linked to any Gatherly account",
    })
  }

  // Helper: look up member row for any role
  async function getMemberRow(orgId: string, userId: string) {
    const [row] = await db
      .select({ role: member.role, orgName: organization.name })
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
      .limit(1)
    return row ?? null
  }

  // Case 1: organizationId provided
  if (organizationId) {
    const link = links.find((l) => l.organizationId === organizationId)
    if (!link) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Telegram user is not linked to this organization",
      })
    }
    const memberRow = await getMemberRow(link.organizationId, link.userId)
    if (!memberRow) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Linked user is not a member of this organization",
      })
    }
    return { status: "resolved", link, orgId: link.organizationId, orgName: memberRow.orgName, role: memberRow.role }
  }

  // Case 2: single link — auto-resolve
  if (links.length === 1) {
    const link = links[0]
    const memberRow = await getMemberRow(link.organizationId, link.userId)
    if (!memberRow) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Linked user is not a member of this organization",
      })
    }
    return { status: "resolved", link, orgId: link.organizationId, orgName: memberRow.orgName, role: memberRow.role }
  }

  // Case 3: multiple links — return all orgs for selection
  const orgsWithRoles = await findLinkedOrgsWithRoles(telegramUserId)
  if (orgsWithRoles.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Linked user is not a member of any linked organization",
    })
  }

  if (orgsWithRoles.length === 1) {
    const org = orgsWithRoles[0]
    const link = links.find((l) => l.organizationId === org.organizationId)!
    return { status: "resolved", link, orgId: org.organizationId, orgName: org.orgName, role: org.role }
  }

  return {
    status: "org_selection_required",
    linkedOrgs: orgsWithRoles.map((o) => ({
      organizationId: o.organizationId,
      name: o.orgName,
      role: o.role,
    })),
  }
}

// =============================================================================
// Telegram Widget Auth Verification
// =============================================================================

const WIDGET_AUTH_TTL_MS = 10 * 60 * 1000 // 10 minutes

function verifyTelegramWidgetAuth(data: {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Telegram authentication is temporarily unavailable",
    })
  }

  // Check auth_date is within TTL
  const authDateMs = data.auth_date * 1000
  if (Date.now() - authDateMs > WIDGET_AUTH_TTL_MS) {
    return false
  }

  // Build sorted key=value\n string (excluding hash)
  const checkString = Object.entries(data)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  // secret_key = SHA256(bot_token)
  const secretKey = createHash("sha256").update(botToken).digest()

  // hmac = HMAC-SHA256(check_string, secret_key)
  const hmac = createHmac("sha256", secretKey).update(checkString).digest("hex")

  return timingSafeEqual(Buffer.from(hmac), Buffer.from(data.hash))
}

// =============================================================================
// Execution Logic (called on approval)
// =============================================================================

async function executeMarkAttendance(
  orgId: string,
  payload: unknown,
  _executingUserId: string
) {
  const parsed = markAttendancePayloadSchema.parse(payload)

  // Verify session belongs to org
  await withOrgScope(orgId, async (scope) => {
    await scope.requireSession(parsed.sessionId)
  })

  // Resolve userId → participationId
  const participations = await db
    .select({ id: participation.id, userId: participation.userId })
    .from(participation)
    .where(
      and(
        eq(participation.sessionId, parsed.sessionId),
        inArray(participation.userId, parsed.updates.map((u) => u.userId)),
        ne(participation.status, "cancelled")
      )
    )

  const userToPartId = new Map(participations.map((p) => [p.userId, p.id]))

  const missing = parsed.updates.filter((u) => !userToPartId.has(u.userId))
  if (missing.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Users not found in session: ${missing.map((u) => u.userId).join(", ")}`,
    })
  }

  const bulkUpdates = parsed.updates.map((u) => ({
    participationId: userToPartId.get(u.userId)!,
    attendance: u.attendance as "show" | "no_show" | "pending",
  }))

  const count = await bulkUpdateAttendance(parsed.sessionId, bulkUpdates)
  return { action: "mark_attendance", count, sessionId: parsed.sessionId }
}

async function executeRecordMatchResult(
  orgId: string,
  payload: unknown,
  executingUserId: string
) {
  const parsed = recordMatchResultPayloadSchema.parse(payload)

  const definition = await getRankingDefinitionByActivity(parsed.activityId, orgId)
  if (!definition) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No ranking definition found for this activity",
    })
  }

  const domain = getDomain(definition.domainId)
  if (!domain?.matchConfig) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This ranking domain does not support match recording",
    })
  }

  // Validate format
  if (!domain.matchConfig.supportedFormats.includes(parsed.matchFormat)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unsupported match format: ${parsed.matchFormat}`,
    })
  }

  // Validate team sizes
  const rule = domain.matchConfig.formatRules[parsed.matchFormat]
  const minPerTeam = rule.playersPerTeam ?? rule.minPlayersPerTeam ?? 1
  const maxPerTeam = rule.playersPerTeam ?? rule.maxPlayersPerTeam ?? 99

  if (parsed.team1.length < minPerTeam || parsed.team1.length > maxPerTeam) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Team 1 must have ${minPerTeam}-${maxPerTeam} player(s) for ${parsed.matchFormat}`,
    })
  }
  if (parsed.team2.length < minPerTeam || parsed.team2.length > maxPerTeam) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Team 2 must have ${minPerTeam}-${maxPerTeam} player(s) for ${parsed.matchFormat}`,
    })
  }

  // No duplicate players
  const allPlayers = [...parsed.team1, ...parsed.team2]
  const uniquePlayers = new Set(allPlayers)
  if (uniquePlayers.size !== allPlayers.length) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A player cannot be on both teams",
    })
  }

  // Verify all players are active members of the activity
  const activeIds = await getActiveActivityMemberIds(definition.activityId, allPlayers)
  const missingPlayers = allPlayers.filter((id) => !activeIds.has(id))
  if (missingPlayers.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Some users are not active members of this activity",
    })
  }

  const result = await recordMatch({
    organizationId: orgId,
    rankingDefinitionId: definition.id,
    domainId: definition.domainId,
    sessionId: parsed.sessionId,
    matchFormat: parsed.matchFormat,
    team1: parsed.team1,
    team2: parsed.team2,
    scores: parsed.scores,
    recordedBy: executingUserId,
    notes: parsed.notes,
  })

  return { action: "record_match_result", matchId: result.match.id }
}

async function executeMarkPayment(
  orgId: string,
  payload: unknown,
  _executingUserId: string
) {
  const parsed = markPaymentPayloadSchema.parse(payload)

  await withOrgScope(orgId, async (scope) => {
    await scope.requireSession(parsed.sessionId)
  })

  const participations = await db
    .select({ id: participation.id, userId: participation.userId })
    .from(participation)
    .where(
      and(
        eq(participation.sessionId, parsed.sessionId),
        inArray(participation.userId, parsed.updates.map((u) => u.userId)),
        ne(participation.status, "cancelled")
      )
    )

  const userToPartId = new Map(participations.map((p) => [p.userId, p.id]))

  const missing = parsed.updates.filter((u) => !userToPartId.has(u.userId))
  if (missing.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Users not found in session: ${missing.map((u) => u.userId).join(", ")}`,
    })
  }

  const bulkUpdates = parsed.updates.map((u) => ({
    participationId: userToPartId.get(u.userId)!,
    payment: u.payment as "paid" | "unpaid",
  }))

  const count = await bulkUpdatePayment(parsed.sessionId, bulkUpdates)
  return { action: "mark_payment", count, sessionId: parsed.sessionId }
}

async function executeAddNote(
  orgId: string,
  payload: unknown,
  _executingUserId: string
) {
  const parsed = addNotePayloadSchema.parse(payload)

  await withOrgScope(orgId, async (scope) => {
    await scope.requireSession(parsed.sessionId)
  })

  const [participationRow] = await db
    .select({ id: participation.id })
    .from(participation)
    .where(
      and(
        eq(participation.sessionId, parsed.sessionId),
        eq(participation.userId, parsed.userId),
        ne(participation.status, "cancelled")
      )
    )
    .limit(1)

  if (!participationRow) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `User ${parsed.userId} not found in session`,
    })
  }

  await updateParticipation(participationRow.id, { notes: parsed.notes })
  return { action: "add_note", participationId: participationRow.id, sessionId: parsed.sessionId }
}

async function executeAddParticipant(
  orgId: string,
  payload: unknown,
  _executingUserId: string
) {
  const parsed = addParticipantPayloadSchema.parse(payload)

  await withOrgScope(orgId, async (scope) => {
    await scope.requireSession(parsed.sessionId)
  })

  const result = await adminAddParticipant(parsed.sessionId, parsed.userId)
  return { action: "add_participant", sessionId: parsed.sessionId, participationId: result.id }
}

async function executeRemoveParticipant(
  orgId: string,
  payload: unknown,
  _executingUserId: string
) {
  const parsed = removeParticipantPayloadSchema.parse(payload)

  await withOrgScope(orgId, async (scope) => {
    await scope.requireSession(parsed.sessionId)
  })

  // Resolve userId → participationId
  const [participationRow] = await db
    .select({ id: participation.id })
    .from(participation)
    .where(
      and(
        eq(participation.sessionId, parsed.sessionId),
        eq(participation.userId, parsed.userId),
        ne(participation.status, "cancelled")
      )
    )
    .limit(1)

  if (!participationRow) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `User ${parsed.userId} not found in session`,
    })
  }

  await cancelParticipation(participationRow.id, parsed.userId)
  return { action: "remove_participant", sessionId: parsed.sessionId }
}

const ACTION_EXECUTORS: Record<
  string,
  (orgId: string, payload: unknown, userId: string) => Promise<unknown>
> = {
  mark_attendance: executeMarkAttendance,
  record_match_result: executeRecordMatchResult,
  mark_payment: executeMarkPayment,
  add_note: executeAddNote,
  add_participant: executeAddParticipant,
  remove_participant: executeRemoveParticipant,
}

// =============================================================================
// Member Summary Builder (used by getMemberSummary)
// =============================================================================

async function buildMemberSummary(
  userId: string,
  name: string,
  nickname: string | null,
  orgId: string
) {
  const [engagement, rankings, unpaidSessions] = await Promise.all([
    getEngagementStats(userId, orgId),
    getMemberRanksByUser(userId, orgId),
    db
      .select({
        sessionId: eventSession.id,
        sessionTitle: eventSession.title,
        sessionDateTime: eventSession.dateTime,
      })
      .from(participation)
      .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
      .where(
        and(
          eq(participation.userId, userId),
          eq(eventSession.organizationId, orgId),
          eq(participation.payment, "unpaid"),
          eq(participation.status, "joined"),
          isNull(eventSession.deletedAt),
          ne(eventSession.status, "cancelled")
        )
      )
      .orderBy(desc(eventSession.dateTime)),
  ])

  return {
    userId,
    name,
    nickname,
    engagement,
    unpaidSessions: unpaidSessions.map((s) => ({
      sessionId: s.sessionId,
      title: s.sessionTitle,
      dateTime: s.sessionDateTime.toISOString(),
    })),
    rankings,
  }
}

// =============================================================================
// Router
// =============================================================================

export const assistantRouter = router({
  // ===========================================================================
  // Capability Discovery (botProcedure)
  // ===========================================================================

  getCapabilities: botProcedure
    .input(botIdentitySchema)
    .query(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const result = await resolveLinkedUser(senderId, input.organizationId)

      if (result.status === "org_selection_required") {
        return {
          status: "org_selection_required" as const,
          linkedOrgs: result.linkedOrgs,
          supportedActions: [],
        }
      }

      const isAdmin = result.role === "owner" || result.role === "admin"

      const adminActions = [
        {
          action: "mark_attendance",
          endpoint: "submitMarkAttendance",
          method: "POST",
          path: "/api/trpc/plugin.assistant.submitMarkAttendance",
          requiresApproval: true,
          fields: [
            { name: "sessionId", type: "string", required: true, description: "The session to mark attendance for. Use getActivities then getSessions or searchSessions to find the session ID." },
            {
              name: "updates",
              type: "array",
              required: true,
              description: "Array of { userId: string, attendance: 'show' | 'no_show' | 'pending' }. Use getParticipants to get user IDs.",
            },
          ],
        },
        {
          action: "record_match_result",
          endpoint: "submitRecordMatch",
          method: "POST",
          path: "/api/trpc/plugin.assistant.submitRecordMatch",
          requiresApproval: true,
          fields: [
            { name: "activityId", type: "string", required: true, description: "The activity this match belongs to. Use getActivities to find the activity ID." },
            { name: "sessionId", type: "string", required: true, description: "The session this match was played in. Use getSessions or searchSessions to find the session ID." },
            { name: "matchFormat", type: "string", required: true, description: "MUST match one of activity.matchFormats.supported from getActivities. Use activity.matchFormats.default if user does not specify." },
            { name: "team1", type: "array", required: true, description: "Array of user IDs for team 1. Length MUST match the format's playersPerTeam from activity.matchFormats.formatRules." },
            { name: "team2", type: "array", required: true, description: "Array of user IDs for team 2. Length MUST match the format's playersPerTeam from activity.matchFormats.formatRules." },
            { name: "scores", type: "array", required: true, description: "Array of sets/games. Each element is a tuple [team1Score, team2Score]. Example for padel/tennis: [[6, 3], [6, 4]] means Set 1: 6-3, Set 2: 6-4. For object-score sports (basketball, football): use {team1: number, team2: number}." },
            { name: "notes", type: "string", required: false, description: "Optional match notes (max 500 chars)" },
          ],
        },
        {
          action: "mark_payment",
          endpoint: "submitMarkPayment",
          method: "POST",
          path: "/api/trpc/plugin.assistant.submitMarkPayment",
          requiresApproval: true,
          fields: [
            { name: "sessionId", type: "string", required: true, description: "The session to mark payment for. Use getActivities then getSessions or searchSessions to find the session ID." },
            {
              name: "updates",
              type: "array",
              required: true,
              description: "Array of { userId: string, payment: 'paid' | 'unpaid' }. Use getParticipants to get user IDs and current payment status.",
            },
          ],
        },
        {
          action: "add_note",
          endpoint: "submitAddNote",
          method: "POST",
          path: "/api/trpc/plugin.assistant.submitAddNote",
          requiresApproval: true,
          fields: [
            { name: "sessionId", type: "string", required: true, description: "The session the participant belongs to. Use getActivities then getSessions or searchSessions to find the session ID." },
            { name: "userId", type: "string", required: true, description: "The user to add a note to. Use getParticipants to get user IDs." },
            { name: "notes", type: "string", required: true, description: "The note text to add (max 1000 chars). This will replace any existing note." },
          ],
        },
        {
          action: "add_participant",
          endpoint: "submitAddParticipant",
          method: "POST",
          path: "/api/trpc/plugin.assistant.submitAddParticipant",
          requiresApproval: true,
          fields: [
            { name: "sessionId", type: "string", required: true, description: "The session to add the participant to. Use getActivities then getSessions or searchSessions to find the session ID." },
            { name: "userId", type: "string", required: true, description: "The user to add as a participant. Use getMemberSummary to find the user ID by name." },
          ],
        },
        {
          action: "remove_participant",
          endpoint: "submitRemoveParticipant",
          method: "POST",
          path: "/api/trpc/plugin.assistant.submitRemoveParticipant",
          requiresApproval: true,
          fields: [
            { name: "sessionId", type: "string", required: true, description: "The session to remove the participant from. Use getActivities then getSessions or searchSessions to find the session ID." },
            { name: "userId", type: "string", required: true, description: "The user to remove. Use getParticipants to get user IDs of current participants." },
          ],
        },
      ]

      return {
        status: "ready" as const,
        organization: {
          id: result.orgId,
          name: result.orgName,
        },
        role: result.role,
        supportedActions: isAdmin ? adminActions : [],
      }
    }),

  linkTelegramViaWidget: orgProcedure
    .input(telegramWidgetAuthSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)

      if (!verifyTelegramWidgetAuth(input)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired Telegram authentication",
        })
      }

      const telegramUserId = String(input.id)
      const link = await createOrUpdateTelegramLink(
        ctx.activeOrganization.id,
        ctx.user.id,
        telegramUserId,
        ctx.user.id
      )

      return { success: true, telegramUserId: link.telegramUserId }
    }),

  // ===========================================================================
  // Dashboard Telegram Management (orgProcedure + admin only)
  // ===========================================================================

  unlinkMyTelegram: orgProcedure.mutation(async ({ ctx }) => {
    const deleted = await deleteTelegramLinkByUserId(
      ctx.activeOrganization.id,
      ctx.user.id
    )
    if (!deleted) {
      throw new NotFoundError("No Telegram link found for your account")
    }
    return { success: true }
  }),

  getMyTelegramLink: orgProcedure.query(async ({ ctx }) => {
    const link = await findLinkByUserId(ctx.activeOrganization.id, ctx.user.id)
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || null
    return link
      ? { linked: true as const, telegramUserId: link.telegramUserId, linkedAt: link.linkedAt, botUsername }
      : { linked: false as const, botUsername }
  }),

  // ===========================================================================
  // Bot Query Endpoints (botProcedure)
  // ===========================================================================

  getActivities: botProcedure
    .input(botGetActivitiesSchema)
    .query(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { orgId, orgName } = await requireResolvedAdmin(senderId, input.organizationId)

      const activityConditions = [eq(activity.organizationId, orgId)]
      if (!input.includeInactive) {
        activityConditions.push(eq(activity.isActive, true))
      }
      if (input.activityId) {
        activityConditions.push(eq(activity.id, input.activityId))
      }

      const rawActivities = await db
        .select({
          id: activity.id,
          name: activity.name,
          slug: activity.slug,
          isActive: activity.isActive,
        })
        .from(activity)
        .where(and(...activityConditions))

      // Enrich activities with ranking/match config
      const activityIds = rawActivities.map((a) => a.id)
      const rankingDefs = activityIds.length > 0
        ? await db
            .select({
              activityId: rankingDefinition.activityId,
              domainId: rankingDefinition.domainId,
            })
            .from(rankingDefinition)
            .where(inArray(rankingDefinition.activityId, activityIds))
        : []

      const rankingByActivity = new Map(rankingDefs.map((r) => [r.activityId, r]))

      const activities = rawActivities.map((a) => {
        const ranking = rankingByActivity.get(a.id)
        const matchFormats = ranking ? getMatchModeFormats(ranking.domainId) : null
        return {
          ...a,
          domainId: ranking?.domainId ?? null,
          matchFormats: matchFormats
            ? {
                supported: matchFormats.formats,
                default: matchFormats.defaultFormat,
                formatRules: Object.fromEntries(
                  Object.entries(matchFormats.formatRules).map(([fmt, rule]) => [
                    fmt,
                    {
                      playersPerTeam: rule.playersPerTeam ?? null,
                      minPlayersPerTeam: rule.minPlayersPerTeam ?? rule.playersPerTeam ?? 1,
                      maxPlayersPerTeam: rule.maxPlayersPerTeam ?? rule.playersPerTeam ?? 99,
                    },
                  ])
                ),
              }
            : null,
        }
      })

      return {
        organization: { id: orgId, name: orgName },
        activities,
      }
    }),

  getSessions: botProcedure
    .input(botGetSessionsSchema)
    .query(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { orgId, orgName } = await requireResolvedAdmin(senderId, input.organizationId)
      const now = new Date()

      const sessionConditions = [
        eq(eventSession.organizationId, orgId),
        isNull(eventSession.deletedAt),
        ne(eventSession.status, "cancelled"),
      ]
      if (input.activityId) {
        sessionConditions.push(eq(eventSession.activityId, input.activityId))
      }
      if (input.sessionId) {
        sessionConditions.push(eq(eventSession.id, input.sessionId))
      }

      const sessions: Array<{
        id: string
        title: string
        dateTime: Date
        activityId: string
        status: string
        location: string | null
      }> = []

      if (input.includeUpcoming) {
        const upcoming = await db
          .select({
            id: eventSession.id,
            title: eventSession.title,
            dateTime: eventSession.dateTime,
            activityId: eventSession.activityId,
            status: eventSession.status,
            location: eventSession.location,
          })
          .from(eventSession)
          .where(
            and(
              ...sessionConditions,
              gt(eventSession.dateTime, now),
              eq(eventSession.status, "published")
            )
          )
          .orderBy(asc(eventSession.dateTime))
          .limit(50)
        sessions.push(...upcoming)
      }

      if (input.includePast) {
        const past = await db
          .select({
            id: eventSession.id,
            title: eventSession.title,
            dateTime: eventSession.dateTime,
            activityId: eventSession.activityId,
            status: eventSession.status,
            location: eventSession.location,
          })
          .from(eventSession)
          .where(
            and(
              ...sessionConditions,
              lte(eventSession.dateTime, now),
              inArray(eventSession.status, ["published", "completed"])
            )
          )
          .orderBy(desc(eventSession.dateTime))
          .limit(input.pastLimit)

        const existingIds = new Set(sessions.map((s) => s.id))
        for (const s of past) {
          if (!existingIds.has(s.id)) sessions.push(s)
        }
      }

      return {
        organization: { id: orgId, name: orgName },
        sessions: sessions.map((s) => ({
          ...s,
          dateTime: s.dateTime.toISOString(),
        })),
      }
    }),

  searchSessions: botProcedure
    .input(botSearchSessionsSchema)
    .query(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { orgId, orgName } = await requireResolvedAdmin(senderId, input.organizationId)

      const searchConditions = [
        eq(eventSession.organizationId, orgId),
        isNull(eventSession.deletedAt),
        ne(eventSession.status, "cancelled"),
        ilike(eventSession.title, `%${input.query}%`),
      ]
      if (input.activityId) {
        searchConditions.push(eq(eventSession.activityId, input.activityId))
      }

      const sessions = await db
        .select({
          id: eventSession.id,
          title: eventSession.title,
          dateTime: eventSession.dateTime,
          activityId: eventSession.activityId,
          status: eventSession.status,
          location: eventSession.location,
        })
        .from(eventSession)
        .where(and(...searchConditions))
        .orderBy(desc(eventSession.dateTime))
        .limit(input.limit)

      return {
        organization: { id: orgId, name: orgName },
        sessions: sessions.map((s) => ({
          ...s,
          dateTime: s.dateTime.toISOString(),
        })),
      }
    }),

  getParticipants: botProcedure
    .input(botGetParticipantsSchema)
    .query(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { orgId, orgName } = await requireResolvedAdmin(senderId, input.organizationId)

      await withOrgScope(orgId, async (scope) => {
        await scope.requireSession(input.sessionId)
      })

      const rows = await db
        .select({
          participationId: participation.id,
          userId: participation.userId,
          name: user.name,
          attendance: participation.attendance,
          payment: participation.payment,
          status: participation.status,
        })
        .from(participation)
        .innerJoin(user, eq(participation.userId, user.id))
        .where(
          and(
            eq(participation.sessionId, input.sessionId),
            ne(participation.status, "cancelled")
          )
        )
        .orderBy(asc(user.name))

      const userIds = rows.map((r) => r.userId)
      const nicknames =
        userIds.length > 0
          ? await db
              .select({
                userId: groupMemberProfile.userId,
                nickname: groupMemberProfile.nickname,
              })
              .from(groupMemberProfile)
              .where(
                and(
                  eq(groupMemberProfile.organizationId, orgId),
                  inArray(groupMemberProfile.userId, userIds)
                )
              )
          : []

      const nicknameMap = new Map(nicknames.map((n) => [n.userId, n.nickname]))

      return {
        organization: { id: orgId, name: orgName },
        sessionId: input.sessionId,
        participants: rows.map((r) => ({
          participationId: r.participationId,
          userId: r.userId,
          name: r.name,
          nickname: nicknameMap.get(r.userId) ?? null,
          attendance: r.attendance,
          payment: r.payment,
          status: r.status,
        })),
      }
    }),

  // ===========================================================================
  // Bot Submit Endpoints (botProcedure)
  // ===========================================================================

  submitMarkAttendance: botProcedure
    .input(submitMarkAttendanceSchema)
    .mutation(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { link, orgId } = await requireResolvedAdmin(senderId, input.organizationId)

      const resolvedPayload = {
        sessionId: input.sessionId,
        updates: input.updates,
      }

      const { record, created } = await createActionRequest({
        organizationId: orgId,
        requestedBy: link.userId,
        source: "telegram",
        sourceEventId: input.sourceEventId,
        action: "mark_attendance",
        transcript: input.transcript,
        requestedPayload: resolvedPayload,
        resolvedPayload,
        status: "pending_approval",
      })

      return {
        actionRequestId: record.id,
        status: record.status,
        created,
      }
    }),

  submitRecordMatch: botProcedure
    .input(submitRecordMatchSchema)
    .mutation(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { link, orgId } = await requireResolvedAdmin(senderId, input.organizationId)

      const resolvedPayload = {
        activityId: input.activityId,
        sessionId: input.sessionId,
        matchFormat: input.matchFormat,
        team1: input.team1,
        team2: input.team2,
        scores: input.scores,
        notes: input.notes,
      }

      const { record, created } = await createActionRequest({
        organizationId: orgId,
        requestedBy: link.userId,
        source: "telegram",
        sourceEventId: input.sourceEventId,
        action: "record_match_result",
        transcript: input.transcript,
        requestedPayload: resolvedPayload,
        resolvedPayload,
        status: "pending_approval",
      })

      return {
        actionRequestId: record.id,
        status: record.status,
        created,
      }
    }),

  submitMarkPayment: botProcedure
    .input(submitMarkPaymentSchema)
    .mutation(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { link, orgId } = await requireResolvedAdmin(senderId, input.organizationId)

      const resolvedPayload = {
        sessionId: input.sessionId,
        updates: input.updates,
      }

      const { record, created } = await createActionRequest({
        organizationId: orgId,
        requestedBy: link.userId,
        source: "telegram",
        sourceEventId: input.sourceEventId,
        action: "mark_payment",
        transcript: input.transcript,
        requestedPayload: resolvedPayload,
        resolvedPayload,
        status: "pending_approval",
      })

      return {
        actionRequestId: record.id,
        status: record.status,
        created,
      }
    }),

  submitAddNote: botProcedure
    .input(submitAddNoteSchema)
    .mutation(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { link, orgId } = await requireResolvedAdmin(senderId, input.organizationId)

      const resolvedPayload = {
        sessionId: input.sessionId,
        userId: input.userId,
        notes: input.notes,
      }

      const { record, created } = await createActionRequest({
        organizationId: orgId,
        requestedBy: link.userId,
        source: "telegram",
        sourceEventId: input.sourceEventId,
        action: "add_note",
        transcript: input.transcript,
        requestedPayload: resolvedPayload,
        resolvedPayload,
        status: "pending_approval",
      })

      return {
        actionRequestId: record.id,
        status: record.status,
        created,
      }
    }),

  submitAddParticipant: botProcedure
    .input(submitAddParticipantSchema)
    .mutation(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { link, orgId } = await requireResolvedAdmin(senderId, input.organizationId)

      const resolvedPayload = {
        sessionId: input.sessionId,
        userId: input.userId,
      }

      const { record, created } = await createActionRequest({
        organizationId: orgId,
        requestedBy: link.userId,
        source: "telegram",
        sourceEventId: input.sourceEventId,
        action: "add_participant",
        transcript: input.transcript,
        requestedPayload: resolvedPayload,
        resolvedPayload,
        status: "pending_approval",
      })

      return {
        actionRequestId: record.id,
        status: record.status,
        created,
      }
    }),

  submitRemoveParticipant: botProcedure
    .input(submitRemoveParticipantSchema)
    .mutation(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { link, orgId } = await requireResolvedAdmin(senderId, input.organizationId)

      const resolvedPayload = {
        sessionId: input.sessionId,
        userId: input.userId,
      }

      const { record, created } = await createActionRequest({
        organizationId: orgId,
        requestedBy: link.userId,
        source: "telegram",
        sourceEventId: input.sourceEventId,
        action: "remove_participant",
        transcript: input.transcript,
        requestedPayload: resolvedPayload,
        resolvedPayload,
        status: "pending_approval",
      })

      return {
        actionRequestId: record.id,
        status: record.status,
        created,
      }
    }),

  // ===========================================================================
  // Bot Query: Member Summary (no approval required)
  // ===========================================================================

  getMemberSummary: botProcedure
    .input(botGetMemberSummarySchema)
    .query(async ({ ctx, input }) => {
      const senderId = requireVerifiedBotSender(ctx.botSenderId, input.telegramUserId)
      const { orgId, orgName } = await requireResolvedAdmin(senderId, input.organizationId)

      // Direct lookup by userId
      if (input.userId) {
        // Verify user is a member of this org
        const [memberRow] = await db
          .select({
            userId: member.userId,
            name: user.name,
          })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.organizationId, orgId),
              eq(member.userId, input.userId)
            )
          )
          .limit(1)

        if (!memberRow) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User is not a member of this organization",
          })
        }

        // Get nickname
        const [profile] = await db
          .select({ nickname: groupMemberProfile.nickname })
          .from(groupMemberProfile)
          .where(
            and(
              eq(groupMemberProfile.organizationId, orgId),
              eq(groupMemberProfile.userId, input.userId)
            )
          )
          .limit(1)

        const summary = await buildMemberSummary(
          input.userId,
          memberRow.name,
          profile?.nickname ?? null,
          orgId
        )

        return {
          organization: { id: orgId, name: orgName },
          matches: null,
          member: summary,
        }
      }

      // Search by name/email/nickname
      const searchTerm = `%${input.query}%`
      const searchResults = await db
        .select({
          userId: member.userId,
          name: user.name,
          nickname: groupMemberProfile.nickname,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .leftJoin(
          groupMemberProfile,
          and(
            eq(groupMemberProfile.organizationId, orgId),
            eq(groupMemberProfile.userId, member.userId)
          )
        )
        .where(
          and(
            eq(member.organizationId, orgId),
            // Match name, email, or nickname
            // Use SQL `or` for the search
            ilike(user.name, searchTerm)
          )
        )
        .limit(10)

      // Also search by nickname and email separately and merge
      const nicknameResults = await db
        .select({
          userId: member.userId,
          name: user.name,
          nickname: groupMemberProfile.nickname,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .innerJoin(
          groupMemberProfile,
          and(
            eq(groupMemberProfile.organizationId, orgId),
            eq(groupMemberProfile.userId, member.userId)
          )
        )
        .where(
          and(
            eq(member.organizationId, orgId),
            ilike(groupMemberProfile.nickname, searchTerm)
          )
        )
        .limit(10)

      const emailResults = await db
        .select({
          userId: member.userId,
          name: user.name,
          nickname: groupMemberProfile.nickname,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .leftJoin(
          groupMemberProfile,
          and(
            eq(groupMemberProfile.organizationId, orgId),
            eq(groupMemberProfile.userId, member.userId)
          )
        )
        .where(
          and(
            eq(member.organizationId, orgId),
            ilike(user.email, searchTerm)
          )
        )
        .limit(10)

      // Deduplicate by userId
      const seen = new Set<string>()
      const allResults: typeof searchResults = []
      for (const row of [...searchResults, ...nicknameResults, ...emailResults]) {
        if (!seen.has(row.userId)) {
          seen.add(row.userId)
          allResults.push(row)
        }
      }

      if (allResults.length === 0) {
        return {
          organization: { id: orgId, name: orgName },
          matches: [],
          member: null,
        }
      }

      // Multiple matches — return list for disambiguation
      if (allResults.length > 1) {
        return {
          organization: { id: orgId, name: orgName },
          matches: allResults.map((r) => ({
            userId: r.userId,
            name: r.name,
            nickname: r.nickname ?? null,
          })),
          member: null,
        }
      }

      // Single match — return full summary
      const match = allResults[0]
      const summary = await buildMemberSummary(
        match.userId,
        match.name,
        match.nickname ?? null,
        orgId
      )

      return {
        organization: { id: orgId, name: orgName },
        matches: null,
        member: summary,
      }
    }),

  // ===========================================================================
  // In-App Queue Endpoints (orgProcedure)
  // ===========================================================================

  listPending: orgProcedure
    .input(listActionRequestsSchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return listActionRequests(ctx.activeOrganization.id, {
        statuses: input.statuses,
        limit: input.limit,
        offset: input.offset,
      })
    }),

  getById: orgProcedure
    .input(actionRequestByIdSchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const request = await getActionRequestById(
        input.actionRequestId,
        ctx.activeOrganization.id
      )
      if (!request) {
        throw new NotFoundError("Action request not found")
      }
      return request
    }),

  approveFromDashboard: orgProcedure
    .input(approveActionRequestSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const orgId = ctx.activeOrganization.id

      // Move to approved
      const approved = await updateActionStatus(
        input.actionRequestId,
        orgId,
        "approved",
        { approvedBy: ctx.user.id }
      )
      if (!approved) {
        throw new NotFoundError("Action request not found")
      }

      // Execute
      const executor = ACTION_EXECUTORS[approved.action]
      if (!executor) {
        await updateActionStatus(input.actionRequestId, orgId, "failed", {
          executionError: `No executor for action: ${approved.action}`,
        })
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Action execution is temporarily unavailable",
        })
      }

      try {
        const executionResult = await executor(
          orgId,
          approved.resolvedPayload ?? approved.requestedPayload,
          ctx.user.id
        )
        await updateActionStatus(input.actionRequestId, orgId, "executed", {
          executionResult,
        })
        return {
          actionRequestId: input.actionRequestId,
          status: "executed",
          executionResult,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        await updateActionStatus(input.actionRequestId, orgId, "failed", {
          executionError: errorMessage,
        })
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Action execution failed",
        })
      }
    }),

  rejectFromDashboard: orgProcedure
    .input(rejectActionRequestSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      const rejected = await updateActionStatus(
        input.actionRequestId,
        ctx.activeOrganization.id,
        "rejected"
      )
      if (!rejected) {
        throw new NotFoundError("Action request not found")
      }
      return { actionRequestId: input.actionRequestId, status: "rejected" }
    }),

  listHistory: orgProcedure
    .input(listActionRequestsSchema)
    .query(async ({ ctx, input }) => {
      assertAdmin(ctx.membership.role)
      return listActionRequests(ctx.activeOrganization.id, {
        statuses: input.statuses ?? ["executed", "rejected", "failed"],
        limit: input.limit,
        offset: input.offset,
      })
    }),
})

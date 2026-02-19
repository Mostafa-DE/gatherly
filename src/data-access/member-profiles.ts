import { eq, and, inArray } from "drizzle-orm"
import { db } from "@/db"
import {
  groupMemberProfile,
  activityJoinRequest,
  participation,
  eventSession,
  activity,
  organizationSettings,
} from "@/db/schema"
import { user } from "@/db/auth-schema"
import { rankingDefinition, memberRank, rankingLevel } from "@/plugins/ranking/schema"
import { getDomain } from "@/plugins/ranking/domains"
import type { JoinFormSchema } from "@/types/form"

// =============================================================================
// Types
// =============================================================================

export type MemberDataProfile = {
  userId: string
  userName: string | null
  userImage: string | null
  sources: {
    orgProfile: Record<string, unknown> | null
    activityForm: Record<string, unknown> | null
    sessionForm: Record<string, unknown> | null
    ranking: {
      levelName: string | null
      levelOrder: number | null
      stats: Record<string, unknown>
    } | null
  }
  merged: Record<string, unknown>
}

export type AvailableField = {
  sourceId: string
  label: string
  source: "org" | "activity" | "session" | "ranking"
  type: string
  options?: string[]
}

// =============================================================================
// Build Member Profiles
// =============================================================================

export async function buildMemberProfiles(opts: {
  organizationId: string
  activityId: string
  sessionId?: string
  userIds?: string[]
}): Promise<MemberDataProfile[]> {
  const { organizationId, activityId, sessionId } = opts

  // Determine user IDs if not provided
  const userIds = opts.userIds
  if (!userIds || userIds.length === 0) {
    return []
  }

  // Batch query 1: User info
  const users = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, userIds))

  const userMap = new Map(users.map((u) => [u.id, u]))

  // Batch query 2: Org profiles
  const orgProfiles = await db
    .select({ userId: groupMemberProfile.userId, answers: groupMemberProfile.answers })
    .from(groupMemberProfile)
    .where(
      and(
        eq(groupMemberProfile.organizationId, organizationId),
        inArray(groupMemberProfile.userId, userIds)
      )
    )

  const orgProfileMap = new Map(
    orgProfiles.map((p) => [p.userId, p.answers as Record<string, unknown> | null])
  )

  // Batch query 3: Activity form answers (only members who went through approval flow)
  const activityForms = await db
    .select({
      userId: activityJoinRequest.userId,
      formAnswers: activityJoinRequest.formAnswers,
    })
    .from(activityJoinRequest)
    .where(
      and(
        eq(activityJoinRequest.activityId, activityId),
        eq(activityJoinRequest.status, "approved"),
        inArray(activityJoinRequest.userId, userIds)
      )
    )

  const activityFormMap = new Map(
    activityForms.map((f) => [f.userId, f.formAnswers as Record<string, unknown> | null])
  )

  // Batch query 4: Session form answers (when session provided)
  const sessionFormMap = new Map<string, Record<string, unknown> | null>()
  if (sessionId) {
    const sessionForms = await db
      .select({
        userId: participation.userId,
        formAnswers: participation.formAnswers,
      })
      .from(participation)
      .where(
        and(
          eq(participation.sessionId, sessionId),
          eq(participation.status, "joined"),
          inArray(participation.userId, userIds)
        )
      )

    for (const f of sessionForms) {
      sessionFormMap.set(f.userId, f.formAnswers as Record<string, unknown> | null)
    }
  }

  // Batch query 5: Ranking data (when ranking plugin enabled)
  const rankingMap = new Map<
    string,
    {
      levelName: string | null
      levelOrder: number | null
      stats: Record<string, unknown>
      attributes: Record<string, unknown>
    }
  >()

  const [rankDef] = await db
    .select({ id: rankingDefinition.id, domainId: rankingDefinition.domainId })
    .from(rankingDefinition)
    .where(
      and(
        eq(rankingDefinition.activityId, activityId),
        eq(rankingDefinition.organizationId, organizationId)
      )
    )
    .limit(1)

  if (rankDef) {
    const ranks = await db
      .select({
        userId: memberRank.userId,
        stats: memberRank.stats,
        attributes: memberRank.attributes,
        levelName: rankingLevel.name,
        levelOrder: rankingLevel.order,
      })
      .from(memberRank)
      .leftJoin(rankingLevel, eq(memberRank.currentLevelId, rankingLevel.id))
      .where(
        and(
          eq(memberRank.rankingDefinitionId, rankDef.id),
          inArray(memberRank.userId, userIds)
        )
      )

    for (const r of ranks) {
      rankingMap.set(r.userId, {
        levelName: r.levelName,
        levelOrder: r.levelOrder,
        stats: r.stats as Record<string, unknown>,
        attributes: (r.attributes as Record<string, unknown>) ?? {},
      })
    }
  }

  // Batch query 6: Participation attribute overrides (when session provided)
  const attrOverridesMap = new Map<string, Record<string, unknown> | null>()
  if (sessionId) {
    const overrides = await db
      .select({
        userId: participation.userId,
        attributeOverrides: participation.attributeOverrides,
      })
      .from(participation)
      .where(
        and(
          eq(participation.sessionId, sessionId),
          eq(participation.status, "joined"),
          inArray(participation.userId, userIds)
        )
      )

    for (const o of overrides) {
      attrOverridesMap.set(
        o.userId,
        o.attributeOverrides as Record<string, unknown> | null
      )
    }
  }

  // Build profiles
  return userIds.map((uid) => {
    const u = userMap.get(uid)
    const orgData = orgProfileMap.get(uid) ?? null
    const activityData = activityFormMap.get(uid) ?? null
    const sessionData = sessionFormMap.get(uid) ?? null
    const rankingData = rankingMap.get(uid) ?? null

    const merged: Record<string, unknown> = {}

    // Namespace org profile fields
    if (orgData && typeof orgData === "object") {
      for (const [key, value] of Object.entries(orgData)) {
        merged[`org:${key}`] = value
      }
    }

    // Namespace activity form fields
    if (activityData && typeof activityData === "object") {
      for (const [key, value] of Object.entries(activityData)) {
        merged[`activity:${key}`] = value
      }
    }

    // Namespace session form fields
    if (sessionData && typeof sessionData === "object") {
      for (const [key, value] of Object.entries(sessionData)) {
        merged[`session:${key}`] = value
      }
    }

    // Namespace ranking fields
    if (rankingData) {
      merged["ranking:level"] = rankingData.levelName
      if (rankingData.levelOrder !== null && rankingData.levelOrder !== undefined) {
        merged["ranking:levelOrder"] = rankingData.levelOrder
      }
      if (rankingData.stats && typeof rankingData.stats === "object") {
        for (const [key, value] of Object.entries(rankingData.stats)) {
          merged[`ranking:stat:${key}`] = value
        }
      }

      // Effective attributes: session override ?? default
      const defaultAttrs = rankingData.attributes ?? {}
      const sessionOverrides = attrOverridesMap.get(uid) ?? null
      if (typeof defaultAttrs === "object") {
        for (const [key, value] of Object.entries(defaultAttrs)) {
          const effective = sessionOverrides?.[key] ?? value
          merged[`ranking:attr:${key}`] = effective
        }
      }
      // Also include any override keys not in defaults
      if (sessionOverrides && typeof sessionOverrides === "object") {
        for (const [key, value] of Object.entries(sessionOverrides)) {
          if (value !== null && merged[`ranking:attr:${key}`] === undefined) {
            merged[`ranking:attr:${key}`] = value
          }
        }
      }
    }

    return {
      userId: uid,
      userName: u?.name ?? null,
      userImage: u?.image ?? null,
      sources: {
        orgProfile: orgData,
        activityForm: activityData,
        sessionForm: sessionData,
        ranking: rankingData,
      },
      merged,
    }
  })
}

// =============================================================================
// Get Available Fields
// =============================================================================

export async function getAvailableFields(opts: {
  organizationId: string
  activityId: string
  sessionId?: string
}): Promise<AvailableField[]> {
  const { organizationId, activityId, sessionId } = opts
  const fields: AvailableField[] = []
  const labelCounts = new Map<string, number>()

  // Helper to collect fields from a form schema
  function collectFormFields(
    formSchema: JoinFormSchema | null | undefined,
    source: "org" | "activity" | "session"
  ) {
    if (!formSchema?.fields) return
    for (const field of formSchema.fields) {
      const label = field.label
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1)
      fields.push({
        sourceId: `${source}:${field.id}`,
        label,
        source,
        type: field.type,
        options: field.options,
      })
    }
  }

  // 1. Org-level form fields
  const [orgSettings] = await db
    .select({ joinFormSchema: organizationSettings.joinFormSchema })
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1)

  collectFormFields(orgSettings?.joinFormSchema as JoinFormSchema | null, "org")

  // 2. Activity-level form fields
  const [activityRecord] = await db
    .select({ joinFormSchema: activity.joinFormSchema })
    .from(activity)
    .where(
      and(eq(activity.id, activityId), eq(activity.organizationId, organizationId))
    )
    .limit(1)

  collectFormFields(activityRecord?.joinFormSchema as JoinFormSchema | null, "activity")

  // 3. Session-level form fields
  if (sessionId) {
    const [sessionRecord] = await db
      .select({ joinFormSchema: eventSession.joinFormSchema })
      .from(eventSession)
      .where(
        and(
          eq(eventSession.id, sessionId),
          eq(eventSession.organizationId, organizationId)
        )
      )
      .limit(1)

    collectFormFields(sessionRecord?.joinFormSchema as JoinFormSchema | null, "session")
  }

  // 4. Ranking fields (virtual)
  const [rankDef] = await db
    .select({ id: rankingDefinition.id, domainId: rankingDefinition.domainId })
    .from(rankingDefinition)
    .where(
      and(
        eq(rankingDefinition.activityId, activityId),
        eq(rankingDefinition.organizationId, organizationId)
      )
    )
    .limit(1)

  if (rankDef) {
    fields.push({
      sourceId: "ranking:level",
      label: "Level",
      source: "ranking",
      type: "ranking_level",
    })

    // Stat fields from domain definition
    const domain = getDomain(rankDef.domainId)
    if (domain) {
      for (const stat of domain.statFields) {
        fields.push({
          sourceId: `ranking:stat:${stat.id}`,
          label: stat.label,
          source: "ranking",
          type: "ranking_stat",
        })
      }

      // Attribute fields from domain definition
      if (domain.attributeFields) {
        for (const attr of domain.attributeFields) {
          fields.push({
            sourceId: `ranking:attr:${attr.id}`,
            label: attr.label,
            source: "ranking",
            type: "ranking_attribute",
            options: attr.options,
          })
        }
      }
    }
  }

  // Prefix labels that collide with source name
  const sourceLabels: Record<string, string> = {
    org: "Org",
    activity: "Activity",
    session: "Session",
    ranking: "Ranking",
  }

  for (const field of fields) {
    const count = labelCounts.get(field.label) ?? 0
    if (count > 1) {
      field.label = `${sourceLabels[field.source]}: ${field.label}`
    }
  }

  return fields
}

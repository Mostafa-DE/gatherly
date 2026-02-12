import { and, eq, sql, gte, lte, isNull, isNotNull, inArray } from "drizzle-orm"
import { db } from "@/db"
import { eventSession, participation, organizationSettings } from "@/db/schema"
import { member, user } from "@/db/auth-schema"
import type {
  GroupHealthStats,
  SessionPerformanceStats,
  AttendancePatternStats,
  RevenueStats,
  AnalyticsSummary,
  MemberGrowthPoint,
  CapacityTrendPoint,
  TopSession,
  ShowRateTrendPoint,
  PeakDay,
  TopAttendee,
  RevenueTrendPoint,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function getDateRange(days: number): { from: Date; to: Date } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - days)
  return { from, to }
}

function getPreviousPeriod(days: number): { from: Date; to: Date } {
  const to = new Date()
  to.setDate(to.getDate() - days)
  const from = new Date(to)
  from.setDate(from.getDate() - days)
  return { from, to }
}

/** Base filter: org-scoped, non-deleted, published/completed sessions in date range */
function sessionInRange(orgId: string, from: Date, to: Date) {
  return and(
    eq(eventSession.organizationId, orgId),
    isNull(eventSession.deletedAt),
    inArray(eventSession.status, ["published", "completed"]),
    gte(eventSession.dateTime, from),
    lte(eventSession.dateTime, to)
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Health
// ─────────────────────────────────────────────────────────────────────────────

export async function getGroupHealthStats(
  orgId: string,
  days: number
): Promise<GroupHealthStats> {
  const { from, to } = getDateRange(days)
  const prev = getPreviousPeriod(days)

  // Subquery: users who attended (show) in previous period
  const prevActiveSq = db
    .selectDistinct({ userId: participation.userId })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        sessionInRange(orgId, prev.from, prev.to),
        eq(participation.attendance, "show")
      )
    )

  // Run all independent queries in parallel
  const [memberCounts, activeResult, prevCountResult, retainedResult, growthRows] =
    await Promise.all([
      // Total members + new members in period
      db
        .select({
          total: sql<number>`count(*)::int`,
          newInPeriod: sql<number>`count(*) filter (where ${member.createdAt} >= ${from} and ${member.createdAt} <= ${to})::int`,
        })
        .from(member)
        .where(eq(member.organizationId, orgId))
        .then((rows) => rows[0]),

      // Active members: distinct users who showed up in current period
      db
        .select({
          count: sql<number>`count(distinct ${participation.userId})::int`,
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            eq(participation.attendance, "show")
          )
        )
        .then((rows) => rows[0]),

      // Previous period active user count (for retention denominator)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(prevActiveSq.as("prev_active"))
        .then((rows) => rows[0]),

      // Retained: current period attendees who also attended in prev period
      db
        .select({
          count: sql<number>`count(distinct ${participation.userId})::int`,
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            eq(participation.attendance, "show"),
            inArray(participation.userId, prevActiveSq)
          )
        )
        .then((rows) => rows[0]),

      // Member growth: new joins grouped by date
      db
        .select({
          date: sql<string>`date(${member.createdAt})`.as("date"),
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(member)
        .where(
          and(
            eq(member.organizationId, orgId),
            gte(member.createdAt, from),
            lte(member.createdAt, to)
          )
        )
        .groupBy(sql`date(${member.createdAt})`)
        .orderBy(sql`date(${member.createdAt})`),
    ])

  const totalMembers = memberCounts?.total ?? 0
  const newMembers = memberCounts?.newInPeriod ?? 0
  const activeMembers = activeResult?.count ?? 0
  const inactiveMembers = Math.max(0, totalMembers - activeMembers)
  const prevActive = prevCountResult?.count ?? 0
  const retained = retainedResult?.count ?? 0
  const retentionRate =
    prevActive > 0 ? Math.round((retained / prevActive) * 100) : 0

  const memberGrowth: MemberGrowthPoint[] = growthRows.map((r) => ({
    date: r.date,
    count: r.count,
  }))

  return {
    totalMembers,
    newMembers,
    activeMembers,
    inactiveMembers,
    retentionRate,
    memberGrowth,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Performance
// ─────────────────────────────────────────────────────────────────────────────

export async function getSessionPerformanceStats(
  orgId: string,
  days: number
): Promise<SessionPerformanceStats> {
  const { from, to } = getDateRange(days)

  // Single query: all sessions with joined/no-show/marked counts
  const sessionRows = await db
    .select({
      id: eventSession.id,
      title: eventSession.title,
      dateTime: eventSession.dateTime,
      maxCapacity: eventSession.maxCapacity,
      joinedCount: sql<number>`count(*) filter (where ${participation.status} = 'joined')::int`,
      noShowCount: sql<number>`count(*) filter (where ${participation.attendance} = 'no_show')::int`,
      markedCount: sql<number>`count(*) filter (where ${participation.attendance} in ('show', 'no_show'))::int`,
    })
    .from(eventSession)
    .leftJoin(participation, eq(participation.sessionId, eventSession.id))
    .where(sessionInRange(orgId, from, to))
    .groupBy(eventSession.id)
    .orderBy(eventSession.dateTime)

  const totalSessions = sessionRows.length

  let totalUtilization = 0
  let totalNoShowRate = 0
  let sessionsWithAttendance = 0
  const capacityTrend: CapacityTrendPoint[] = []

  for (const s of sessionRows) {
    const utilization =
      s.maxCapacity > 0 ? (s.joinedCount / s.maxCapacity) * 100 : 0
    totalUtilization += utilization

    capacityTrend.push({
      date: new Date(s.dateTime).toISOString().split("T")[0],
      title: s.title,
      utilization: Math.round(utilization),
    })

    if (s.markedCount > 0) {
      totalNoShowRate += (s.noShowCount / s.markedCount) * 100
      sessionsWithAttendance++
    }
  }

  const avgCapacityUtilization =
    totalSessions > 0 ? Math.round(totalUtilization / totalSessions) : 0
  const avgNoShowRate =
    sessionsWithAttendance > 0
      ? Math.round(totalNoShowRate / sessionsWithAttendance)
      : 0

  // Top 5 sessions by fill rate
  const topSessions: TopSession[] = sessionRows
    .map((s) => ({
      id: s.id,
      title: s.title,
      date: new Date(s.dateTime).toISOString().split("T")[0],
      fillRate:
        s.maxCapacity > 0
          ? Math.round((s.joinedCount / s.maxCapacity) * 100)
          : 0,
      joinedCount: s.joinedCount,
      maxCapacity: s.maxCapacity,
    }))
    .sort((a, b) => b.fillRate - a.fillRate)
    .slice(0, 5)

  return {
    totalSessions,
    avgCapacityUtilization,
    avgNoShowRate,
    capacityTrend,
    topSessions,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Patterns
// ─────────────────────────────────────────────────────────────────────────────

export async function getAttendancePatternStats(
  orgId: string,
  days: number
): Promise<AttendancePatternStats> {
  const { from, to } = getDateRange(days)

  // Subquery: per-user session counts (for repeat rate)
  const userSessionsSq = db
    .select({
      userId: participation.userId,
      sessionCount: sql<number>`count(distinct ${eventSession.id})::int`.as(
        "session_count"
      ),
    })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        sessionInRange(orgId, from, to),
        eq(participation.attendance, "show")
      )
    )
    .groupBy(participation.userId)
    .as("user_sessions")

  // Run all independent queries in parallel
  const [showMarkResult, repeatResult, trendRows, dayRows, attendeeRows] =
    await Promise.all([
      // Overall shows + marked counts
      db
        .select({
          totalShows: sql<number>`count(*) filter (where ${participation.attendance} = 'show')::int`,
          totalMarked: sql<number>`count(*)::int`,
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            inArray(participation.attendance, ["show", "no_show"])
          )
        )
        .then((rows) => rows[0]),

      // Repeat rate via derived table
      db
        .select({
          totalAttendees: sql<number>`count(*)::int`,
          repeatAttendees: sql<number>`count(*) filter (where ${userSessionsSq.sessionCount} >= 2)::int`,
        })
        .from(userSessionsSq)
        .then((rows) => rows[0]),

      // Show rate trend grouped by week
      db
        .select({
          weekStart: sql<string>`date_trunc('week', ${eventSession.dateTime})::date::text`.as(
            "week_start"
          ),
          shows: sql<number>`count(*) filter (where ${participation.attendance} = 'show')::int`,
          marked: sql<number>`count(*)::int`,
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            inArray(participation.attendance, ["show", "no_show"])
          )
        )
        .groupBy(sql`date_trunc('week', ${eventSession.dateTime})`)
        .orderBy(sql`date_trunc('week', ${eventSession.dateTime})`),

      // Peak days: attendance by day of week
      db
        .select({
          dow: sql<number>`extract(dow from ${eventSession.dateTime})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            eq(participation.attendance, "show")
          )
        )
        .groupBy(sql`extract(dow from ${eventSession.dateTime})`)
        .orderBy(sql`extract(dow from ${eventSession.dateTime})`),

      // Top 5 attendees
      db
        .select({
          userId: participation.userId,
          name: user.name,
          image: user.image,
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .innerJoin(user, eq(participation.userId, user.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            eq(participation.attendance, "show")
          )
        )
        .groupBy(participation.userId, user.name, user.image)
        .orderBy(sql`count(*) desc`)
        .limit(5),
    ])

  const totalShows = showMarkResult?.totalShows ?? 0
  const totalMarked = showMarkResult?.totalMarked ?? 0
  const totalAttendees = repeatResult?.totalAttendees ?? 0
  const repeatAttendees = repeatResult?.repeatAttendees ?? 0

  const overallShowRate =
    totalMarked > 0 ? Math.round((totalShows / totalMarked) * 100) : 0
  const repeatRate =
    totalAttendees > 0
      ? Math.round((repeatAttendees / totalAttendees) * 100)
      : 0

  const showRateTrend: ShowRateTrendPoint[] = trendRows.map((r) => ({
    date: r.weekStart,
    rate: r.marked > 0 ? Math.round((r.shows / r.marked) * 100) : 0,
  }))

  const peakDays: PeakDay[] = dayRows.map((r) => ({
    day: DAY_NAMES[r.dow] ?? "Unknown",
    dayIndex: r.dow,
    count: r.count,
  }))

  const topAttendees: TopAttendee[] = attendeeRows.map((r) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    count: r.count,
  }))

  return {
    overallShowRate,
    showRateTrend,
    peakDays,
    topAttendees,
    repeatRate,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue
// ─────────────────────────────────────────────────────────────────────────────

export async function getRevenueStats(
  orgId: string,
  days: number
): Promise<RevenueStats> {
  const { from, to } = getDateRange(days)

  const [settings, revenueAgg, revenueTrendRows] = await Promise.all([
    // Org currency
    db
      .select({ currency: organizationSettings.currency })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1)
      .then((rows) => rows[0]),

    // All revenue metrics in one aggregation query
    db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${eventSession.price}::numeric) filter (where ${participation.payment} = 'paid' and ${participation.status} = 'joined'), 0)::float`,
        pricedSessions: sql<number>`count(distinct ${eventSession.id}) filter (where ${eventSession.price} is not null and ${eventSession.price}::numeric > 0)::int`,
        paidCount: sql<number>`count(*) filter (where ${participation.payment} = 'paid' and ${participation.status} = 'joined' and ${eventSession.price} is not null and ${eventSession.price}::numeric > 0)::int`,
        totalJoinedPriced: sql<number>`count(*) filter (where ${participation.status} = 'joined' and ${eventSession.price} is not null and ${eventSession.price}::numeric > 0)::int`,
        outstandingCount: sql<number>`count(*) filter (where ${participation.payment} = 'unpaid' and ${participation.status} = 'joined' and ${eventSession.price} is not null and ${eventSession.price}::numeric > 0)::int`,
        outstandingAmount: sql<number>`coalesce(sum(${eventSession.price}::numeric) filter (where ${participation.payment} = 'unpaid' and ${participation.status} = 'joined' and ${eventSession.price} is not null and ${eventSession.price}::numeric > 0), 0)::float`,
      })
      .from(participation)
      .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
      .where(sessionInRange(orgId, from, to))
      .then((rows) => rows[0]),

    // Revenue trend by week
    db
      .select({
        weekStart: sql<string>`date_trunc('week', ${eventSession.dateTime})::date::text`.as(
          "week_start"
        ),
        amount: sql<number>`coalesce(sum(${eventSession.price}::numeric) filter (where ${participation.payment} = 'paid' and ${participation.status} = 'joined'), 0)::float`,
      })
      .from(participation)
      .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
      .where(
        and(
          sessionInRange(orgId, from, to),
          isNotNull(eventSession.price),
          sql`${eventSession.price}::numeric > 0`
        )
      )
      .groupBy(sql`date_trunc('week', ${eventSession.dateTime})`)
      .orderBy(sql`date_trunc('week', ${eventSession.dateTime})`),
  ])

  const totalRevenue = revenueAgg?.totalRevenue ?? 0
  const pricedSessions = revenueAgg?.pricedSessions ?? 0
  const paidCount = revenueAgg?.paidCount ?? 0
  const totalJoinedPriced = revenueAgg?.totalJoinedPriced ?? 0
  const outstandingCount = revenueAgg?.outstandingCount ?? 0
  const outstandingAmount = revenueAgg?.outstandingAmount ?? 0

  const avgRevenuePerSession =
    pricedSessions > 0
      ? Math.round((totalRevenue / pricedSessions) * 100) / 100
      : 0
  const collectionRate =
    totalJoinedPriced > 0
      ? Math.round((paidCount / totalJoinedPriced) * 100)
      : 0

  const revenueTrend: RevenueTrendPoint[] = revenueTrendRows.map((r) => ({
    date: r.weekStart,
    amount: r.amount,
  }))

  return {
    totalRevenue,
    avgRevenuePerSession,
    collectionRate,
    outstandingCount,
    outstandingAmount,
    revenueTrend,
    currency: settings?.currency ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary (for overview widget)
// ─────────────────────────────────────────────────────────────────────────────

export async function getAnalyticsSummary(
  orgId: string,
  days: number
): Promise<AnalyticsSummary> {
  const { from, to } = getDateRange(days)

  // All independent queries in parallel
  const [memberResult, sessionUtilRows, showResult, revenueResult, settings] =
    await Promise.all([
      // Total members
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(member)
        .where(eq(member.organizationId, orgId))
        .then((rows) => rows[0]),

      // Sessions with joined counts (for avg utilization)
      db
        .select({
          maxCapacity: eventSession.maxCapacity,
          joinedCount: sql<number>`count(*) filter (where ${participation.status} = 'joined')::int`,
        })
        .from(eventSession)
        .leftJoin(participation, eq(participation.sessionId, eventSession.id))
        .where(sessionInRange(orgId, from, to))
        .groupBy(eventSession.id),

      // Show rate: total shows and marked
      db
        .select({
          shows: sql<number>`count(*) filter (where ${participation.attendance} = 'show')::int`,
          marked: sql<number>`count(*)::int`,
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            inArray(participation.attendance, ["show", "no_show"])
          )
        )
        .then((rows) => rows[0]),

      // Revenue total
      db
        .select({
          total: sql<number>`coalesce(sum(${eventSession.price}::numeric), 0)::float`,
        })
        .from(participation)
        .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
        .where(
          and(
            sessionInRange(orgId, from, to),
            eq(participation.payment, "paid"),
            eq(participation.status, "joined"),
            isNotNull(eventSession.price),
            sql`${eventSession.price}::numeric > 0`
          )
        )
        .then((rows) => rows[0]),

      // Currency
      db
        .select({ currency: organizationSettings.currency })
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, orgId))
        .limit(1)
        .then((rows) => rows[0]),
    ])

  const totalMembers = memberResult?.count ?? 0

  // Compute avg utilization from session rows
  let totalUtil = 0
  for (const s of sessionUtilRows) {
    if (s.maxCapacity > 0) totalUtil += (s.joinedCount / s.maxCapacity) * 100
  }
  const avgCapacityUtilization =
    sessionUtilRows.length > 0
      ? Math.round(totalUtil / sessionUtilRows.length)
      : 0

  const totalShows = showResult?.shows ?? 0
  const totalMarked = showResult?.marked ?? 0

  return {
    totalMembers,
    avgCapacityUtilization,
    overallShowRate:
      totalMarked > 0 ? Math.round((totalShows / totalMarked) * 100) : 0,
    totalRevenue: revenueResult?.total ?? 0,
    currency: settings?.currency ?? null,
  }
}

import { and, eq, sql, gt, isNull } from "drizzle-orm"
import { db } from "@/db"
import { participation, eventSession } from "@/db/schema"

export type EngagementStats = {
  sessionsAttended: number
  noShows: number
  totalCompleted: number
  attendanceRate: number
  upcomingSessions: number
}

export async function getEngagementStats(
  userId: string,
  organizationId: string
): Promise<EngagementStats> {
  // Sessions attended: attendance = 'show'
  const [attendedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        eq(participation.userId, userId),
        eq(eventSession.organizationId, organizationId),
        eq(participation.attendance, "show")
      )
    )

  // No-shows: attendance = 'no_show'
  const [noShowResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        eq(participation.userId, userId),
        eq(eventSession.organizationId, organizationId),
        eq(participation.attendance, "no_show")
      )
    )

  // Upcoming sessions: status IN ('joined', 'waitlisted') AND session in the future and not cancelled/deleted
  const [upcomingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participation)
    .innerJoin(eventSession, eq(participation.sessionId, eventSession.id))
    .where(
      and(
        eq(participation.userId, userId),
        eq(eventSession.organizationId, organizationId),
        sql`${participation.status} IN ('joined', 'waitlisted')`,
        gt(eventSession.dateTime, new Date()),
        sql`${eventSession.status} != 'cancelled'`,
        isNull(eventSession.deletedAt)
      )
    )

  const sessionsAttended = attendedResult?.count ?? 0
  const noShows = noShowResult?.count ?? 0
  const totalCompleted = sessionsAttended + noShows
  const attendanceRate =
    totalCompleted > 0
      ? Math.round((sessionsAttended / totalCompleted) * 100)
      : 0

  return {
    sessionsAttended,
    noShows,
    totalCompleted,
    attendanceRate,
    upcomingSessions: upcomingResult?.count ?? 0,
  }
}

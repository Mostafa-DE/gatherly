import { and, eq, desc, sql } from "drizzle-orm"
import { db } from "@/db"
import { tournament } from "../schema"
import { NotFoundError, BadRequestError, ConflictError } from "@/exceptions"
import type { TournamentStatus } from "../types"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

function isUniqueConstraintError(
  error: unknown,
  constraintName?: string
): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const candidate = error as {
    code?: string
    constraint?: string
    cause?: unknown
  }

  if (candidate.code === "23505") {
    return constraintName
      ? candidate.constraint === constraintName
      : true
  }

  if (candidate.cause && typeof candidate.cause === "object") {
    const cause = candidate.cause as {
      code?: string
      constraint?: string
    }
    if (cause.code === "23505") {
      return constraintName ? cause.constraint === constraintName : true
    }
  }

  return false
}

// =============================================================================
// Queries
// =============================================================================

export async function getTournamentById(
  tournamentId: string,
  organizationId: string
) {
  const [result] = await db
    .select()
    .from(tournament)
    .where(
      and(
        eq(tournament.id, tournamentId),
        eq(tournament.organizationId, organizationId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function getTournamentByIdForUpdate(
  tx: DbTransaction,
  tournamentId: string,
  organizationId: string
) {
  const result = await tx.execute<{
    id: string
    organization_id: string
    activity_id: string
    name: string
    slug: string
    format: string
    status: string
    visibility: string
    participant_type: string
    seeding_method: string
    config: Record<string, unknown>
    version: number
  }>(sql`
    SELECT id, organization_id, activity_id, name, slug, format, status,
           visibility, participant_type, seeding_method, config, version
    FROM tournament
    WHERE id = ${tournamentId} AND organization_id = ${organizationId}
    FOR UPDATE
  `)
  return result.rows[0] ?? null
}

export async function listTournamentsByActivity(
  activityId: string,
  organizationId: string,
  options: {
    status?: TournamentStatus
    limit: number
    offset: number
  }
) {
  const conditions = [
    eq(tournament.activityId, activityId),
    eq(tournament.organizationId, organizationId),
  ]

  if (options.status) {
    conditions.push(eq(tournament.status, options.status))
  }

  return db
    .select()
    .from(tournament)
    .where(and(...conditions))
    .orderBy(desc(tournament.createdAt))
    .limit(options.limit)
    .offset(options.offset)
}

// =============================================================================
// Mutations
// =============================================================================

export async function createTournament(
  organizationId: string,
  createdBy: string,
  data: {
    activityId: string
    name: string
    slug: string
    format: string
    visibility?: string
    participantType?: string
    seedingMethod?: string
    config?: Record<string, unknown>
    startsAt?: Date
    registrationOpensAt?: Date
    registrationClosesAt?: Date
  }
) {
  try {
    const [result] = await db
      .insert(tournament)
      .values({
        organizationId,
        createdBy,
        activityId: data.activityId,
        name: data.name,
        slug: data.slug,
        format: data.format,
        visibility: data.visibility ?? "activity_members",
        participantType: data.participantType ?? "individual",
        seedingMethod:
          data.seedingMethod ??
          (data.participantType === "team" ? "manual" : "ranking"),
        config: data.config ?? {},
        startsAt: data.startsAt,
        registrationOpensAt: data.registrationOpensAt,
        registrationClosesAt: data.registrationClosesAt,
      })
      .returning()
    return result
  } catch (error) {
    if (isUniqueConstraintError(error, "tournament_activity_slug_idx")) {
      throw new ConflictError("A tournament with this slug already exists in this activity")
    }
    throw error
  }
}

export async function updateTournament(
  tournamentId: string,
  organizationId: string,
  expectedVersion: number,
  data: {
    name?: string
    slug?: string
    visibility?: string
    seedingMethod?: string
    config?: Record<string, unknown>
    startsAt?: Date | null
    registrationOpensAt?: Date | null
    registrationClosesAt?: Date | null
  }
) {
  let result
  try {
    const updated = await db
      .update(tournament)
      .set({
        ...data,
        version: sql`${tournament.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tournament.id, tournamentId),
          eq(tournament.organizationId, organizationId),
          eq(tournament.version, expectedVersion)
        )
      )
      .returning()
    result = updated[0]
  } catch (error) {
    if (isUniqueConstraintError(error, "tournament_activity_slug_idx")) {
      throw new ConflictError("A tournament with this slug already exists in this activity")
    }
    throw error
  }

  if (!result) {
    throw new ConflictError(
      "Tournament was modified by another request. Please refresh and try again."
    )
  }

  return result
}

export async function updateTournamentStatus(
  tx: DbTransaction,
  tournamentId: string,
  organizationId: string,
  status: TournamentStatus
) {
  const [result] = await tx
    .update(tournament)
    .set({
      status,
      version: sql`${tournament.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tournament.id, tournamentId),
        eq(tournament.organizationId, organizationId)
      )
    )
    .returning()

  if (!result) {
    throw new NotFoundError("Tournament not found")
  }

  return result
}

export async function deleteDraftTournament(
  tournamentId: string,
  organizationId: string
) {
  const [result] = await db
    .delete(tournament)
    .where(
      and(
        eq(tournament.id, tournamentId),
        eq(tournament.organizationId, organizationId),
        eq(tournament.status, "draft")
      )
    )
    .returning()

  if (!result) {
    throw new BadRequestError(
      "Tournament not found or is not in draft status"
    )
  }

  return result
}

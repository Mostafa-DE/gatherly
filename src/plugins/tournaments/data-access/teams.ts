import { and, eq, ne, count, sql, inArray } from "drizzle-orm"
import { db } from "@/db"
import { user } from "@/db/auth-schema"
import { tournament, tournamentTeam, tournamentTeamMember, tournamentEntry } from "../schema"
import { NotFoundError, BadRequestError, ConflictError } from "@/exceptions"
import type { TournamentConfig } from "../types"
import { getRunDetails } from "@/plugins/smart-groups/data-access/runs"
import { smartGroupConfig } from "@/plugins/smart-groups/schema"

function isUniqueConstraintError(error: unknown): boolean {
  return (error as { code?: string })?.code === "23505"
}

// =============================================================================
// Queries
// =============================================================================

export async function getTeamById(teamId: string, organizationId: string) {
  const [result] = await db
    .select()
    .from(tournamentTeam)
    .where(
      and(
        eq(tournamentTeam.id, teamId),
        eq(tournamentTeam.organizationId, organizationId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function getTeamByIdForTournament(
  teamId: string,
  organizationId: string,
  tournamentId: string
) {
  const [result] = await db
    .select()
    .from(tournamentTeam)
    .where(
      and(
        eq(tournamentTeam.id, teamId),
        eq(tournamentTeam.organizationId, organizationId),
        eq(tournamentTeam.tournamentId, tournamentId)
      )
    )
    .limit(1)
  return result ?? null
}

export async function listTeamsByTournament(
  tournamentId: string,
  organizationId: string
) {
  return db
    .select()
    .from(tournamentTeam)
    .where(
      and(
        eq(tournamentTeam.tournamentId, tournamentId),
        eq(tournamentTeam.organizationId, organizationId)
      )
    )
    .orderBy(tournamentTeam.createdAt)
}

export async function getTeamMembers(teamId: string) {
  return db
    .select()
    .from(tournamentTeamMember)
    .where(eq(tournamentTeamMember.teamId, teamId))
}

export async function getTeamMemberCount(teamId: string) {
  const [result] = await db
    .select({ memberCount: count() })
    .from(tournamentTeamMember)
    .where(eq(tournamentTeamMember.teamId, teamId))
  return result.memberCount
}

export async function listTeamsWithMembers(
  tournamentId: string,
  organizationId: string
) {
  const teams = await listTeamsByTournament(tournamentId, organizationId)
  if (teams.length === 0) return []

  const teamIds = teams.map((t) => t.id)
  const allMembers = await db
    .select({
      id: tournamentTeamMember.id,
      teamId: tournamentTeamMember.teamId,
      userId: tournamentTeamMember.userId,
      role: tournamentTeamMember.role,
      createdAt: tournamentTeamMember.createdAt,
      name: user.name,
      image: user.image,
    })
    .from(tournamentTeamMember)
    .innerJoin(user, eq(tournamentTeamMember.userId, user.id))
    .where(inArray(tournamentTeamMember.teamId, teamIds))

  const membersByTeam = new Map<string, typeof allMembers>()
  for (const member of allMembers) {
    const existing = membersByTeam.get(member.teamId) ?? []
    existing.push(member)
    membersByTeam.set(member.teamId, existing)
  }

  return teams.map((team) => ({
    ...team,
    members: membersByTeam.get(team.id) ?? [],
  }))
}

// =============================================================================
// Mutations
// =============================================================================

export async function createTeam(
  organizationId: string,
  tournamentId: string,
  name: string,
  captainUserId: string
) {
  // Verify tournament is team-based and accepting registrations
  const [t] = await db
    .select()
    .from(tournament)
    .where(
      and(
        eq(tournament.id, tournamentId),
        eq(tournament.organizationId, organizationId)
      )
    )
    .limit(1)

  if (!t) throw new NotFoundError("Tournament not found")
  if (t.participantType !== "team") {
    throw new BadRequestError("This tournament is for individual participants")
  }
  if (t.status !== "registration" && t.status !== "check_in" && t.status !== "draft") {
    throw new BadRequestError("Tournament is not accepting new teams")
  }

  // Check captain isn't already on another team in this tournament
  await assertUserNotOnTeam(tournamentId, captainUserId)

  const [result] = await db
    .insert(tournamentTeam)
    .values({
      organizationId,
      tournamentId,
      name,
      captainUserId,
    })
    .returning()

  // Auto-add captain as team member
  await db.insert(tournamentTeamMember).values({
    teamId: result.id,
    userId: captainUserId,
    role: "captain",
  })

  return result
}

export async function joinTeam(
  tournamentId: string,
  organizationId: string,
  teamId: string,
  userId: string
) {
  const team = await getTeamByIdForTournament(teamId, organizationId, tournamentId)
  if (!team) throw new NotFoundError("Team not found")

  // Check tournament is still accepting
  const [t] = await db
    .select()
    .from(tournament)
    .where(eq(tournament.id, tournamentId))
    .limit(1)

  if (!t || (t.status !== "registration" && t.status !== "check_in" && t.status !== "draft")) {
    throw new BadRequestError("Tournament is not accepting team changes")
  }

  // Check user isn't already on another team
  await assertUserNotOnTeam(tournamentId, userId)

  // Check team isn't full
  const config = (t.config ?? {}) as TournamentConfig
  if (config.maxTeamSize) {
    const memberCount = await getTeamMemberCount(teamId)
    if (memberCount >= config.maxTeamSize) {
      throw new ConflictError("Team is full")
    }
  }

  try {
    const [result] = await db
      .insert(tournamentTeamMember)
      .values({ teamId, userId, role: "player" })
      .returning()
    return result
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError("User is already on this team")
    }
    throw error
  }
}

export async function leaveTeam(
  tournamentId: string,
  organizationId: string,
  teamId: string,
  userId: string
) {
  const team = await getTeamByIdForTournament(teamId, organizationId, tournamentId)
  if (!team) throw new NotFoundError("Team not found")

  if (team.captainUserId === userId) {
    throw new BadRequestError("Captain cannot leave the team. Transfer captainship first or delete the team.")
  }

  const [result] = await db
    .delete(tournamentTeamMember)
    .where(
      and(
        eq(tournamentTeamMember.teamId, teamId),
        eq(tournamentTeamMember.userId, userId)
      )
    )
    .returning()

  if (!result) throw new NotFoundError("Team member not found")
  return result
}

export async function removeTeamMember(
  tournamentId: string,
  organizationId: string,
  teamId: string,
  userId: string
) {
  const team = await getTeamByIdForTournament(teamId, organizationId, tournamentId)
  if (!team) throw new NotFoundError("Team not found")

  if (team.captainUserId === userId) {
    throw new BadRequestError("Cannot remove the team captain")
  }

  const [result] = await db
    .delete(tournamentTeamMember)
    .where(
      and(
        eq(tournamentTeamMember.teamId, teamId),
        eq(tournamentTeamMember.userId, userId)
      )
    )
    .returning()

  if (!result) throw new NotFoundError("Team member not found")
  return result
}

export async function registerTeamEntry(
  tournamentId: string,
  organizationId: string,
  teamId: string,
  options?: { allowDraft?: boolean }
) {
  return db.transaction(async (tx) => {
    // Lock tournament for capacity check
    const tournamentResult = await tx.execute<{
      id: string
      status: string
      config: TournamentConfig
      participant_type: string
    }>(sql`
      SELECT id, status, config, participant_type
      FROM tournament
      WHERE id = ${tournamentId} AND organization_id = ${organizationId}
      FOR UPDATE
    `)
    const t = tournamentResult.rows[0]

    if (!t) throw new NotFoundError("Tournament not found")
    if (t.participant_type !== "team") {
      throw new BadRequestError("This tournament is for individual participants")
    }
    const allowedStatuses = ["registration", "check_in"]
    if (options?.allowDraft) allowedStatuses.push("draft")
    if (!allowedStatuses.includes(t.status)) {
      throw new BadRequestError("Tournament is not accepting registrations")
    }

    // Verify team belongs to this tournament
    const [team] = await tx
      .select()
      .from(tournamentTeam)
      .where(
        and(
          eq(tournamentTeam.id, teamId),
          eq(tournamentTeam.tournamentId, tournamentId),
          eq(tournamentTeam.organizationId, organizationId)
        )
      )
      .limit(1)

    if (!team) throw new NotFoundError("Team not found in this tournament")

    // Check team size
    const [{ memberCount }] = await tx
      .select({ memberCount: count() })
      .from(tournamentTeamMember)
      .where(eq(tournamentTeamMember.teamId, teamId))

    const config = t.config ?? {}
    if (config.minTeamSize && memberCount < config.minTeamSize) {
      throw new BadRequestError(
        `Team needs at least ${config.minTeamSize} members (currently ${memberCount})`
      )
    }
    if (config.maxTeamSize && memberCount > config.maxTeamSize) {
      throw new BadRequestError(
        `Team exceeds maximum size of ${config.maxTeamSize} members (currently ${memberCount})`
      )
    }

    // Check idempotency
    const [existing] = await tx
      .select()
      .from(tournamentEntry)
      .where(
        and(
          eq(tournamentEntry.tournamentId, tournamentId),
          eq(tournamentEntry.teamId, teamId),
          ne(tournamentEntry.status, "withdrawn")
        )
      )
      .limit(1)

    if (existing) return existing

    // Capacity check
    if (config.maxCapacity) {
      const [{ entryCount }] = await tx
        .select({ entryCount: count() })
        .from(tournamentEntry)
        .where(
          and(
            eq(tournamentEntry.tournamentId, tournamentId),
            ne(tournamentEntry.status, "withdrawn")
          )
        )

      if (entryCount >= config.maxCapacity) {
        throw new ConflictError("Tournament is full")
      }
    }

    try {
      const [entry] = await tx
        .insert(tournamentEntry)
        .values({
          organizationId,
          tournamentId,
          teamId,
          status: "registered",
        })
        .returning()
      return entry
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const [existing] = await tx
          .select()
          .from(tournamentEntry)
          .where(
            and(
              eq(tournamentEntry.tournamentId, tournamentId),
              eq(tournamentEntry.teamId, teamId),
              ne(tournamentEntry.status, "withdrawn")
            )
          )
        if (existing) return existing
      }
      throw error
    }
  })
}

export async function createTeamsFromSmartGroupRun(
  organizationId: string,
  tournamentId: string,
  smartGroupRunId: string
) {
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(tournament)
      .where(
        and(
          eq(tournament.id, tournamentId),
          eq(tournament.organizationId, organizationId)
        )
      )
      .limit(1)

    if (!t) throw new NotFoundError("Tournament not found")
    if (t.participantType !== "team") {
      throw new BadRequestError("Smart Groups can only create teams for team tournaments")
    }
    if (t.status !== "registration" && t.status !== "check_in" && t.status !== "draft") {
      throw new BadRequestError("Tournament is not accepting team changes")
    }

    const [existingTeamCount] = await tx
      .select({ count: count() })
      .from(tournamentTeam)
      .where(eq(tournamentTeam.tournamentId, tournamentId))

    if ((existingTeamCount?.count ?? 0) > 0) {
      throw new BadRequestError(
        "Tournament already has teams. Clear them before importing from Smart Groups."
      )
    }

    const runDetails = await getRunDetails(smartGroupRunId, organizationId)
    if (!runDetails) {
      throw new NotFoundError("Smart group run not found")
    }
    if (runDetails.run.status !== "confirmed") {
      throw new BadRequestError("Smart group run must be confirmed before creating teams")
    }
    if (runDetails.run.scope !== "activity") {
      throw new BadRequestError("Only activity smart group runs can create tournament teams")
    }
    if (runDetails.run.excludedCount > 0) {
      throw new BadRequestError(
        "Smart group run has excluded members. Use a confirmed run without exclusions."
      )
    }

    const [sgConfig] = await tx
      .select({ activityId: smartGroupConfig.activityId })
      .from(smartGroupConfig)
      .where(eq(smartGroupConfig.id, runDetails.run.smartGroupConfigId))
      .limit(1)

    if (!sgConfig || sgConfig.activityId !== t.activityId) {
      throw new BadRequestError("Smart group run does not belong to this tournament's activity")
    }

    const config = (t.config ?? {}) as TournamentConfig
    const sortedProposals = [...runDetails.proposals].sort((a, b) => a.groupIndex - b.groupIndex)

    if (sortedProposals.length === 0) {
      throw new BadRequestError("Smart group run has no groups to import")
    }

    const seenUserIds = new Set<string>()
    const createdTeams: Array<{
      id: string
      name: string
      captainUserId: string
      memberCount: number
    }> = []

    for (const proposal of sortedProposals) {
      const memberIds = ((proposal.modifiedMemberIds ?? proposal.memberIds) as string[]) ?? []

      if (memberIds.length === 0) {
        throw new BadRequestError(`Group "${proposal.groupName}" has no members`)
      }
      if (config.minTeamSize && memberIds.length < config.minTeamSize) {
        throw new BadRequestError(
          `Group "${proposal.groupName}" has ${memberIds.length} members, below the minimum team size of ${config.minTeamSize}`
        )
      }
      if (config.maxTeamSize && memberIds.length > config.maxTeamSize) {
        throw new BadRequestError(
          `Group "${proposal.groupName}" has ${memberIds.length} members, above the maximum team size of ${config.maxTeamSize}`
        )
      }

      for (const userId of memberIds) {
        if (seenUserIds.has(userId)) {
          throw new BadRequestError("Smart group run contains duplicate members across groups")
        }
        seenUserIds.add(userId)
      }

      const [captainUserId, ...memberUserIds] = memberIds
      const [teamRow] = await tx
        .insert(tournamentTeam)
        .values({
          organizationId,
          tournamentId,
          name: proposal.groupName,
          captainUserId,
        })
        .returning()

      await tx.insert(tournamentTeamMember).values({
        teamId: teamRow.id,
        userId: captainUserId,
        role: "captain",
      })

      if (memberUserIds.length > 0) {
        await tx.insert(tournamentTeamMember).values(
          memberUserIds.map((userId) => ({
            teamId: teamRow.id,
            userId,
            role: "player" as const,
          }))
        )
      }

      createdTeams.push({
        id: teamRow.id,
        name: teamRow.name,
        captainUserId,
        memberCount: memberIds.length,
      })
    }

    return {
      created: createdTeams.length,
      teams: createdTeams,
    }
  })
}

// =============================================================================
// Helpers
// =============================================================================

async function assertUserNotOnTeam(tournamentId: string, userId: string) {
  const [existing] = await db
    .select({ teamId: tournamentTeamMember.teamId })
    .from(tournamentTeamMember)
    .innerJoin(tournamentTeam, eq(tournamentTeamMember.teamId, tournamentTeam.id))
    .where(
      and(
        eq(tournamentTeam.tournamentId, tournamentId),
        eq(tournamentTeamMember.userId, userId)
      )
    )
    .limit(1)

  if (existing) {
    throw new ConflictError("User is already on a team in this tournament")
  }
}

import { relations, sql } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  numeric,
  check,
} from "drizzle-orm/pg-core"
import { createId } from "@paralleldrive/cuid2"
import { user, organization } from "@/db/auth-schema"
import { activity } from "@/db/schema"

// =============================================================================
// Tournament
// =============================================================================

export const tournament = pgTable(
  "tournament",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    activityId: text("activity_id")
      .notNull()
      .references(() => activity.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    format: text("format").notNull(), // TournamentFormat
    status: text("status").default("draft").notNull(), // TournamentStatus
    visibility: text("visibility").default("activity_members").notNull(), // Visibility
    participantType: text("participant_type").default("individual").notNull(), // ParticipantType
    seedingMethod: text("seeding_method").default("manual").notNull(), // SeedingMethod
    entryFeeAmount: numeric("entry_fee_amount", { precision: 10, scale: 2 }),
    currency: text("currency"),
    config: jsonb("config").default({}).notNull(), // TournamentConfig
    startsAt: timestamp("starts_at", { withTimezone: true }),
    registrationOpensAt: timestamp("registration_opens_at", { withTimezone: true }),
    registrationClosesAt: timestamp("registration_closes_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("tournament_activity_slug_idx").on(table.activityId, table.slug),
    index("tournament_activity_status_idx").on(
      table.activityId,
      table.status,
      table.startsAt
    ),
    index("tournament_org_status_idx").on(table.organizationId, table.status),
  ]
)

// =============================================================================
// Tournament Stage
// =============================================================================

export const tournamentStage = pgTable(
  "tournament_stage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    stageType: text("stage_type").notNull(), // StageType
    stageOrder: integer("stage_order").notNull(),
    status: text("status").default("pending").notNull(), // StageStatus
    config: jsonb("config").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("tournament_stage_order_idx").on(table.tournamentId, table.stageOrder),
    index("tournament_stage_tournament_idx").on(table.tournamentId),
    index("tournament_stage_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Tournament Group (within a stage)
// =============================================================================

export const tournamentGroup = pgTable(
  "tournament_group",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    stageId: text("stage_id")
      .notNull()
      .references(() => tournamentStage.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    groupOrder: integer("group_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tournament_group_stage_order_idx").on(table.stageId, table.groupOrder),
    index("tournament_group_stage_idx").on(table.stageId),
  ]
)

// =============================================================================
// Tournament Round
// =============================================================================

export const tournamentRound = pgTable(
  "tournament_round",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => tournamentStage.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => tournamentGroup.id, {
      onDelete: "cascade",
    }),
    roundNumber: integer("round_number").notNull(),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Split partial unique indexes for null/non-null groupId
    uniqueIndex("tournament_round_stage_no_group_idx")
      .on(table.stageId, table.roundNumber)
      .where(sql`group_id IS NULL`),
    uniqueIndex("tournament_round_stage_group_idx")
      .on(table.stageId, table.groupId, table.roundNumber)
      .where(sql`group_id IS NOT NULL`),
    index("tournament_round_stage_idx").on(table.stageId),
    index("tournament_round_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Tournament Match
// =============================================================================

export const tournamentMatch = pgTable(
  "tournament_match",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    roundId: text("round_id")
      .notNull()
      .references(() => tournamentRound.id, { onDelete: "cascade" }),
    matchNumber: integer("match_number").notNull(),
    status: text("status").default("pending").notNull(), // MatchStatus
    scores: jsonb("scores"), // format-specific scores
    winnerEntryId: text("winner_entry_id"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("tournament_match_tournament_status_idx").on(
      table.tournamentId,
      table.status,
      table.scheduledAt
    ),
    index("tournament_match_round_idx").on(table.roundId, table.matchNumber),
    index("tournament_match_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Tournament Match Edge (progression graph)
// =============================================================================

export const tournamentMatchEdge = pgTable(
  "tournament_match_edge",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    fromMatchId: text("from_match_id")
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
    toMatchId: text("to_match_id")
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
    outcomeType: text("outcome_type").notNull(), // MatchEdgeOutcomeType
    outcomeRank: integer("outcome_rank"), // for placement-based flows
    toSlot: integer("to_slot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tournament_match_edge_to_slot_idx").on(table.toMatchId, table.toSlot),
    index("tournament_match_edge_from_idx").on(table.fromMatchId),
    uniqueIndex("tournament_match_edge_from_outcome_idx")
      .on(table.fromMatchId, table.outcomeType, table.outcomeRank)
      .where(sql`outcome_rank IS NOT NULL`),
    uniqueIndex("tournament_match_edge_from_outcome_no_rank_idx")
      .on(table.fromMatchId, table.outcomeType)
      .where(sql`outcome_rank IS NULL`),
  ]
)

// =============================================================================
// Tournament Entry (participant registration)
// =============================================================================

export const tournamentEntry = pgTable(
  "tournament_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => tournamentTeam.id, {
      onDelete: "cascade",
    }),
    status: text("status").default("registered").notNull(), // EntryStatus
    seed: integer("seed"),
    finalPlacement: integer("final_placement"),
    paymentStatus: text("payment_status").default("unpaid").notNull(),
    paymentRef: text("payment_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "tournament_entry_xor_user_team",
      sql`(
        (${table.userId} IS NOT NULL AND ${table.teamId} IS NULL)
        OR (${table.userId} IS NULL AND ${table.teamId} IS NOT NULL)
      )`
    ),
    uniqueIndex("tournament_entry_user_idx")
      .on(table.tournamentId, table.userId)
      .where(sql`user_id IS NOT NULL`),
    uniqueIndex("tournament_entry_team_idx")
      .on(table.tournamentId, table.teamId)
      .where(sql`team_id IS NOT NULL`),
    uniqueIndex("tournament_entry_seed_idx")
      .on(table.tournamentId, table.seed)
      .where(sql`seed IS NOT NULL`),
    index("tournament_entry_tournament_status_idx").on(
      table.tournamentId,
      table.status
    ),
    index("tournament_entry_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Tournament Team
// =============================================================================

export const tournamentTeam = pgTable(
  "tournament_team",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournament.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    captainUserId: text("captain_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("tournament_team_tournament_idx").on(table.tournamentId),
    index("tournament_team_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Tournament Team Member
// =============================================================================

export const tournamentTeamMember = pgTable(
  "tournament_team_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    teamId: text("team_id")
      .notNull()
      .references(() => tournamentTeam.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("player").notNull(), // TeamMemberRole
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tournament_team_member_team_user_idx").on(table.teamId, table.userId),
    index("tournament_team_member_team_idx").on(table.teamId),
  ]
)

// =============================================================================
// Tournament Match Entry (per-match participant record)
// =============================================================================

export const tournamentMatchEntry = pgTable(
  "tournament_match_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    matchId: text("match_id")
      .notNull()
      .references(() => tournamentMatch.id, { onDelete: "cascade" }),
    entryId: text("entry_id")
      .notNull()
      .references(() => tournamentEntry.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    result: text("result"), // MatchEntryResult
    score: jsonb("score"), // format-specific score data
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("tournament_match_entry_slot_idx").on(table.matchId, table.slot),
    uniqueIndex("tournament_match_entry_entry_idx").on(table.matchId, table.entryId),
    index("tournament_match_entry_match_idx").on(table.matchId),
  ]
)

// =============================================================================
// Tournament Standing
// =============================================================================

export const tournamentStanding = pgTable(
  "tournament_standing",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    stageId: text("stage_id")
      .notNull()
      .references(() => tournamentStage.id, { onDelete: "cascade" }),
    groupId: text("group_id").references(() => tournamentGroup.id, {
      onDelete: "cascade",
    }),
    entryId: text("entry_id")
      .notNull()
      .references(() => tournamentEntry.id, { onDelete: "cascade" }),
    rank: integer("rank"),
    wins: integer("wins").default(0).notNull(),
    losses: integer("losses").default(0).notNull(),
    draws: integer("draws").default(0).notNull(),
    points: integer("points").default(0).notNull(),
    tiebreakers: jsonb("tiebreakers").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    // Split partial unique indexes for null/non-null groupId
    uniqueIndex("tournament_standing_stage_no_group_idx")
      .on(table.stageId, table.entryId)
      .where(sql`group_id IS NULL`),
    uniqueIndex("tournament_standing_stage_group_idx")
      .on(table.stageId, table.groupId, table.entryId)
      .where(sql`group_id IS NOT NULL`),
    index("tournament_standing_stage_idx").on(table.stageId),
    index("tournament_standing_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Relations
// =============================================================================

export const tournamentRelations = relations(
  tournament,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [tournament.organizationId],
      references: [organization.id],
    }),
    activity: one(activity, {
      fields: [tournament.activityId],
      references: [activity.id],
    }),
    createdByUser: one(user, {
      fields: [tournament.createdBy],
      references: [user.id],
    }),
    stages: many(tournamentStage),
    entries: many(tournamentEntry),
    matches: many(tournamentMatch),
    teams: many(tournamentTeam),
  })
)

export const tournamentStageRelations = relations(
  tournamentStage,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [tournamentStage.organizationId],
      references: [organization.id],
    }),
    tournament: one(tournament, {
      fields: [tournamentStage.tournamentId],
      references: [tournament.id],
    }),
    groups: many(tournamentGroup),
    rounds: many(tournamentRound),
    standings: many(tournamentStanding),
  })
)

export const tournamentGroupRelations = relations(
  tournamentGroup,
  ({ one, many }) => ({
    stage: one(tournamentStage, {
      fields: [tournamentGroup.stageId],
      references: [tournamentStage.id],
    }),
    rounds: many(tournamentRound),
    standings: many(tournamentStanding),
  })
)

export const tournamentRoundRelations = relations(
  tournamentRound,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [tournamentRound.organizationId],
      references: [organization.id],
    }),
    stage: one(tournamentStage, {
      fields: [tournamentRound.stageId],
      references: [tournamentStage.id],
    }),
    group: one(tournamentGroup, {
      fields: [tournamentRound.groupId],
      references: [tournamentGroup.id],
    }),
    matches: many(tournamentMatch),
  })
)

export const tournamentMatchRelations = relations(
  tournamentMatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [tournamentMatch.organizationId],
      references: [organization.id],
    }),
    tournament: one(tournament, {
      fields: [tournamentMatch.tournamentId],
      references: [tournament.id],
    }),
    round: one(tournamentRound, {
      fields: [tournamentMatch.roundId],
      references: [tournamentRound.id],
    }),
    matchEntries: many(tournamentMatchEntry),
    outgoingEdges: many(tournamentMatchEdge, { relationName: "edgeFrom" }),
    incomingEdges: many(tournamentMatchEdge, { relationName: "edgeTo" }),
  })
)

export const tournamentMatchEdgeRelations = relations(
  tournamentMatchEdge,
  ({ one }) => ({
    fromMatch: one(tournamentMatch, {
      fields: [tournamentMatchEdge.fromMatchId],
      references: [tournamentMatch.id],
      relationName: "edgeFrom",
    }),
    toMatch: one(tournamentMatch, {
      fields: [tournamentMatchEdge.toMatchId],
      references: [tournamentMatch.id],
      relationName: "edgeTo",
    }),
  })
)

export const tournamentEntryRelations = relations(
  tournamentEntry,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [tournamentEntry.organizationId],
      references: [organization.id],
    }),
    tournament: one(tournament, {
      fields: [tournamentEntry.tournamentId],
      references: [tournament.id],
    }),
    user: one(user, {
      fields: [tournamentEntry.userId],
      references: [user.id],
    }),
    team: one(tournamentTeam, {
      fields: [tournamentEntry.teamId],
      references: [tournamentTeam.id],
    }),
    matchEntries: many(tournamentMatchEntry),
    standings: many(tournamentStanding),
  })
)

export const tournamentTeamRelations = relations(
  tournamentTeam,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [tournamentTeam.organizationId],
      references: [organization.id],
    }),
    tournament: one(tournament, {
      fields: [tournamentTeam.tournamentId],
      references: [tournament.id],
    }),
    captain: one(user, {
      fields: [tournamentTeam.captainUserId],
      references: [user.id],
    }),
    members: many(tournamentTeamMember),
    entries: many(tournamentEntry),
  })
)

export const tournamentTeamMemberRelations = relations(
  tournamentTeamMember,
  ({ one }) => ({
    team: one(tournamentTeam, {
      fields: [tournamentTeamMember.teamId],
      references: [tournamentTeam.id],
    }),
    user: one(user, {
      fields: [tournamentTeamMember.userId],
      references: [user.id],
    }),
  })
)

export const tournamentMatchEntryRelations = relations(
  tournamentMatchEntry,
  ({ one }) => ({
    match: one(tournamentMatch, {
      fields: [tournamentMatchEntry.matchId],
      references: [tournamentMatch.id],
    }),
    entry: one(tournamentEntry, {
      fields: [tournamentMatchEntry.entryId],
      references: [tournamentEntry.id],
    }),
  })
)

export const tournamentStandingRelations = relations(
  tournamentStanding,
  ({ one }) => ({
    organization: one(organization, {
      fields: [tournamentStanding.organizationId],
      references: [organization.id],
    }),
    stage: one(tournamentStage, {
      fields: [tournamentStanding.stageId],
      references: [tournamentStage.id],
    }),
    group: one(tournamentGroup, {
      fields: [tournamentStanding.groupId],
      references: [tournamentGroup.id],
    }),
    entry: one(tournamentEntry, {
      fields: [tournamentStanding.entryId],
      references: [tournamentEntry.id],
    }),
  })
)

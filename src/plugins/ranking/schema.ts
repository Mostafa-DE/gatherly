import { relations, sql } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { createId } from "@paralleldrive/cuid2"
import { user, organization } from "@/db/auth-schema"
import { activity, eventSession } from "@/db/schema"

// =============================================================================
// Ranking Definition (one per activity — plugin enablement)
// =============================================================================

export const rankingDefinition = pgTable(
  "ranking_definition",
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
    domainId: text("domain_id").notNull(),
    autoRankConfig: jsonb("auto_rank_config"), // Reserved for future auto-ranking
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
    uniqueIndex("ranking_definition_activity_idx").on(table.activityId),
    index("ranking_definition_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Ranking Level (custom levels per definition)
// =============================================================================

export const rankingLevel = pgTable(
  "ranking_level",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    rankingDefinitionId: text("ranking_definition_id")
      .notNull()
      .references(() => rankingDefinition.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    order: integer("order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("ranking_level_def_order_idx").on(
      table.rankingDefinitionId,
      table.order
    ),
    index("ranking_level_org_idx").on(table.organizationId),
    index("ranking_level_def_idx").on(table.rankingDefinitionId),
  ]
)

// =============================================================================
// Member Rank (current rank + cumulative stats per member)
// =============================================================================

export const memberRank = pgTable(
  "member_rank",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    rankingDefinitionId: text("ranking_definition_id")
      .notNull()
      .references(() => rankingDefinition.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    currentLevelId: text("current_level_id").references(() => rankingLevel.id, {
      onDelete: "restrict",
    }),
    stats: jsonb("stats").default({}).notNull(),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("member_rank_def_user_idx").on(
      table.rankingDefinitionId,
      table.userId
    ),
    index("member_rank_org_user_idx").on(table.organizationId, table.userId),
    index("member_rank_def_level_idx").on(
      table.rankingDefinitionId,
      table.currentLevelId
    ),
  ]
)

// =============================================================================
// Rank Stat Entry (immutable audit trail of stat recordings)
// =============================================================================

export const rankStatEntry = pgTable(
  "rank_stat_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    rankingDefinitionId: text("ranking_definition_id")
      .notNull()
      .references(() => rankingDefinition.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => eventSession.id, {
      onDelete: "set null",
    }),
    stats: jsonb("stats").notNull(), // Delta payload: { wins: 1, losses: 0 }
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notes: text("notes"),
    correctionOfEntryId: text("correction_of_entry_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Idempotency: one entry per member per ranking per session (when session exists)
    uniqueIndex("rank_stat_entry_session_idempotency_idx")
      .on(table.rankingDefinitionId, table.userId, table.sessionId)
      .where(sql`session_id IS NOT NULL`),
    index("rank_stat_entry_org_user_created_idx").on(
      table.organizationId,
      table.userId,
      table.createdAt
    ),
    index("rank_stat_entry_def_created_idx").on(
      table.rankingDefinitionId,
      table.createdAt
    ),
  ]
)

// =============================================================================
// Match Record (raw match data with derived stats snapshot)
// =============================================================================

export const matchRecord = pgTable(
  "match_record",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    rankingDefinitionId: text("ranking_definition_id")
      .notNull()
      .references(() => rankingDefinition.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => eventSession.id, {
      onDelete: "set null",
    }),
    matchFormat: text("match_format").notNull(), // domain-defined: "singles", "doubles", etc.
    team1: jsonb("team1").notNull(), // string[] of user IDs
    team2: jsonb("team2").notNull(), // string[] of user IDs
    scores: jsonb("scores").notNull(), // domain-specific (padel: [[6,4],[3,6],[7,5]])
    winner: text("winner").notNull(), // "team1" | "team2" | "draw"
    derivedStats: jsonb("derived_stats").notNull(), // Record<userId, Record<statField, number>>
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("match_record_def_created_idx").on(
      table.rankingDefinitionId,
      table.createdAt
    ),
    index("match_record_session_idx").on(table.sessionId),
    index("match_record_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Relations
// =============================================================================

export const rankingDefinitionRelations = relations(
  rankingDefinition,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [rankingDefinition.organizationId],
      references: [organization.id],
    }),
    activity: one(activity, {
      fields: [rankingDefinition.activityId],
      references: [activity.id],
    }),
    createdByUser: one(user, {
      fields: [rankingDefinition.createdBy],
      references: [user.id],
    }),
    levels: many(rankingLevel),
    memberRanks: many(memberRank),
    statEntries: many(rankStatEntry),
    matchRecords: many(matchRecord),
  })
)

export const rankingLevelRelations = relations(rankingLevel, ({ one }) => ({
  organization: one(organization, {
    fields: [rankingLevel.organizationId],
    references: [organization.id],
  }),
  rankingDefinition: one(rankingDefinition, {
    fields: [rankingLevel.rankingDefinitionId],
    references: [rankingDefinition.id],
  }),
}))

export const memberRankRelations = relations(memberRank, ({ one }) => ({
  organization: one(organization, {
    fields: [memberRank.organizationId],
    references: [organization.id],
  }),
  rankingDefinition: one(rankingDefinition, {
    fields: [memberRank.rankingDefinitionId],
    references: [rankingDefinition.id],
  }),
  user: one(user, {
    fields: [memberRank.userId],
    references: [user.id],
  }),
  currentLevel: one(rankingLevel, {
    fields: [memberRank.currentLevelId],
    references: [rankingLevel.id],
  }),
}))

export const rankStatEntryRelations = relations(rankStatEntry, ({ one }) => ({
  organization: one(organization, {
    fields: [rankStatEntry.organizationId],
    references: [organization.id],
  }),
  rankingDefinition: one(rankingDefinition, {
    fields: [rankStatEntry.rankingDefinitionId],
    references: [rankingDefinition.id],
  }),
  user: one(user, {
    fields: [rankStatEntry.userId],
    references: [user.id],
    relationName: "statEntryUser",
  }),
  session: one(eventSession, {
    fields: [rankStatEntry.sessionId],
    references: [eventSession.id],
  }),
  recordedByUser: one(user, {
    fields: [rankStatEntry.recordedBy],
    references: [user.id],
    relationName: "statEntryRecorder",
  }),
  correctionOfEntry: one(rankStatEntry, {
    fields: [rankStatEntry.correctionOfEntryId],
    references: [rankStatEntry.id],
    relationName: "statEntryCorrection",
  }),
}))

export const matchRecordRelations = relations(matchRecord, ({ one }) => ({
  organization: one(organization, {
    fields: [matchRecord.organizationId],
    references: [organization.id],
  }),
  rankingDefinition: one(rankingDefinition, {
    fields: [matchRecord.rankingDefinitionId],
    references: [rankingDefinition.id],
  }),
  session: one(eventSession, {
    fields: [matchRecord.sessionId],
    references: [eventSession.id],
  }),
  recordedByUser: one(user, {
    fields: [matchRecord.recordedBy],
    references: [user.id],
  }),
}))

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
// Smart Group Config (one per activity)
// =============================================================================

export const smartGroupConfig = pgTable(
  "smart_group_config",
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
    defaultCriteria: jsonb("default_criteria"), // { fields: [{ sourceId, strategy }], maxFields: 2 }
    visibleFields: jsonb("visible_fields"), // string[] | null (null = show all)
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
    uniqueIndex("smart_group_config_activity_idx").on(table.activityId),
    index("smart_group_config_org_idx").on(table.organizationId),
  ]
)

// =============================================================================
// Smart Group Run (one per generation attempt)
// =============================================================================

export const smartGroupRun = pgTable(
  "smart_group_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    smartGroupConfigId: text("smart_group_config_id")
      .notNull()
      .references(() => smartGroupConfig.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => eventSession.id, {
      onDelete: "set null",
    }),
    scope: text("scope").notNull(), // "session" | "activity"
    status: text("status").default("generated").notNull(), // "generated" | "confirmed"
    version: integer("version").default(1).notNull(),
    criteriaSnapshot: jsonb("criteria_snapshot").notNull(),
    entryCount: integer("entry_count").default(0).notNull(),
    groupCount: integer("group_count").default(0).notNull(),
    excludedCount: integer("excluded_count").default(0).notNull(),
    generatedBy: text("generated_by").references(() => user.id, {
      onDelete: "set null",
    }),
    confirmedBy: text("confirmed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("smart_group_run_config_idx").on(table.smartGroupConfigId, table.createdAt),
    index("smart_group_run_session_idx").on(table.sessionId, table.createdAt),
    index("smart_group_run_org_idx").on(table.organizationId),
    // Partial unique indexes for confirmed runs (DB-level race guard)
    // Two separate indexes because PostgreSQL treats NULL as distinct in unique constraints
    uniqueIndex("smart_group_run_confirmed_session_idx")
      .on(table.smartGroupConfigId, table.scope, table.sessionId)
      .where(sql`status = 'confirmed' AND session_id IS NOT NULL`),
    uniqueIndex("smart_group_run_confirmed_activity_idx")
      .on(table.smartGroupConfigId, table.scope)
      .where(sql`status = 'confirmed' AND session_id IS NULL`),
  ]
)

// =============================================================================
// Smart Group Entry (data snapshot per person per run)
// =============================================================================

export const smartGroupEntry = pgTable(
  "smart_group_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    smartGroupRunId: text("smart_group_run_id")
      .notNull()
      .references(() => smartGroupRun.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    dataSnapshot: jsonb("data_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("smart_group_entry_run_user_idx").on(table.smartGroupRunId, table.userId),
    index("smart_group_entry_run_idx").on(table.smartGroupRunId),
  ]
)

// =============================================================================
// Smart Group Proposal (one generated group)
// =============================================================================

export const smartGroupProposal = pgTable(
  "smart_group_proposal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    smartGroupRunId: text("smart_group_run_id")
      .notNull()
      .references(() => smartGroupRun.id, { onDelete: "cascade" }),
    groupIndex: integer("group_index").notNull(),
    groupName: text("group_name").notNull(),
    memberIds: jsonb("member_ids").notNull(), // string[]
    modifiedMemberIds: jsonb("modified_member_ids"), // string[] | null
    status: text("status").default("proposed").notNull(), // "proposed" | "accepted" | "modified"
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("smart_group_proposal_run_idx").on(table.smartGroupRunId, table.groupIndex),
  ]
)

// =============================================================================
// Smart Group History (pairwise co-grouping records)
// =============================================================================

export const smartGroupHistory = pgTable(
  "smart_group_history",
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
    smartGroupRunId: text("smart_group_run_id")
      .notNull()
      .references(() => smartGroupRun.id, { onDelete: "cascade" }),
    user1Id: text("user1_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    user2Id: text("user2_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    groupedAt: timestamp("grouped_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("smart_group_history_activity_pair_idx").on(
      table.activityId,
      table.user1Id,
      table.user2Id
    ),
    index("smart_group_history_run_idx").on(table.smartGroupRunId),
    uniqueIndex("smart_group_history_run_pair_idx").on(
      table.smartGroupRunId,
      table.user1Id,
      table.user2Id
    ),
  ]
)

// =============================================================================
// Relations
// =============================================================================

export const smartGroupConfigRelations = relations(
  smartGroupConfig,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [smartGroupConfig.organizationId],
      references: [organization.id],
    }),
    activity: one(activity, {
      fields: [smartGroupConfig.activityId],
      references: [activity.id],
    }),
    createdByUser: one(user, {
      fields: [smartGroupConfig.createdBy],
      references: [user.id],
    }),
    runs: many(smartGroupRun),
  })
)

export const smartGroupRunRelations = relations(
  smartGroupRun,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [smartGroupRun.organizationId],
      references: [organization.id],
    }),
    config: one(smartGroupConfig, {
      fields: [smartGroupRun.smartGroupConfigId],
      references: [smartGroupConfig.id],
    }),
    session: one(eventSession, {
      fields: [smartGroupRun.sessionId],
      references: [eventSession.id],
    }),
    generatedByUser: one(user, {
      fields: [smartGroupRun.generatedBy],
      references: [user.id],
      relationName: "runGenerator",
    }),
    confirmedByUser: one(user, {
      fields: [smartGroupRun.confirmedBy],
      references: [user.id],
      relationName: "runConfirmer",
    }),
    entries: many(smartGroupEntry),
    proposals: many(smartGroupProposal),
  })
)

export const smartGroupEntryRelations = relations(
  smartGroupEntry,
  ({ one }) => ({
    run: one(smartGroupRun, {
      fields: [smartGroupEntry.smartGroupRunId],
      references: [smartGroupRun.id],
    }),
    user: one(user, {
      fields: [smartGroupEntry.userId],
      references: [user.id],
    }),
  })
)

export const smartGroupProposalRelations = relations(
  smartGroupProposal,
  ({ one }) => ({
    run: one(smartGroupRun, {
      fields: [smartGroupProposal.smartGroupRunId],
      references: [smartGroupRun.id],
    }),
  })
)

export const smartGroupHistoryRelations = relations(
  smartGroupHistory,
  ({ one }) => ({
    organization: one(organization, {
      fields: [smartGroupHistory.organizationId],
      references: [organization.id],
    }),
    activity: one(activity, {
      fields: [smartGroupHistory.activityId],
      references: [activity.id],
    }),
    run: one(smartGroupRun, {
      fields: [smartGroupHistory.smartGroupRunId],
      references: [smartGroupRun.id],
    }),
  })
)

/**
 * Database Schema
 * - Auth tables are auto-generated in auth-schema.ts
 * - Add your app-specific tables below
 */

import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { user, organization } from "./auth-schema";

// Re-export auto-generated auth schema
export * from "./auth-schema";

// =============================================================================
// Organization Settings (owned by us, not Better Auth)
// =============================================================================

export const organizationSettings = pgTable("organization_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  joinFormSchema: jsonb("join_form_schema"),
  joinFormVersion: integer("join_form_version").default(1).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// =============================================================================
// Event Session
// =============================================================================

export const eventSession = pgTable(
  "event_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    dateTime: timestamp("date_time", { withTimezone: true }).notNull(),
    location: text("location"),
    maxCapacity: integer("max_capacity").notNull(),
    maxWaitlist: integer("max_waitlist").default(0).notNull(),
    joinMode: text("join_mode").default("open").notNull(), // 'open' | 'approval_required' | 'invite_only'
    status: text("status").default("draft").notNull(), // 'draft' | 'published' | 'cancelled' | 'completed'
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("event_session_org_idx").on(table.organizationId),
    index("event_session_date_idx").on(table.dateTime),
    index("event_session_status_idx").on(table.status),
    index("event_session_org_status_idx").on(table.organizationId, table.status),
  ]
);

// =============================================================================
// Participation
// =============================================================================

export const participation = pgTable(
  "participation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id")
      .notNull()
      .references(() => eventSession.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").default("joined").notNull(), // 'joined' | 'waitlisted' | 'cancelled'
    attendance: text("attendance").default("pending").notNull(), // 'pending' | 'show' | 'no_show'
    payment: text("payment").default("unpaid").notNull(), // 'unpaid' | 'paid'
    paymentRef: text("payment_ref"),
    checkInRef: text("check_in_ref"),
    notes: text("notes"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("participation_session_idx").on(table.sessionId),
    index("participation_user_idx").on(table.userId),
    index("participation_session_status_joined_idx").on(
      table.sessionId,
      table.status,
      table.joinedAt
    ),
    // Partial unique index: only one active participation per user per session
    uniqueIndex("uniq_active_participation")
      .on(table.sessionId, table.userId)
      .where(sql`status IN ('joined', 'waitlisted')`),
  ]
);

// =============================================================================
// Group Member Profile (custom form answers when users join a group)
// =============================================================================

export const groupMemberProfile = pgTable(
  "group_member_profile",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    answers: jsonb("answers").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("group_member_profile_org_user_idx").on(
      table.organizationId,
      table.userId
    ),
  ]
);

// =============================================================================
// Relations
// =============================================================================

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationSettings.organizationId],
      references: [organization.id],
    }),
  })
);

export const eventSessionRelations = relations(eventSession, ({ one, many }) => ({
  organization: one(organization, {
    fields: [eventSession.organizationId],
    references: [organization.id],
  }),
  createdByUser: one(user, {
    fields: [eventSession.createdBy],
    references: [user.id],
  }),
  participations: many(participation),
}));

export const participationRelations = relations(participation, ({ one }) => ({
  session: one(eventSession, {
    fields: [participation.sessionId],
    references: [eventSession.id],
  }),
  user: one(user, {
    fields: [participation.userId],
    references: [user.id],
  }),
}));

export const groupMemberProfileRelations = relations(
  groupMemberProfile,
  ({ one }) => ({
    organization: one(organization, {
      fields: [groupMemberProfile.organizationId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [groupMemberProfile.userId],
      references: [user.id],
    }),
  })
);

// =============================================================================
// Type Exports
// =============================================================================

export type {
  User,
  NewUser,
  Session,
  NewSession,
  Organization,
  NewOrganization,
  Member,
  NewMember,
  Invitation,
  NewInvitation,
  OrganizationSettings,
  NewOrganizationSettings,
  EventSession,
  NewEventSession,
  Participation,
  NewParticipation,
  GroupMemberProfile,
  NewGroupMemberProfile,
} from "./types";


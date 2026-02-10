/**
 * Database Schema
 * - Auth tables are auto-generated in auth-schema.ts
 * - Add your app-specific tables below
 */

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
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core"
import { createId } from "@paralleldrive/cuid2"
import { user, organization } from "@/db/auth-schema"

// Re-export auto-generated auth schema
export * from "@/db/auth-schema"

// =============================================================================
// Join Request (for approval-based organization joining)
// =============================================================================

export const joinRequest = pgTable(
  "join_request",
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
    status: text("status").default("pending").notNull(), // 'pending' | 'approved' | 'rejected'
    message: text("message"), // Optional message from requester
    formAnswers: jsonb("form_answers"), // Form answers submitted during join request
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("join_request_org_idx").on(table.organizationId),
    index("join_request_user_idx").on(table.userId),
    index("join_request_status_idx").on(table.status),
    // Only one pending request per user per org
    uniqueIndex("join_request_org_user_pending_idx")
      .on(table.organizationId, table.userId)
      .where(sql`status = 'pending'`),
  ]
)

// =============================================================================
// Organization Settings (owned by us, not Better Auth)
// =============================================================================

export const organizationSettings = pgTable("organization_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  joinFormSchema: jsonb("join_form_schema"),
  joinFormVersion: integer("join_form_version").default(1).notNull(),
  currency: text("currency"), // ISO 4217 code (USD, EUR, JOD, etc.) - null = not set
  enabledPlugins: jsonb("enabled_plugins").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

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
    price: numeric("price", { precision: 10, scale: 2 }), // null = free
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
)

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
    status: text("status").default("joined").notNull(), // 'pending' | 'joined' | 'waitlisted' | 'cancelled'
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
      .where(sql`status IN ('pending', 'joined', 'waitlisted')`),
  ]
)

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
    nickname: text("nickname"),
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
)

// =============================================================================
// Member Note (admin notes on members)
// =============================================================================

export const memberNote = pgTable(
  "member_note",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("member_note_org_target_idx").on(table.organizationId, table.targetUserId),
  ]
)

// =============================================================================
// Invite Link (token-based invite links for organizations)
// =============================================================================

export const inviteLink = pgTable(
  "invite_link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    token: text("token")
      .notNull()
      .unique()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("invite_link_org_idx").on(table.organizationId),
    index("invite_link_token_idx").on(table.token),
  ]
)

// =============================================================================
// Interest Category
// =============================================================================

export const interestCategory = pgTable("interest_category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

// =============================================================================
// Interest
// =============================================================================

export const interest = pgTable(
  "interest",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    categoryId: text("category_id")
      .notNull()
      .references(() => interestCategory.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    popular: boolean("popular").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("interest_category_slug_idx").on(table.categoryId, table.slug),
  ]
)

// =============================================================================
// User Interest (many-to-many)
// =============================================================================

export const userInterest = pgTable(
  "user_interest",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    interestId: text("interest_id")
      .notNull()
      .references(() => interest.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.interestId] }),
  ]
)

// =============================================================================
// Organization Interest (many-to-many)
// =============================================================================

export const organizationInterest = pgTable(
  "organization_interest",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    interestId: text("interest_id")
      .notNull()
      .references(() => interest.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.interestId] }),
  ]
)

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
)

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
}))

export const participationRelations = relations(participation, ({ one }) => ({
  session: one(eventSession, {
    fields: [participation.sessionId],
    references: [eventSession.id],
  }),
  user: one(user, {
    fields: [participation.userId],
    references: [user.id],
  }),
}))

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
)

export const memberNoteRelations = relations(memberNote, ({ one }) => ({
  organization: one(organization, {
    fields: [memberNote.organizationId],
    references: [organization.id],
  }),
  targetUser: one(user, {
    fields: [memberNote.targetUserId],
    references: [user.id],
    relationName: "noteTarget",
  }),
  author: one(user, {
    fields: [memberNote.authorUserId],
    references: [user.id],
    relationName: "noteAuthor",
  }),
}))

export const inviteLinkRelations = relations(inviteLink, ({ one }) => ({
  organization: one(organization, {
    fields: [inviteLink.organizationId],
    references: [organization.id],
  }),
  createdByUser: one(user, {
    fields: [inviteLink.createdBy],
    references: [user.id],
  }),
}))

export const joinRequestRelations = relations(joinRequest, ({ one }) => ({
  organization: one(organization, {
    fields: [joinRequest.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [joinRequest.userId],
    references: [user.id],
  }),
  reviewer: one(user, {
    fields: [joinRequest.reviewedBy],
    references: [user.id],
  }),
}))

export const interestCategoryRelations = relations(interestCategory, ({ many }) => ({
  interests: many(interest),
}))

export const interestRelations = relations(interest, ({ one, many }) => ({
  category: one(interestCategory, {
    fields: [interest.categoryId],
    references: [interestCategory.id],
  }),
  userInterests: many(userInterest),
  organizationInterests: many(organizationInterest),
}))

export const userInterestRelations = relations(userInterest, ({ one }) => ({
  user: one(user, {
    fields: [userInterest.userId],
    references: [user.id],
  }),
  interest: one(interest, {
    fields: [userInterest.interestId],
    references: [interest.id],
  }),
}))

export const organizationInterestRelations = relations(organizationInterest, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationInterest.organizationId],
    references: [organization.id],
  }),
  interest: one(interest, {
    fields: [organizationInterest.interestId],
    references: [interest.id],
  }),
}))

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
  JoinRequest,
  NewJoinRequest,
  InviteLink,
  NewInviteLink,
  MemberNote,
  NewMemberNote,
  InterestCategory,
  NewInterestCategory,
  Interest,
  NewInterest,
  UserInterest,
  NewUserInterest,
  OrganizationInterest,
  NewOrganizationInterest,
} from "@/db/types"

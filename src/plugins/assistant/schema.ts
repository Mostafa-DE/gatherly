import { relations } from "drizzle-orm"
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { createId } from "@paralleldrive/cuid2"
import { user, organization } from "@/db/auth-schema"

// =============================================================================
// Telegram Identity Link (map Telegram sender to Gatherly user)
// =============================================================================

export const telegramIdentityLink = pgTable(
  "telegram_identity_link",
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
    telegramUserId: text("telegram_user_id").notNull(),
    telegramChatId: text("telegram_chat_id"),
    linkedByUserId: text("linked_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("telegram_identity_link_org_tg_user_idx").on(
      table.organizationId,
      table.telegramUserId
    ),
    index("telegram_identity_link_org_user_idx").on(
      table.organizationId,
      table.userId
    ),
  ]
)

// =============================================================================
// Assistant Action Request (persisted approval + follow-up state machine)
// =============================================================================

export const assistantActionRequest = pgTable(
  "assistant_action_request",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    source: text("source").notNull(), // 'telegram'
    sourceEventId: text("source_event_id").notNull(),
    action: text("action").notNull(), // 'mark_attendance' | 'record_match_result' | 'create_session'
    status: text("status").default("pending_approval").notNull(), // 'pending_approval' | 'approved' | 'executed' | 'rejected' | 'failed'
    transcript: text("transcript"),
    requestedPayload: jsonb("requested_payload").notNull(),
    resolvedPayload: jsonb("resolved_payload"),
    executionResult: jsonb("execution_result"),
    executionError: text("execution_error"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    executedAt: timestamp("executed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("assistant_action_request_idempotency_idx").on(
      table.organizationId,
      table.source,
      table.sourceEventId
    ),
    index("assistant_action_request_org_status_idx").on(
      table.organizationId,
      table.status,
      table.createdAt
    ),
  ]
)

// =============================================================================
// Bot Request Nonce (replay protection)
// =============================================================================

export const assistantBotRequestNonce = pgTable(
  "assistant_bot_request_nonce",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    senderId: text("sender_id").notNull(),
    nonce: text("nonce").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("assistant_bot_request_nonce_sender_nonce_idx").on(
      table.senderId,
      table.nonce
    ),
    index("assistant_bot_request_nonce_expires_at_idx").on(table.expiresAt),
  ]
)

// =============================================================================
// Relations
// =============================================================================

export const telegramIdentityLinkRelations = relations(telegramIdentityLink, ({ one }) => ({
  organization: one(organization, {
    fields: [telegramIdentityLink.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [telegramIdentityLink.userId],
    references: [user.id],
  }),
  linkedByUser: one(user, {
    fields: [telegramIdentityLink.linkedByUserId],
    references: [user.id],
    relationName: "linkedBy",
  }),
}))

export const assistantActionRequestRelations = relations(assistantActionRequest, ({ one }) => ({
  organization: one(organization, {
    fields: [assistantActionRequest.organizationId],
    references: [organization.id],
  }),
  requestedByUser: one(user, {
    fields: [assistantActionRequest.requestedBy],
    references: [user.id],
    relationName: "requestedBy",
  }),
  approvedByUser: one(user, {
    fields: [assistantActionRequest.approvedBy],
    references: [user.id],
    relationName: "approvedBy",
  }),
}))

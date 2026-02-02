# Gatherly MVP: Sessions & Participation - Implementation Plan

## Summary

Build the core domain model for session management and participation tracking:
- **Session**: Events with capacity limits belonging to a Group (Organization)
- **Participation**: Users joining sessions with status, attendance, payment tracking
- **GroupMemberProfile**: Custom form answers when users join a group

---

## Architecture Decisions

| Decision | Choice |
|----------|--------|
| Hierarchy | Org = Group (1:1), Sessions belong to Org directly |
| Membership | Must be group member before joining sessions (via Better Auth) |
| Join modes | Only `open` enforced for MVP. `approval_required`/`invite_only` blocked with clear error. |
| Join forms | Group-level only (once when joining org). Session forms deferred to future. |
| Participation fields | status, attendance, payment, notes + plugin refs |
| Capacity | maxCapacity + maxWaitlist (both capped) |
| Roles | Just owner for MVP (check via membership role, not createdBy) |
| Waitlist | FIFO via `(joinedAt, id)` ordering. Auto-promote with `SKIP LOCKED`. No position column. |
| Plugin design | Minimal core + reference fields for future plugins |
| Timestamps | All timestamps use `timestamptz` (UTC storage) |
| Soft delete | Sessions support soft delete via `deletedAt` |
| State transitions | Explicit state machine for session/participation status |

---

## Membership Handling

Membership is managed by **Better Auth's organization plugin**:

| Concern | Handled By |
|---------|------------|
| Is user a member of org? | Better Auth `member` table |
| User's role in org | Better Auth `member.role` (owner, admin, member) |
| Custom form answers | `GroupMemberProfile` table (our table) |

**Flow:**
1. User joins org → Better Auth creates `member` record
2. User fills custom form → we create `GroupMemberProfile` record
3. Before joining session → check `member` table via Better Auth

---

## Authorization Pattern

**Admin = owner role**, checked via Better Auth membership, NOT via `createdBy`:

```typescript
// ❌ Wrong — checks who created the session
if (session.createdBy !== user.id) throw new ForbiddenError();

// ✅ Right — use Better Auth's hasPermission API
const { hasPermission } = await auth.api.hasPermission({
  headers: req.headers,
  body: {
    permissions: {
      organization: ["update"], // or custom permission
    },
  },
});
if (!hasPermission) throw new ForbiddenError();

// Alternative: Direct role check via member query
const members = await db
  .select()
  .from(member)
  .where(
    and(
      eq(member.organizationId, organizationId),
      eq(member.userId, userId)
    )
  );
if (members[0]?.role !== 'owner') throw new ForbiddenError();
```

**Why:**
- Another owner can manage sessions they didn't create
- When we add `admin` role later, just update the check
- `createdBy` is for audit trail, not authorization
- Better Auth handles role-based permissions out of the box

**Access levels for MVP:**

| Role | Can do |
|------|--------|
| `owner` | Create/update/delete sessions, view roster, manage attendance |
| `member` | Join sessions, view own participation, cancel own participation |
| (non-member) | Nothing — must join org first |

---

## Plugin-Ready Design

**Philosophy**: Keep core tables simple, add reference fields for plugins to use.

### Payment Plugin (Future)
- Core field: `payment` (unpaid | paid) — for manual tracking now
- Core field: `paymentRef` (nullable string) — plugin writes external ID here
- Future: Plugin creates `payment_record` table with full details (provider, amount, refunds)
- Plugin reads/writes `paymentRef` to link participation ↔ payment record

### Attendance/Check-in Plugin (Future)
- Core field: `attendance` (pending | show | no_show) — for manual marking now
- Core field: `checkInRef` (nullable string) — plugin writes external ID here
- Future: Plugin creates `check_in_record` table (method, timestamp, device)
- Plugin reads/writes `checkInRef` to link participation ↔ check-in record

**Why this approach:**
- Core table stays lean and fast
- No breaking changes when adding plugins
- Plugins own their complexity, core stays simple
- Query joins only when plugin data is needed

---

## Database Schema

### Design Notes

- **All timestamps use `timestamptz`** — stores in UTC, avoids timezone pain
- **Soft delete on sessions** — `deletedAt` column for history preservation
- **Consistent audit fields** — `createdAt`, `updatedAt` on all tables

### Tables

#### 1. `eventSession`
Named to avoid conflict with Better Auth's `session` table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (use `cuid()` or `nanoid()`) |
| `organizationId` | text | FK to organization (matches Better Auth) |
| `title` | text | Session title |
| `description` | text | Optional description |
| `dateTime` | timestamptz | When the session occurs |
| `location` | text | Optional location |
| `maxCapacity` | integer | Required, max joined participants |
| `maxWaitlist` | integer | Default 0, max waitlist size |
| `joinMode` | text | 'open', 'approval_required', 'invite_only' |
| `status` | text | 'draft', 'published', 'cancelled', 'completed' |
| `createdBy` | text | FK to user, nullable (onDelete: set null) |
| `createdAt` | timestamptz | Auto |
| `updatedAt` | timestamptz | Auto |
| `deletedAt` | timestamptz | Nullable, for soft delete |

**Note:** Using `text` for IDs and enums to match Better Auth's schema pattern. Enums validated via Zod at application layer.

**Indexes**: organizationId, dateTime, status, composite(organizationId, status)

**Note**: `formSchema` column omitted for MVP. Can be added later as nullable jsonb if session-level forms are needed.

#### 2. `participation`

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (also used as tie-breaker for FIFO ordering) |
| `sessionId` | text | FK to eventSession |
| `userId` | text | FK to user (matches Better Auth) |
| `status` | text | 'joined', 'waitlisted', 'cancelled' |
| `attendance` | text | 'pending', 'show', 'no_show' |
| `payment` | text | 'unpaid', 'paid' |
| `paymentRef` | text | Nullable, for payment plugin |
| `checkInRef` | text | Nullable, for check-in plugin |
| `notes` | text | Admin notes |
| `joinedAt` | timestamptz | When user joined/waitlisted (used for FIFO ordering) |
| `cancelledAt` | timestamptz | Nullable, when user cancelled |
| `createdAt` | timestamptz | Audit only (when record was created) |
| `updatedAt` | timestamptz | Audit only (when record was last modified) |

**Indexes**: sessionId, userId, composite(sessionId, status, joinedAt)

**Partial unique index** (belt and suspenders):
```sql
CREATE UNIQUE INDEX uniq_active_participation
ON participation(session_id, user_id)
WHERE status IN ('joined', 'waitlisted');
```

This ensures:
- Only one active participation per user per session (DB enforced)
- Multiple cancelled records allowed (history preserved)
- Catches bugs in future refactors, rogue scripts, edge cases

**Drizzle partial index syntax** (use `sql` template, not `eq()`):
```typescript
uniqueIndex('uniq_active_participation')
  .on(table.sessionId, table.userId)
  .where(sql`status IN ('joined', 'waitlisted')`)
```

**No `waitlistPosition` column** — waitlist order is derived from `(joinedAt, id)`. See "Waitlist Ordering" section.

**Note**: `formAnswers` column omitted for MVP. Can be added later as nullable jsonb if session-level forms are needed.

#### 3. `groupMemberProfile`

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key |
| `organizationId` | text | FK to organization (matches Better Auth) |
| `userId` | text | FK to user (matches Better Auth) |
| `answers` | jsonb | Answers to group join form |
| `createdAt` | timestamptz | Auto |
| `updatedAt` | timestamptz | Auto |

**Indexes**: unique(organizationId, userId)

---

## Drizzle Schema Implementation

Following Better Auth's schema patterns and Drizzle best practices:

```typescript
// src/db/schema.ts
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
import { user, organization } from "./auth-schema";

// Helper for generating IDs (consistent with Better Auth)
import { createId } from "@paralleldrive/cuid2";

export const eventSession = pgTable(
  "event_session",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
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
    createdBy: text("created_by")
      .references(() => user.id, { onDelete: "set null" }), // nullable: sessions can exist without creator
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

export const participation = pgTable(
  "participation",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
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
    index("participation_session_status_joined_idx").on(table.sessionId, table.status, table.joinedAt),
    // Partial unique index: only one active participation per user per session
    uniqueIndex("uniq_active_participation")
      .on(table.sessionId, table.userId)
      .where(sql`status IN ('joined', 'waitlisted')`),
  ]
);

export const groupMemberProfile = pgTable(
  "group_member_profile",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
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
    uniqueIndex("group_member_profile_org_user_idx").on(table.organizationId, table.userId),
  ]
);

// Relations
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

export const groupMemberProfileRelations = relations(groupMemberProfile, ({ one }) => ({
  organization: one(organization, {
    fields: [groupMemberProfile.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [groupMemberProfile.userId],
    references: [user.id],
  }),
}));
```

---

## State Machine

### Session Status Transitions

```
draft → published → completed
  ↓         ↓
cancelled  cancelled
```

| From | Allowed To |
|------|------------|
| `draft` | `published`, `cancelled` |
| `published` | `completed`, `cancelled` |
| `completed` | (none) |
| `cancelled` | (none) |

**Rules:**
- Can only join `published` sessions
- Cannot modify core fields after `completed` or `cancelled`

### Participation Status Transitions

```
(none) → joined → cancelled
           ↑
(none) → waitlisted → joined (auto-promote)
              ↓
          cancelled
```

| From | Allowed To |
|------|------------|
| `joined` | `cancelled` |
| `waitlisted` | `joined` (promotion), `cancelled` |
| `cancelled` | (none — create new participation to rejoin) |

**Rules:**
- Cannot join if session status is not `published`
- Cannot cancel after session is `completed`
- Auto-promote first waitlisted when someone cancels from `joined`

### Implementation

```typescript
// src/lib/state-machine.ts

export const sessionTransitions: Record<SessionStatus, SessionStatus[]> = {
  draft: ['published', 'cancelled'],
  published: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const participationTransitions: Record<ParticipationStatus, ParticipationStatus[]> = {
  joined: ['cancelled'],
  waitlisted: ['joined', 'cancelled'],
  cancelled: [],
};

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return sessionTransitions[from]?.includes(to) ?? false;
}

export function canTransitionParticipation(from: ParticipationStatus, to: ParticipationStatus): boolean {
  return participationTransitions[from]?.includes(to) ?? false;
}

export function assertSessionTransition(from: SessionStatus, to: SessionStatus): void {
  if (!canTransitionSession(from, to)) {
    throw new ForbiddenError(`Cannot transition session from ${from} to ${to}`);
  }
}

export function assertParticipationTransition(from: ParticipationStatus, to: ParticipationStatus): void {
  if (!canTransitionParticipation(from, to)) {
    throw new ForbiddenError(`Cannot transition participation from ${from} to ${to}`);
  }
}
```

---

## API Endpoints

### Session Router (`/api/trpc/session.*`)

| Procedure | Access | Description |
|-----------|--------|-------------|
| `create` | Admin | Create new session (status: draft) |
| `update` | Admin | Update session details (respects state rules) |
| `getById` | Member | Get session by ID |
| `getWithCounts` | Member | Get session with participant counts (see note below) |
| `list` | Member | List sessions for org (excludes soft-deleted) |
| `listUpcoming` | Member | Sessions where `dateTime > now` AND `status = published` |
| `listPast` | Member | Sessions where `dateTime < now` OR `status IN (completed, cancelled)` |
| `updateStatus` | Admin | Change session status (uses state machine) |
| `delete` | Admin | Soft delete session (sets deletedAt) |

**`getWithCounts` implementation note:**
Counts must use correct status filters:
```typescript
const counts = {
  joinedCount: count where status = 'joined',
  waitlistCount: count where status = 'waitlisted',
  // Exclude 'cancelled' from all counts
  // Future: requestedCount for approval workflow
};
```

### Participation Router (`/api/trpc/participation.*`)

| Procedure | Access | Description |
|-----------|--------|-------------|
| `join` | Member | Join a session (idempotent — see note below) |
| `cancel` | Self | Cancel own participation (triggers auto-promote) |
| `myParticipation` | Self | Get own participation for session |
| `myHistory` | Self | Get all participations in org |
| `roster` | Admin | Get full roster for session |
| `update` | Admin | Update attendance/payment |
| `bulkUpdateAttendance` | Admin | Mark multiple attendances |
| `userHistory` | Admin | Get user's participation history |

**`join` idempotent behavior:**
```typescript
// If already joined/waitlisted → return existing participation (no error)
// If previously cancelled → create new participation
// Safe for retries, double-clicks, network issues
async function join(sessionId, userId) {
  const existing = await getParticipation(sessionId, userId);
  if (existing && existing.status !== 'cancelled') {
    return existing; // Idempotent: return existing
  }
  return createParticipation(sessionId, userId);
}
```

### Group Member Profile Router (`/api/trpc/groupMemberProfile.*`)

| Procedure | Access | Description |
|-----------|--------|-------------|
| `myProfile` | Self | Get own profile for org |
| `updateMyProfile` | Self | Update own profile |
| `submitJoinForm` | User | Submit join form for org |
| `getUserProfile` | Admin | Get user's profile |

---

## Key Technical Decisions

### Capacity Enforcement

Use **pessimistic locking** to guarantee consistency under concurrency.

**Join Transaction:**
```typescript
async function joinSession(sessionId: string, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Lock session row — concurrent requests serialize here
    // Drizzle supports .for() but it's undocumented. Use raw SQL for reliability.
    const [session] = await tx.execute(sql`
      SELECT * FROM event_session
      WHERE id = ${sessionId}
      FOR UPDATE
    `);

    // 2. Check session is joinable
    if (session.deletedAt) {
      throw new NotFoundError('Session not found'); // Treat as not found
    }
    if (session.status !== 'published') {
      throw new BadRequestError('Session is not open for joining');
    }

    // 3. Check join mode (MVP: only 'open' works)
    if (session.joinMode === 'approval_required') {
      throw new BadRequestError('Approval-based joining coming soon');
    }
    if (session.joinMode === 'invite_only') {
      throw new BadRequestError('Invite-only sessions coming soon');
    }

    // 4. Check for existing active participation (idempotent)
    const [existing] = await tx
      .select()
      .from(participation)
      .where(and(
        eq(participation.sessionId, sessionId),
        eq(participation.userId, userId),
        ne(participation.status, 'cancelled')
      ));
    if (existing) return existing; // Idempotent

    // 5. Count current participants (inside lock = accurate)
    const [counts] = await tx
      .select({
        joined: count(sql`CASE WHEN status = 'joined' THEN 1 END`),
        waitlisted: count(sql`CASE WHEN status = 'waitlisted' THEN 1 END`),
      })
      .from(participation)
      .where(eq(participation.sessionId, sessionId));

    // 6. Determine status
    let status: 'joined' | 'waitlisted';

    if (counts.joined < session.maxCapacity) {
      status = 'joined';
    } else if (counts.waitlisted < session.maxWaitlist) {
      status = 'waitlisted';
    } else {
      throw new BadRequestError('Session and waitlist are full');
    }

    // 7. Insert new participation (handle unique conflict idempotently)
    try {
      const [newParticipation] = await tx
        .insert(participation)
        .values({ sessionId, userId, status, joinedAt: new Date() })
        .returning();
      return newParticipation;
    } catch (error) {
      // If unique constraint hit (race condition edge case), return existing
      if (isUniqueConstraintError(error)) {
        const [existing] = await tx
          .select()
          .from(participation)
          .where(and(
            eq(participation.sessionId, sessionId),
            eq(participation.userId, userId),
            ne(participation.status, 'cancelled')
          ));
        if (existing) return existing;
      }
      throw error;
    }
  });
}
```

**Why pessimistic locking works for MVP:**
- Requests serialize on the session lock — no race conditions
- Partial unique index as backup — catches edge cases
- Simple and correct

**Drizzle FOR UPDATE note:** Drizzle has `.for('update')` method but it's [undocumented](https://github.com/drizzle-team/drizzle-orm/issues/2875). Use `tx.execute(sql\`SELECT ... FOR UPDATE\`)` for reliability. See also [SKIP LOCKED issues](https://github.com/drizzle-team/drizzle-orm/issues/3554).

**Unique constraint error helper:**
```typescript
function isUniqueConstraintError(error: unknown): boolean {
  // PostgreSQL unique violation error code
  return (error as any)?.code === '23505';
}
```

**Scaling note:** Pessimistic locking may bottleneck for "hot" sessions (500+ concurrent joins). If needed later, switch to optimistic locking with retry or queue-based joins. For typical usage (10-50 people joining over minutes), this is fine.

### Waitlist Ordering (Derived, No Position Column)

Waitlist order is derived from `(joinedAt, id)` — **no `waitlistPosition` column needed**.

- `joinedAt` = when user joined/waitlisted (semantic meaning)
- `createdAt` = audit only (when record was created)

**Why this is better:**
- No position shifting on cancel — just update status
- No race conditions around "position = max + 1"
- Works well with `SKIP LOCKED` for concurrent promotions
- Simpler schema, fewer writes

**Promote first waitlisted (FIFO):**
```sql
-- Get first in line (earliest joinedAt, id as tie-breaker)
SELECT id FROM participation
WHERE session_id = $1 AND status = 'waitlisted'
ORDER BY joined_at ASC, id ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

`SKIP LOCKED` allows concurrent cancel transactions to each grab a different waitlisted person — no blocking.

**Why lock session row in cancel too?**
- Symmetric with join — both serialize on session
- Prevents subtle race conditions with tight capacity
- Future-proof for adding `pending` or other states
- `SKIP LOCKED` on promotion handles concurrent cancels gracefully

**Cancel Transaction (with auto-promote):**
```typescript
async function cancelParticipation(participationId: string) {
  return await db.transaction(async (tx) => {
    // 1. Get participation first (to get sessionId)
    const [current] = await tx
      .select()
      .from(participation)
      .where(eq(participation.id, participationId));

    if (!current || current.status === 'cancelled') {
      throw new NotFoundError('Participation not found or already cancelled');
    }

    // 2. Lock the session row and check it's not deleted
    const [session] = await tx.execute(sql`
      SELECT id, deleted_at, status FROM event_session
      WHERE id = ${current.sessionId}
      FOR UPDATE
    `);

    // 3. Check session state (optional: allow cancel on deleted/completed?)
    if (session.deleted_at) {
      throw new NotFoundError('Session not found');
    }
    // Note: You may want to allow cancel even on completed sessions — your choice

    // 4. Cancel the participation
    const wasJoined = current.status === 'joined';

    await tx
      .update(participation)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(participation.id, participationId));

    // 5. If was joined, promote first waitlisted (FIFO)
    if (wasJoined) {
      // SKIP LOCKED: if another transaction already locked someone, skip to next
      const result = await tx.execute(sql`
        UPDATE participation
        SET status = 'joined'
        WHERE id = (
          SELECT id FROM participation
          WHERE session_id = ${current.sessionId}
            AND status = 'waitlisted'
          ORDER BY joined_at ASC, id ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING *
      `);
      // result contains promoted user (if any)
    }
  });
}
```

**Show "You are #N in waitlist" (compute on demand):**
```sql
SELECT 1 + COUNT(*) AS position
FROM participation
WHERE session_id = $1
  AND status = 'waitlisted'
  AND (joined_at, id) < ($userJoinedAt, $userId);
```

Fast for typical waitlists. Cache if needed later.

### Form Validation (Group-level only)
- Org custom fields schema stored in `organization.metadata.formSchema` (JSON)
- Answers stored in `groupMemberProfile.answers` (JSON)
- Validate required fields server-side before saving
- **Session-level forms deferred** — can add `eventSession.formSchema` and `participation.formAnswers` columns later if needed

### Soft Delete
- `eventSession.deletedAt` for soft delete
- Queries filter out deleted sessions by default
- Preserves historical data and participation records

### Idempotent Join
- If user already has active participation (joined/waitlisted) → return existing
- If user previously cancelled → create new participation
- Benefits: safe for retries, double-clicks, network issues
- Standard REST/API practice

### Authorization via Membership Role
- Admin checks use Better Auth membership role, not `createdBy`
- `createdBy` is for audit trail only
- Allows any owner to manage any session in their org

### Join Mode Enforcement (MVP)

Only `open` mode is fully implemented. Other modes blocked with clear error:

```typescript
// In join transaction
if (session.joinMode === 'approval_required') {
  throw new BadRequestError('Approval-based joining coming soon. Use "open" mode for now.');
}
if (session.joinMode === 'invite_only') {
  throw new BadRequestError('Invite-only sessions coming soon. Use "open" mode for now.');
}
```

**Upgrade path (easy to add later):**

| Mode | Future Changes |
|------|----------------|
| `approval_required` | Add `pending` status, replace error with `status: 'pending'`, admin approves via `update` |
| `invite_only` | Add `inviteToken` column to session, validate token in join |

Schema already has the `joinMode` enum — just need logic changes, minimal migrations.

---

## Files to Create/Modify

### Dependencies to Add

```bash
pnpm add @paralleldrive/cuid2
```

### New Files

| File | Purpose |
|------|---------|
| `src/lib/state-machine.ts` | Session and participation state transitions |
| `src/types/form.ts` | Form field type definitions (group-level) |
| `src/schemas/session.ts` | Session Zod schemas (with enum validation) |
| `src/schemas/participation.ts` | Participation Zod schemas |
| `src/schemas/group-member-profile.ts` | Profile Zod schemas |
| `src/data-access/sessions.ts` | Session DB operations |
| `src/data-access/participations.ts` | Participation DB operations |
| `src/data-access/group-member-profiles.ts` | Profile DB operations |
| `src/trpc/routers/session.ts` | Session tRPC router |
| `src/trpc/routers/participation.ts` | Participation tRPC router |
| `src/trpc/routers/group-member-profile.ts` | Profile tRPC router |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schema.ts` | Add 3 new tables + relations (see Drizzle Schema section) |
| `src/trpc/routers/_app.ts` | Register new routers |
| `src/db/types.ts` | Export new table types |

---

## Verification Steps

After implementation:

1. **Database**: Run `pnpm db:generate && pnpm db:migrate` to apply schema
2. **Manual test**:
   - Create a session via tRPC (use Drizzle Studio or API)
   - Verify cannot join draft session
   - Publish session, then join as user
   - Verify idempotent join (call join again → returns same participation)
   - Verify capacity enforcement (fill up, verify waitlist)
   - Verify waitlist FIFO order (first to waitlist = first promoted)
   - Verify `getWithCounts` returns correct joinedCount/waitlistCount
   - Cancel from joined → verify first waitlisted auto-promoted
   - Cancel from waitlisted → verify no promotion, others unaffected
   - Verify user can rejoin after cancelling (new record created, old cancelled stays)
   - Verify partial unique index blocks duplicate active participation
   - Verify cannot transition completed → draft
   - Verify `listUpcoming` and `listPast` return correct sessions
   - Verify `approval_required` and `invite_only` modes return clear error
   - Admin: mark attendance, view roster
   - Soft delete session, verify it's excluded from list
   - Verify non-owner cannot create/update sessions
3. **Check types**: `pnpm build` should pass

---

## Out of Scope (This Phase)

- Frontend UI components
- Session join approval workflow (just the join mode flag)
- Manual waitlist promotion
- Notifications
- CSV export
- Session-level forms (can add columns later)

---

## Future Additions (Easy to Add Later)

### Session-level Forms
When needed, add:
```typescript
// eventSession
formSchema: jsonb('form_schema'), // nullable

// participation
formAnswers: jsonb('form_answers'), // nullable
```
No breaking changes — existing data has null values.

### Form Schema Versioning
If schema edits after publish become a problem:
- Option A: Lock schema after first participant joins
- Option B: Store `formSchemaSnapshot` in participation

### Join Mode: `approval_required`
1. Add `pending` to participation status enum (migration)
2. Update state machine: `pending → joined`, `pending → cancelled`
3. Replace error throw with `status: 'pending'` in join logic
4. Admin approves via existing `update` endpoint

### Join Mode: `invite_only`
1. Add `inviteToken` column to eventSession (migration)
2. Accept `token` param in join mutation
3. Validate `token === session.inviteToken` before allowing join

### Scaling for Hot Sessions
Current approach already scales well for cancellations (SKIP LOCKED allows parallel promotions).

For join bottlenecks, if pessimistic locking becomes an issue:
- Option A: Optimistic locking with retry on conflict
- Option B: Queue-based async joins with notifications
- Option C: Slot reservation with TTL (ticket-style)

---

## Next Steps (After This Phase)

1. **Frontend**: Build admin dashboard UI (roster, history views)
2. **User flows**: Join group page, join session page
3. **Approval workflow**: Implement approval_required join mode
4. **Export**: CSV export for admin
5. **Plugins**: Payment integration when ready

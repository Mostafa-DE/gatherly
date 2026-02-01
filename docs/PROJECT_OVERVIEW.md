# PROJECT_OVERVIEW.md

## What this project is
This project is a **people-coordination system for real-world activities**.

It helps organizers:
- run recurring sessions
- enforce people-based capacity
- track commitments and attendance history
- reduce “WhatsApp + Excel” chaos

**Conversation stays in existing tools** (WhatsApp/Discord/Instagram).  
This app is the **source of truth** for participation + history.

---

## What this project is NOT
- Not a social network (no feed, likes, discovery)
- Not a chat app
- Not an asset booking system (courts/tables/time slots)

This app manages **people committing to sessions**, not assets being rented.

---

## Core concepts
### User
A person who logs in.

### Organization (= Group)
A tenant/workspace created by any user. **Organization and Group are 1:1** — the org IS the group.
- A user can create multiple orgs
- A user can be a member of multiple orgs
- Org owner has admin privileges (MVP: just owner role)
- Org can define custom fields for member profiles

### Session (eventSession)
A single occurrence at a date/time with a **people capacity**, belonging directly to an Organization.
- Has `maxCapacity` (required) and `maxWaitlist` (optional)
- Join modes: `open`, `approval_required`, `invite_only`
- Status: `draft`, `published`, `cancelled`, `completed` (state machine enforced)
- Soft delete supported (preserves history)

### Participation
A user joining a session (or being waitlisted), tracked as history.
- Status: `joined`, `waitlisted`, `cancelled`
- Attendance: `pending`, `show`, `no_show`
- Payment: `unpaid`, `paid` (manual tracking, plugin-ready)
- Waitlist position tracked for ordering

### GroupMemberProfile
Custom form answers when a user joins an organization.
- One profile per user per org
- Stores answers to org-level custom fields

---

## Data Model

```
┌─────────────────┐
│      User       │
└────────┬────────┘
         │
         │ member of (via Better Auth)
         ▼
┌─────────────────┐       ┌─────────────────────┐
│  Organization   │◄──────│  GroupMemberProfile │
│   (= Group)     │       │  (answers to org    │
└────────┬────────┘       │   custom fields)    │
         │                └─────────────────────┘
         │ has many
         ▼
┌─────────────────┐
│  eventSession   │
│  (capacity,     │
│   waitlist)     │
└────────┬────────┘
         │
         │ has many
         ▼
┌─────────────────┐
│  Participation  │
│  (status,       │
│   attendance,   │
│   payment)      │
└─────────────────┘
```

### Key Relationships
- **User → Organization**: Many-to-many via Better Auth membership
- **Organization → eventSession**: One-to-many
- **eventSession → Participation**: One-to-many
- **User → Participation**: One-to-many
- **User + Organization → GroupMemberProfile**: One-to-one

---

## MVP goal
Ship the smallest product that proves:
- an organizer can create sessions and share a link
- people can join
- capacity is enforced correctly
- organizer can view roster and history

If an organizer doesn’t feel immediate relief vs WhatsApp + Excel, the MVP failed.

---

## MVP scope (build this first)
### Organization (= Group)
- Users can create organizations and manage them
- Owner has admin privileges (no custom RBAC for MVP)
- Org can define custom fields for member join form
- Org has join mode: `open`, `approval_required`, `invite_only`

### Organization membership (join once)
- User joins an organization once
- User fills org-level join form (custom fields)
- User answers join form once; can be prompted later if schema changes

### Sessions
- Create sessions under an org (time + capacity + optional waitlist)
- Session has its own join mode (independent of org)
- Session status: draft → published → completed (state machine)
- Share a session link (only published sessions can be joined)
- Users join/cancel
- Waitlist if full, auto-promote on cancellation
- Soft delete preserves history

### Organizer views
- View session roster (joined + waitlisted)
- Mark attendance and payment status
- Basic history (past sessions + participants)
- Export CSV (optional but strongly useful)

---

## Out of scope for MVP
- Payments (plugin-ready fields exist)
- Session-level forms (easy to add later)
- Rankings / matching
- Tournaments
- Notifications system (email/SMS/push engine)
- Social features
- Asset booking logic
- Complex analytics dashboards

---

## Product rules (important)
- **WhatsApp = conversation**
- **App = commitment + capacity + memory**
- No domain hardcoding: “padel/reading/etc.” are configurations, not special code paths.

---

## Tech direction (current)
- TypeScript full-stack
- TanStack Start
- tRPC for API
- Better Auth for auth + organizations + roles
- Postgres + Drizzle ORM
- Validation at boundaries (Zod)

Organizations are implemented using Better Auth Organizations.
App-specific org data is stored using Better Auth org `additionalFields` (v1.4+).

---

## Key flows (MVP)
### 1) Organizer setup
1. User signs in
2. User creates organization (becomes owner)
3. (Optional) Configure org custom fields for member profiles

### 2) User onboarding
1. User opens org/group link
2. User signs in (if needed)
3. User joins organization (fills join form once)
4. (Optional) organizer approval if `approval_required`

### 3) Session participation
1. Organizer creates a session + capacity
2. User (must be org member) opens session link
3. Join session:
   - if space → joined
   - if full → waitlisted (up to maxWaitlist)
4. Cancel → auto-promote first waitlisted
5. Organizer views roster, marks attendance/payment

---

## Data integrity requirements (non-negotiable)
- Capacity enforcement must be correct under concurrency
- Use DB transactions and constraints where needed
- Never rely on frontend checks for correctness

---

## MVP “done” definition
MVP is done when:
- One real organizer runs at least **5 sessions**
- Session join/waitlist/cancel works reliably
- Organizer can see rosters + history
- Organizer says it’s better than their WhatsApp + Excel process

---

## Resolved Decisions

| Decision | Resolution |
|----------|------------|
| Hierarchy | Org = Group (1:1), no separate Activity entity for MVP |
| Membership | Must be org member before joining sessions (via Better Auth) |
| Join forms | Group-level only for MVP. Session forms deferred (easy to add later). |
| Waitlist behavior | Auto-promote on cancellation (default) |
| Roles | Just owner for MVP |
| Plugin design | Minimal core + reference fields for future plugins |
| Timestamps | All use `timestamptz` (UTC storage) |
| Soft delete | Sessions support soft delete via `deletedAt` |
| State transitions | Explicit state machine for session/participation status |

## Open decisions (for future)
- Timezone handling: org-level default or per-session timezone?
- Login requirement: magic link vs other methods?

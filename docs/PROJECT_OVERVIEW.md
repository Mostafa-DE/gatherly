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

### Organization (Organizer)
A tenant/workspace created by any user.
- A user can create multiple orgs
- A user can be a member of multiple orgs
- Org members can have roles/permissions

### Activity (Group)
A container under an organization that has recurring sessions.
Example: “Padel Open Games”, “Reading Club”.

### Session
A single occurrence at a date/time with a **people capacity**.

### Participation
A user joining a session (or being waitlisted), tracked as history.

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
### Organization + permissions (baseline)
- Users can create organizations and manage them
- Roles/permissions are used for organizer/admin access (no custom RBAC)

### Activities
- Create/edit activity under an org
- Activity has join mode:
  - `open`
  - `request_to_join` (approval)

### Activity membership (join once)
- User joins an activity once
- Activity can define a join form (custom fields)
- User answers join form once; can be prompted later if schema changes

### Sessions
- Create sessions (time + capacity)
- Share a session link
- Users join/cancel
- Waitlist if full

### Organizer views
- View session roster (joined + waitlisted)
- Basic history (past sessions + participants)
- Export CSV (optional but strongly useful)

---

## Out of scope for MVP
- Payments
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
3. User creates an activity

### 2) User onboarding
1. User opens activity link
2. User signs in (if needed)
3. User joins activity (fills join form once)
4. (Optional) organizer approval if `request_to_join`

### 3) Session participation
1. Organizer creates a session + capacity
2. User opens session link
3. Join session:
   - if space → joined
   - if full → waitlisted
4. Organizer views roster + exports

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

## Open decisions (must be explicit; don’t assume)
- Are participants required to login before joining a session? (recommended: yes, via magic link not sure we will discuss this)
- Waitlist behavior: auto-promote on cancellation or manual promote?
- Timezone handling: org-level default or per-session timezone?
- Minimum join form field set: name only vs name + phone vs configurable

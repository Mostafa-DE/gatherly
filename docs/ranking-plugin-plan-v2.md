# Ranking Plugin — Implementation Plan (v2)

## Status

Locked MVP decisions (supersedes v1 plan; v1 kept unchanged).

## Context

Build a ranking plugin that is scoped per activity (not org-wide), supports multiple ranking domains, and stays flexible for different activity types.

## MVP Scope

- Manual level assignment by owner/admin.
- Stats are numeric counters.
- Admin records stats; member self-reporting is out of scope.
- Padel is the first domain, but architecture must support any domain.
- No ranking disable toggle in MVP.

## Enablement Model

- Ranking is enabled for an activity when a `ranking_definition` exists.
- No separate org-level or activity-level toggle for ranking in MVP.

## Permissions

- Read ranking data: activity members.
- Manage ranking (create/update levels, assign level, record/correct stats): owner/admin.

## Domain Model (Flexibility Contract)

Each domain defines:

1. Domain identity and label.
2. Stat fields (`id`, `label`, and constraints).
3. Leaderboard tie-break strategy for members with same level.

Example (Padel tie-break chain):

1. `wins` descending
2. `(sets_won - sets_lost)` descending
3. member name ascending

This is domain-defined, not globally hardcoded.

## Data Model

Use 4 new tables in `src/db/schema.ts`.

### 1) `ranking_definition` (one per activity)

- `id` text PK (CUID2)
- `organization_id` text FK -> organization (not null)
- `activity_id` text FK -> activity (not null, unique)
- `name` text (not null)
- `domain_id` text (not null)
- `auto_rank_config` jsonb nullable (reserved for future)
- `created_by` text FK -> user
- `created_at`, `updated_at` timestamptz

Indexes and constraints:

- `UNIQUE(activity_id)`
- `INDEX(organization_id)`

### 2) `ranking_level` (custom levels per definition)

- `id` text PK (CUID2)
- `organization_id` text FK -> organization (not null)
- `ranking_definition_id` text FK -> ranking_definition (not null)
- `name` text (not null)
- `color` text nullable
- `order` integer (not null)
- `created_at`, `updated_at` timestamptz

Indexes and constraints:

- `UNIQUE(ranking_definition_id, order)`
- `INDEX(organization_id)`
- `INDEX(ranking_definition_id)`

Rules:

- Rename/reorder levels is allowed.
- Delete level is blocked until all members are moved off that level.

### 3) `member_rank` (current rank + cumulative stats)

- `id` text PK (CUID2)
- `organization_id` text FK -> organization (not null)
- `ranking_definition_id` text FK -> ranking_definition (not null)
- `user_id` text FK -> user (not null)
- `current_level_id` text FK -> ranking_level nullable
- `stats` jsonb not null default `{}`
- `last_activity_at` timestamptz nullable
- `created_at`, `updated_at` timestamptz

Indexes and constraints:

- `UNIQUE(ranking_definition_id, user_id)`
- `INDEX(organization_id, user_id)`
- `INDEX(ranking_definition_id, current_level_id)`

### 4) `rank_stat_entry` (immutable audit trail)

- `id` text PK (CUID2)
- `organization_id` text FK -> organization (not null)
- `ranking_definition_id` text FK -> ranking_definition (not null)
- `user_id` text FK -> user (not null)
- `session_id` text FK -> event_session nullable
- `stats` jsonb not null (delta payload)
- `recorded_by` text FK -> user (not null)
- `notes` text nullable
- `correction_of_entry_id` text FK -> rank_stat_entry nullable
- `created_at` timestamptz

Indexes and constraints:

- `UNIQUE(ranking_definition_id, user_id, session_id) WHERE session_id IS NOT NULL` (idempotency)
- `INDEX(organization_id, user_id, created_at)`
- `INDEX(ranking_definition_id, created_at)`

Rules:

- Entries are immutable (no update/delete API).
- Corrections create new entries referencing `correction_of_entry_id`.

## Membership and History Rules

1. Only activity members can be actively ranked.
2. If a user leaves activity, keep historical rank/stat data.
3. Leaderboard excludes former members by default.
4. Leaderboard supports `includeFormerMembers` (admin-facing option) to include them.

## API Surface (tRPC)

Namespace: `plugin.ranking`

Queries:

1. `listDomains` (member)
2. `getByActivity` (member)
3. `getLeaderboard` (member; `includeFormerMembers` default `false`)
4. `getMemberRank` (member)
5. `getMemberRanksByUser` (member)

Mutations (owner/admin):

1. `create` (create ranking definition for activity)
2. `updateDefinition` (name/domain metadata updates as allowed)
3. `upsertLevels` (rename/reorder/add levels)
4. `deleteLevel` (blocked if assigned members exist)
5. `assignLevel` (manual assignment)
6. `recordStats` (append stat entry + aggregate update)
7. `correctStatEntry` (append correction entry + aggregate update)

Implementation rule:

- `recordStats` and aggregate updates in `member_rank` must run in one DB transaction.

## UI Plan

Create a dedicated activity settings page (new route) and move activity management there.

Activity settings MVP sections:

1. General activity settings (name/slug/join mode)
2. Activity members management
3. Ranking section:
   - If no definition: setup flow
   - If exists: levels management, assignment, stat recording, leaderboard

Profile integrations:

1. `src/routes/dashboard/org.$orgId/members/$userId.tsx` shows rank card(s) for the member.
2. `src/routes/dashboard/org.$orgId/profile.tsx` shows self rank card(s).

## Build Sequence

1. Add DB schema for 4 tables + relations + indexes.
2. Generate and run migration.
3. Add ranking domain contract and Padel domain.
4. Add ranking data-access layer.
5. Add ranking router with owner/admin write guards.
6. Register ranking plugin router.
7. Add activity settings route and wire ranking UI.
8. Add profile/member rank cards.
9. Add tests for:
   - scope isolation (org/activity)
   - session idempotency
   - correction flow
   - level deletion blocking
   - former-member leaderboard filtering

## Verification

1. `pnpm db:generate && pnpm db:migrate`
2. `pnpm lint`
3. `pnpm test`
4. Manual flow:
   - open activity settings
   - create ranking
   - define levels
   - assign member level
   - record stats
   - correct one stat entry
   - verify leaderboard and profile cards

# Tournaments Plugin - Implementation Plan (v2)

## 1. Goal

Deliver an activity-scoped tournaments plugin that supports:
- Single elimination
- Double elimination
- Round robin
- Swiss
- Group + knockout
- Free-for-all

This v2 keeps the original product scope but updates technical design to match the current Gatherly architecture and code style.

---

## 2. Locked Decisions

- Scope: activity plugin (`tournaments` in activity `enabledPlugins`)
- Participants (v1): existing active activity members only
- Teams: supported (individual + team)
- Visibility: `activity_members`, `org_members`, `public`
- Check-in: admin-managed
- Forfeit and disqualification: both supported
- Match chat, predictions, voting: out of scope

---

## 3. Architecture Fit (Current Codebase)

- Plugin registration follows existing catalog + registry wiring
- Dashboard routes remain activity-scoped under:
  - `/dashboard/org/$orgId/activities/$activityId/...`
- Public routes extend activity public pages under:
  - `/$username/$groupSlug/activities/$activitySlug/...`
- Do not edit generated files manually (`routeTree.gen.ts`)
- Reuse existing org/activity scope patterns (`orgProcedure`, `withOrgScope`, activity checks)

---

## 4. API Access Matrix (Required)

Do not put all tournament APIs behind `orgProcedure`.

### 4.1 `orgProcedure` (org member required)

- Queries:
  - `plugin.tournaments.getById`
  - `plugin.tournaments.listByActivity`
  - `plugin.tournaments.getBracket`
  - `plugin.tournaments.getMatches`
  - `plugin.tournaments.getStandings`
  - `plugin.tournaments.getParticipants`
- Mutations (member self-service):
  - `registerSelf`
  - `withdrawSelf`

### 4.2 `orgProcedure` + admin role

- Mutations:
  - `create`
  - `update`
  - `deleteDraft`
  - `updateStatus`
  - `adminRegister`
  - `checkIn`
  - `setSeeds`
  - `randomizeSeeds`
  - `seedFromRanking`
  - `seedFromSmartGroups`
  - `reportScore`
  - `forfeitMatch`
  - `disqualifyParticipant`
  - `advanceSwissRound`
  - `advanceGroupStage`
  - `cancel`

### 4.3 `publicProcedure` (public pages)

- Queries:
  - `publicTournaments.listByActivity`
  - `publicTournaments.getBySlugAndId`
  - `publicTournaments.getBracket`
  - `publicTournaments.getStandings`

Public responses must be visibility-filtered and must not leak admin-only fields.

### 4.4 Optional `protectedProcedure` (if pre-org-member interactions are added later)

Not required for v1 because participants are active activity members only.

---

## 5. Data Model (Revised)

Use plugin-owned tables in `src/plugins/tournaments/schema.ts`.

## 5.1 Table list

1. `tournament`
2. `tournament_stage`
3. `tournament_group`
4. `tournament_round`
5. `tournament_match`
6. `tournament_match_edge` (new; replaces fragile text linkage)
7. `tournament_entry` (rename from `participant` to avoid confusion with `participation`)
8. `tournament_team`
9. `tournament_team_member`
10. `tournament_match_entry`
11. `tournament_standing`

## 5.2 Scope columns strategy

To reduce drift while keeping query performance:
- Keep `organization_id` on high-query scoped tables:
  - `tournament`, `tournament_stage`, `tournament_round`, `tournament_match`, `tournament_entry`, `tournament_standing`, `tournament_team`
- Omit `organization_id` on pure leaf/junction tables where parent FK already scopes data:
  - `tournament_group`, `tournament_team_member`, `tournament_match_entry`, `tournament_match_edge`

## 5.3 Core required columns and constraints

### `tournament`
- `id`, `organization_id`, `activity_id`
- `name`, `slug`, `format`, `status`, `visibility`
- `participant_type` (`individual|team`)
- `seeding_method`
- payment fields aligned to existing semantics:
  - `entry_fee_amount` numeric(10,2) nullable
  - `currency` nullable (fallback to org currency)
- `config` jsonb
- `starts_at`, `registration_opens_at`, `registration_closes_at`
- `version` integer default 1 not null (optimistic locking)

Indexes:
- `(activity_id, status, starts_at desc)`
- `(organization_id, status)`
- unique `(activity_id, slug)`

### `tournament_entry`
- `user_id` nullable
- `team_id` nullable
- XOR check constraint: exactly one of `user_id`, `team_id` is set
- `status`, `seed`, `final_placement`
- payment fields:
  - `payment_status` text default `unpaid`
  - `payment_ref` text nullable

Indexes:
- partial unique `(tournament_id, user_id) where user_id is not null`
- partial unique `(tournament_id, team_id) where team_id is not null`
- `(tournament_id, status)`
- unique `(tournament_id, seed) where seed is not null`

### `tournament_round` / `tournament_standing` null-group uniqueness

Avoid nullable unique pitfalls by using split partial unique indexes:
- `tournament_round`:
  - unique `(stage_id, round_number) where group_id is null`
  - unique `(stage_id, group_id, round_number) where group_id is not null`
- `tournament_standing`:
  - unique `(stage_id, participant_id) where group_id is null`
  - unique `(stage_id, group_id, participant_id) where group_id is not null`

### `tournament_match_edge` (progression graph)

Columns:
- `id`
- `from_match_id`
- `outcome_type` (`winner`, `loser`, `placement`)
- `outcome_rank` nullable (for placement-based flows)
- `to_match_id`
- `to_slot` integer

Constraints:
- FK from/to `tournament_match`
- unique `(from_match_id, outcome_type, coalesce(outcome_rank, -1))`
- unique `(to_match_id, to_slot)`

This replaces `nextMatchId` and `loserNextMatchId` text pointers.

### `tournament_match`
- `status`, `scores`, `winner_entry_id`
- `match_number`, `scheduled_at`
- `version` integer default 1 not null

Indexes:
- `(tournament_id, status, scheduled_at)`
- `(round_id, match_number)`

## 5.4 Domain checks

Add DB check constraints for key invariants:
- counts and ordering fields >= 0
- round numbers >= 1
- slot >= 1
- rank >= 1

---

## 6. State Machines

Implement explicit transition functions in `state-machine.ts`:
- Tournament: `draft -> registration -> check_in -> in_progress -> completed`, cancel from non-terminal active states
- Match: `pending -> scheduled -> in_progress -> completed`, plus terminal `forfeit|bye|cancelled`
- Entry: `registered -> checked_in -> active -> eliminated`, plus `withdrawn|disqualified`
- Stage: `pending -> in_progress -> completed`, plus `cancelled`

All mutations validate transitions before writes.

---

## 7. Lifecycle and Concurrency Rules

Use transactions for all lifecycle-changing mutations.

## 7.1 Start tournament

Single transaction:
1. Lock tournament row (`FOR UPDATE`)
2. Validate status, participant count, seeding readiness
3. Generate graph (stages, rounds, matches, edges)
4. Insert rows in dependency order
5. Initialize standings when needed
6. Set entries to active
7. Move tournament status to `in_progress`
8. Increment version fields where applicable

## 7.2 Report score / forfeit / disqualify

Single transaction:
1. Lock target match row
2. Validate mutable status
3. Compute winner/loser deterministically
4. Persist result + match-entry rows
5. Resolve graph edges and place advanced entries
6. Update affected standings
7. Update round/stage/tournament completion states
8. Increment affected versions

## 7.3 Optimistic locking

For admin edit mutations (`update`, `reportScore`, `setSeeds`):
- Input includes `expectedVersion`
- Update must match `version = expectedVersion`
- On mismatch: return conflict error (`BAD_REQUEST` or domain-specific conflict)

---

## 8. Plugin Enablement and Dependency Policy

## 8.1 Enablement

- Activity toggle controls tournaments plugin availability
- Write mutations must reject when plugin is disabled for activity
- Read behavior:
  - dashboard/org reads: reject or null consistently
  - public reads: visibility-filtered and only for published/allowed tournaments

## 8.2 Seeding dependencies

- `seedFromRanking` requires ranking definition for activity
- `seedFromSmartGroups` requires smart-groups enabled and valid config
- If dependency missing, return clear `BAD_REQUEST` with action message

---

## 9. Realtime Strategy (Revised)

## 9.1 Phase A (v1 baseline)

No SSE required initially.
- Use TanStack Query invalidation after mutations
- Optional short polling on active tournament detail pages

## 9.2 Phase B (post-stability)

Add streaming only after core correctness and tests are green.
Two acceptable options:
1. tRPC streaming query channel
2. Dedicated SSE endpoint with full auth + scope checks and reconnect behavior

Do not use in-memory emitter as long-term architecture assumption.

---

## 10. Routing and UI Plan (Revised)

## 10.1 Dashboard routes

- `/dashboard/org/$orgId/activities/$activityId/tournaments`
- `/dashboard/org/$orgId/activities/$activityId/tournaments/create`
- `/dashboard/org/$orgId/activities/$activityId/tournaments/$tournamentId`
- `/dashboard/org/$orgId/activities/$activityId/tournaments/$tournamentId/participants`

## 10.2 Public routes

- `/$username/$groupSlug/activities/$activitySlug/tournaments`
- `/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId`
- `/$username/$groupSlug/activities/$activitySlug/tournaments/$tournamentId/matches/$matchId`

## 10.3 Activity settings integration

Add a tournaments section to:
- `src/routes/dashboard/org.$orgId/activities/$activityId/index.tsx`

Pattern should match existing ranking/smart-groups sections.

---

## 11. Security and Isolation Requirements

- All org-member mutations must enforce org + activity ownership checks
- Cross-org IDs must return `NOT_FOUND` semantics (non-enumerating)
- Admin-only mutations must enforce owner/admin role
- Public queries must enforce tournament visibility and published-state rules

---

## 12. Testing Plan (Required)

Use existing Vitest split (`unit` + `server`) with DB-backed server tests.

## 12.1 Unit tests

- Bracket generators by format (4, 8, 16, 32 participants)
- Edge graph validity checks:
  - no duplicate `to_match_id + to_slot`
  - every progression mapping resolvable

## 12.2 Server integration tests

- Router auth matrix (`public`, member, admin)
- Cross-org/resource isolation (`NOT_FOUND` behavior)
- Registration idempotency and capacity guards
- Start tournament transaction behavior
- Score/forfeit/disqualify progression correctness
- Seeding dependency fallback errors
- Visibility filtering for public endpoints

## 12.3 Regression tests

- Null-group unique index behavior for rounds/standings
- Entry XOR (`user_id` vs `team_id`) constraints
- Optimistic locking conflict paths

---

## 13. Implementation Sequence

1. Contracts and scope matrix (procedures + route topology)
2. Schema design finalization (including `tournament_match_edge` and constraints)
3. DB wiring + migration generation
4. Data-access + state machine + transaction flows
5. Router endpoints + auth checks + enablement checks
6. Unit tests for bracket/graph generation
7. Server integration tests for security and lifecycle
8. Dashboard read pages
9. Dashboard write interactions (score dialogs, seeding editor)
10. Public read pages
11. Optional realtime phase (after correctness baseline)

---

## 14. Wiring Checklist

- Add tournaments schema to `src/db/index.ts`
- Add tournaments types to `src/db/types.ts`
- Add plugin metadata to `src/plugins/catalog.ts`
- Add router to `src/plugins/registry.ts`
- Add file routes, then regenerate route tree (no manual edits to generated file)

---

## 15. Verification Checklist

1. `pnpm db:generate`
2. `pnpm db:migrate`
3. `pnpm lint`
4. `pnpm test` (unit + server)
5. Manual admin flow: create -> seed -> start -> score -> complete
6. Manual public flow: list/detail visibility checks
7. Security smoke checks for cross-org IDs and role restrictions

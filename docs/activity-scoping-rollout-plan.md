# Activity Scoping Rollout Plan (Org + Activity)

## Goal
Move from org-only scoping to org + activity so one community can run multiple sports cleanly, with per-activity membership, plugins, and analytics.

## Locked Decisions
1. `Organization` remains the community container.
2. Members join org first, then join activities.
3. Activity join modes are:
   1. `open`
   2. `require_approval`
   3. `invite` (hidden by nature)
4. `invite` activities are not shown in public activity discovery.
5. Org owner/admin manage all activities in v1.
6. **Activity join forms**: full implementation from v1. `activity` table has `joinFormSchema` + `joinFormVersion`. `activity_join_request` has `formAnswers`. JSONB storage confirmed — industry-standard for dynamic forms, outperforms EAV, escape hatches exist (GIN indexes, expression indexes, materialized views) if we ever need to query across answers.
7. **Single-activity orgs**: activity layer hidden in UI when org has only 1 activity. DB always has the activity FK. Pure frontend `activities.length === 1` check.
8. **Default group auto-created on onboarding**: named `"{Username}'s Group"`, slug auto-derived from name. Every user gets one — organizers rename and use it, participants ignore it.
9. **Group name not globally unique**: per-user slug uniqueness is sufficient. Two users can both have "Cairo Sports Club" — the URL disambiguates via username prefix (`/mostafa/cairo-sports-club` vs `/ahmed/cairo-sports-club`).
10. **Group display pattern**: always show group name + `by @username` prominently together. Both visually prominent (not tiny muted text). Applies everywhere: group cards, profile headers, session links, dashboard headers.
11. **URL routing**: activities live at `/$username/$groupSlug/activities/$activitySlug`. Session URLs stay flat (`/$username/$groupSlug/sessions/$sessionId`) — no activity slug in session URLs, avoids breaking links.
12. **Invite links**: remain org-only in v1. Activity access for existing org members is managed by owner/admin through activity member management (no activity-scoped invite links).
13. **Member notes**: add nullable `activityId` to existing `memberNote` table. `null` = org-wide note ("great person, always on time"), `activityId = <id>` = activity-specific note ("intermediate padel level"). Both show on member profile, grouped by context.
14. **GroupMemberProfile**: stays org-scoped. Org-level join form captures "who are you in this community." Activity-specific data lives in activity join form answers.
15. **activity_member.status**: `pending | active | rejected`. Rejected users can re-apply (partial unique index on `pending` only, same pattern as `joinRequest`). No `banned` status in v1.

## Data Model (v1)

### New Tables
1. New `activity` table:
   1. `id`
   2. `organizationId`
   3. `name`
   4. `slug`
   5. `joinMode` (`open|require_approval|invite`)
   6. `joinFormSchema` (JSONB, nullable)
   7. `joinFormVersion` (integer, default 1)
   8. `createdBy`
   9. timestamps
2. New `activity_member` table:
   1. `activityId`
   2. `userId`
   3. `status` (`pending|active|rejected`)
   4. `role` (`member` for now)
   5. timestamps
   6. unique `(activityId, userId)`
3. New `activity_join_request` table:
   1. `id`
   2. `activityId`
   3. `userId`
   4. `status` (`pending|approved|rejected`)
   5. `message`
   6. `formAnswers` (JSONB, nullable)
   7. `reviewedBy`, `reviewedAt`, timestamps
   8. partial unique index on `(activityId, userId) WHERE status = 'pending'`

### Modified Tables
4. `event_session`: add `activityId` (NOT NULL FK to activity).
5. `invite_link`: unchanged (org-level invite links only).
6. `member_note`: add nullable `activityId` FK. `null` = org-wide note, set = activity-specific note.

### Indexes
7. `activity(organization_id, slug)` unique
8. `event_session(activity_id, date_time)`
9. `activity_member(activity_id, user_id, status)`
10. `activity_join_request(activity_id, user_id)` partial on `status = 'pending'`
11. `member_note(activity_id, target_user_id)` (for filtering notes by activity)

## Core Rules
1. Session belongs to exactly one activity.
2. User can join a session only if `activity_member.status = active`.
3. If not active:
   1. `open`: auto-create active activity membership, then join session.
   2. `require_approval`: create pending request, block session join.
   3. `invite`: block unless invited/admin-added.
4. Org membership is still required before any activity membership.

## Plugin Scoping
1. Add plugin metadata scope:
   1. `org`
   2. `activity`
2. Activity-scoped plugins read/write with `activityId`.
3. Org-scoped plugins remain unchanged.
4. Plugin toggle stays org-level (`enabledPlugins` on `organizationSettings`). Plugin data is activity-scoped.
5. Analytics supports:
   1. activity filter
   2. all-activities rollup

## API Plan
1. `activity` router:
   1. create/update/list/get
   2. list public joinable activities (exclude `invite`)
2. `activityMembership` router:
   1. join
   2. request
   3. approve/reject
   4. invite/add
   5. my activity memberships
3. Update `session` router:
   1. create/update require `activityId`
   2. list supports `activityId` filter
4. Update `inviteLink` router:
   1. org-level invite links only (existing behavior)
5. Update `memberNote` router:
   1. create/list support optional `activityId` filter
6. Add scope helper similar to org scope:
   1. `withActivityScope(orgId, activityId, ...)`

## URL Routing
1. Activity pages: `/$username/$groupSlug/activities/$activitySlug`
2. Session pages: `/$username/$groupSlug/sessions/$sessionId` (unchanged, no activity in URL)
3. No activity invite links in v1.

## UI Plan
1. Org dashboard gets activity switcher/filter (hidden when only 1 activity).
2. Session create flow requires activity selection (auto-selected when only 1 activity).
3. Activity directory page:
   1. show `open` + `require_approval`
   2. hide `invite`
4. Session page handles "not activity member yet" states with clear CTA.
5. Member profile shows notes grouped by context (org-wide vs activity-specific).

## Onboarding Flow
1. User signs up → selects interests → completes onboarding.
2. System auto-creates default group: `"{Username}'s Group"` with slug derived from name.
3. System auto-creates default `"General"` activity within that group.
4. Organizers rename the group from settings and start creating sessions/activities.
5. Participants ignore their auto-created group and join other groups via invite links.

## Migration Plan
1. Phase 1:
   1. create new tables (`activity`, `activity_member`, `activity_join_request`)
   2. add nullable `event_session.activity_id`
   3. add nullable `member_note.activity_id`
2. Phase 2:
   1. create default `"General"` activity per org
   2. backfill all existing sessions to default activity
   3. create active `activity_member` for users who already participated
3. Phase 3:
   1. make `event_session.activity_id` NOT NULL
   2. switch APIs/UI to activity-aware behavior
4. Phase 4:
   1. enable activity filters in analytics/revenue
   2. add activity-scoped plugin execution

## Security and Integrity Guardrails
1. Enforce org+activity scope in one shared utility.
2. Never fetch by `activityId` without validating org ownership.
3. Uniform not-found behavior for cross-org/activity IDs.
4. Add regression tests for cross-tenant/activity leakage.

## Testing Plan
1. Unit tests for join policy rules.
2. Router tests for open/approval/invite flows.
3. Session-join tests for auto-enroll vs blocked.
4. Invite link tests for org-only behavior.
5. Member note tests for org-wide vs activity-scoped notes.
6. Analytics tests:
   1. per-activity
   2. all-activity rollup
7. Security tests for scope boundaries.

## Implementation Order (Recommended)
1. DB schema + migrations
2. Scope utilities
3. Activity CRUD APIs
4. Activity membership/request APIs
5. Session API changes (require `activityId`)
6. Invite link checks (org-level only)
7. Member note changes (optional `activityId`)
8. UI: activity selection + join flows
9. UI: activity layer visibility logic (hide when 1 activity)
10. Analytics filters + plugin scope

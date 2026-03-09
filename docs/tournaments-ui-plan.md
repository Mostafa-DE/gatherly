# Tournaments Plugin — UI Implementation Plan

## Context

The tournaments backend is complete: 11 DB tables, 6 bracket formats, state machines, 35+ tRPC endpoints, seeding strategies, Swiss/group advancement, public API, and 186 passing tests (8 test files: 7 bracket unit + 1 server integration). Zero UI exists. This plan covers all frontend work needed to make the feature end-to-end.

### Reference Files

| Pattern | File |
|---------|------|
| Activity settings page (plugin sections) | `src/routes/dashboard/org.$orgId/activities/$activityId/index.tsx` |
| Dedicated plugin page | `src/routes/dashboard/org.$orgId/activities/$activityId/smart-groups.tsx` |
| Plugin section component | `src/plugins/smart-groups/components/smart-groups-section.tsx` |
| Ranking management UI | `src/plugins/ranking/components/ranking-management.tsx` |
| Public activity page | `src/routes/$username.$groupSlug/activities.$activitySlug.tsx` |
| Design system | `docs/DESIGN_SYSTEM.md` |
| tRPC client | `src/lib/trpc.ts` |
| Tournament router (all endpoints) | `src/plugins/tournaments/router.ts` |
| Tournament types & constants | `src/plugins/tournaments/types.ts` |
| Tournament Zod schemas | `src/plugins/tournaments/schemas.ts` |
| Tournament state machine | `src/plugins/tournaments/state-machine.ts` |
| Public data-access (column projections) | `src/plugins/tournaments/data-access/public.ts` |

### Tech Stack (from CLAUDE.md)

- React 19, TanStack Router (file-based), TanStack Query via tRPC, Tailwind CSS, shadcn/ui, Jotai
- No `"use client"` / `"use server"` — this is TanStack Start + Nitro, NOT Next.js
- tRPC 11 with `trpc.plugin.tournaments.*` namespace
- `@/components/ui/*` for shadcn components (Button, Card, Badge, Dialog, Tabs, etc.)
- DM Sans font, JetBrains Mono for numbers/stats

---

## Status Badge Color Mapping

All status badges follow `docs/DESIGN_SYSTEM.md` conventions:

| Status | Badge Style |
|--------|-------------|
| `draft` | `bg-gray-100 text-gray-600` / `bg-gray-800 text-gray-400` |
| `registration` | `bg-blue-50 text-blue-700` / `bg-blue-900/40 text-blue-400` |
| `check_in` | `bg-yellow-50 text-yellow-700` / `bg-yellow-900/40 text-yellow-400` |
| `in_progress` | `bg-green-50 text-green-700` / `bg-green-900/40 text-green-400` |
| `completed` | `bg-primary/10 text-primary` |
| `cancelled` | `bg-red-50 text-red-700` / `bg-red-900/40 text-red-400` |
| `pending` (match/stage) | `bg-gray-100 text-gray-600` / `bg-gray-800 text-gray-400` |
| `forfeit` | `bg-red-50 text-red-700` |
| `bye` | `bg-gray-100 text-gray-500` |
| `eliminated` | `bg-red-50 text-red-700` |
| `withdrawn` | `bg-gray-100 text-gray-500` |
| `disqualified` | `bg-red-100 text-red-800` |

---

## Tournament Status Flow (for UI state transitions)

```
draft → registration → check_in → in_progress → completed
  ↓         ↓            ↓            ↓
cancelled  cancelled   cancelled    cancelled
```

The UI must only show valid next-status buttons based on `state-machine.ts` transitions. The `updateStatus` endpoint handles lifecycle logic (e.g., `in_progress` triggers `startTournament` which generates brackets).

---

## Phase 1: Activity Settings Integration + Tournament List

### 1A. Activity Settings Section

**File:** `src/plugins/tournaments/components/tournaments-section.tsx`

**Pattern:** Follow `src/plugins/smart-groups/components/smart-groups-section.tsx`

- Conditionally rendered when `enabledPlugins["tournaments"] === true`
- Shows a summary card: count of tournaments, active tournaments, link to dedicated page
- Section header: Trophy icon + "Tournaments" heading + "Manage" button linking to `/dashboard/org/{orgId}/activities/{activityId}/tournaments`
- Uses `trpc.plugin.tournaments.listByActivity.useQuery({ activityId })` for counts

**Integration point:** Add to `src/routes/dashboard/org.$orgId/activities/$activityId/index.tsx` alongside existing RankingManagement and SmartGroupsSection, conditionally rendered when tournaments plugin is enabled.

### 1B. Tournament List Page

**File:** `src/routes/dashboard/org.$orgId/activities/$activityId/tournaments/index.tsx`

**Route:** `/dashboard/org/:orgId/activities/:activityId/tournaments`

**Pattern:** Follow `src/routes/dashboard/org.$orgId/activities/$activityId/smart-groups.tsx` structure

**Layout:**
- Header: Back arrow → activity settings, "Tournaments" title, "Create Tournament" primary button (admin only)
- Status filter tabs: All | Draft | Registration | In Progress | Completed | Cancelled
- Tournament cards in a list

**Tournament card row:**
```
[Format Icon] Tournament Name          [Status Badge]
              Single Elimination · 16 participants · Starts Mar 15
              [Open] [Edit] [Delete] (admin actions)
```

**Data:** `trpc.plugin.tournaments.listByActivity.useQuery({ activityId, status? })`

**Actions:**
- Click card → navigates to tournament detail page
- "Create Tournament" → navigates to `/tournaments/create` page
- "Delete" (draft only) → AlertDialog confirmation → `deleteDraft` mutation

### 1C. Create Tournament Page

**File:** `src/routes/dashboard/org.$orgId/activities/$activityId/tournaments/create.tsx`

**Route:** `/dashboard/org/:orgId/activities/:activityId/tournaments/create`

Dedicated full page (not a dialog) per the v2 plan. This gives enough room for format-specific config fields without cramming into a modal.

**Layout:**
- Header: Back arrow → tournament list, "Create Tournament" title
- Form card with sections

**Fields:**
- `name` — text input, required
- `slug` — text input, auto-generated from name, editable
- `format` — select dropdown: Single Elimination, Double Elimination, Round Robin, Swiss, Group + Knockout, Free For All
- `participantType` — radio: Individual / Team
- `visibility` — select: Activity Members / Org Members / Public
- `seedingMethod` — select: Manual / Random / From Ranking / From Smart Groups
- `maxCapacity` — optional number input
- `startsAt` — optional date-time picker
- `registrationOpensAt` — optional date-time picker
- `registrationClosesAt` — optional date-time picker

**Format-specific config** (shown conditionally based on format selection):
- Swiss: `swissRounds` (number, required)
- Group + Knockout: `groupCount` (number), `advancePerGroup` (number)
- Single/Double Elimination: `thirdPlaceMatch` (checkbox)
- Team tournaments: `minTeamSize`, `maxTeamSize` (numbers)

**Points config** (optional expandable section):
- `points.win`, `points.loss`, `points.draw`, `points.bye` — number inputs

**Mutation:** `trpc.plugin.tournaments.create.useMutation()`
**On success:** Invalidate `listByActivity`, navigate to new tournament detail page

---

## Phase 2: Tournament Detail Page (Pre-Start Management)

### 2A. Tournament Detail Layout

**File:** `src/routes/dashboard/org.$orgId/activities/$activityId/tournaments/$tournamentId/index.tsx`

**Route:** `/dashboard/org/:orgId/activities/:activityId/tournaments/:tournamentId`

**Layout:**
- Header: Back arrow → tournament list, tournament name, status badge, format badge
- **Status action bar** (admin only): Shows valid next-status buttons based on current state
  - `draft` → "Open Registration" button
  - `registration` → "Open Check-In" or "Start Tournament" button
  - `check_in` → "Start Tournament" button
  - `in_progress` → "Cancel Tournament" button (destructive, AlertDialog)
  - `completed` / `cancelled` → no actions
- Tabs: Overview | Participants | Seeding | Bracket | Matches | Standings

**Data:** `trpc.plugin.tournaments.getById.useQuery({ tournamentId })`

### 2B. Overview Tab

**File:** `src/plugins/tournaments/components/tournament-overview.tsx`

Displays tournament metadata in a details grid (pattern: session detail hero card):

| Field | Display |
|-------|---------|
| Format | Badge with human label (e.g., "Single Elimination") |
| Participant Type | Individual / Team |
| Visibility | Activity Members / Org Members / Public |
| Seeding Method | Manual / Random / Ranking / Smart Groups |
| Max Capacity | Number or "Unlimited" |
| Starts At | Formatted date-time or "Not set" |
| Registration Opens | Formatted date-time or "Not set" |
| Registration Closes | Formatted date-time or "Not set" |
| Rules | Expandable text block (if `config.rulesText` set) |

**Edit button** (admin, draft/registration only) → opens EditTournamentDialog (same form fields as the create page, rendered in a dialog with pre-filled values, sends `update` mutation with `expectedVersion`)

### 2C. Participants Tab

**File:** `src/plugins/tournaments/components/participants-tab.tsx`

**For individual tournaments:**
- Table: # | Name | Avatar | Status | Seed | Actions
- Admin actions per row: Check In (if registered), Disqualify (if active), Remove (dropdown)
- Admin header actions: "Add Participant" button → opens member search dialog → `adminRegister` mutation
- Member self-service (non-admin): "Register" / "Withdraw" button at top

**For team tournaments:**
- Team cards list, each expandable to show roster
- Admin actions: "Create Team" dialog, "Register Team" button (per team), "Remove Member" (per member)
- Member self-service: "Join Team" / "Leave Team" buttons

**Data:**
- Individual: `trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId })`
- Teams: `trpc.plugin.tournaments.listTeams.useQuery({ tournamentId })`

**Member search dialog** (for adminRegister): Search activity members, select one, confirm. Uses `trpc.activityMembership.members.useQuery({ activityId })` for the member list.

### 2D. Seeding Tab

**File:** `src/plugins/tournaments/components/seeding-tab.tsx`

**Visible when:** Tournament is in `draft`, `registration`, or `check_in` status

**Layout:**
- Numbered list of entries ordered by current seed
- Drag-and-drop reordering (or up/down arrow buttons for simplicity)
- Action buttons at top:
  - "Save Seeds" → `setSeeds` mutation (sends full array, uses `expectedVersion`)
  - "Randomize" → `randomizeSeeds` mutation
  - "Seed from Ranking" → opens dialog to select ranking definition → `seedFromRanking` mutation
  - "Seed from Smart Groups" → opens dialog to select smart group run → `seedFromSmartGroups` mutation

**Seed row:**
```
[#1] [Avatar] Player Name     [drag handle or ↑↓ arrows]
[#2] [Avatar] Player Name     [drag handle or ↑↓ arrows]
...
```

**Data:** `trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId })` (ordered by seed)

**Dirty state:** Track local seed order, compare to server. Show "Unsaved changes" indicator + Save button when dirty.

---

## Phase 3: Bracket Visualization

### 3A. Bracket Tab (Dashboard)

**File:** `src/plugins/tournaments/components/bracket-tab.tsx`

**Visible when:** Tournament is `in_progress` or `completed`

**Data:** `trpc.plugin.tournaments.getBracket.useQuery({ tournamentId })`

Returns: `{ stages, groups, rounds, matches, matchEntries, edges }` (no entry summaries — org endpoint returns raw entryIds only)

**Important:** The org `getBracket` response does NOT include participant names/avatars (unlike `publicGetBracket` which joins entry summaries). The bracket tab must also fetch `trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId })` and build a lookup map `entryId → { name, image }` client-side. Pass this map into bracket tree / match card components alongside the bracket data.

**Bracket rendering strategy by format:**

#### Single Elimination / Double Elimination
- Classic tournament bracket tree, rendered left-to-right
- Each round is a column, matches stack vertically
- Lines connect match winners to next round (using `edges` data)
- Double elimination shows winners bracket (top) + losers bracket (bottom) + grand final

#### Round Robin / Swiss
- No bracket tree — show round-by-round match list instead
- Each round is a collapsible section with match cards
- Standings table shown alongside (or as separate tab)

#### Group + Knockout
- Two sections: Group Stage (round-robin tables per group) + Knockout Bracket (tree)
- Group tables show W/L/D/Points per group
- Knockout bracket appears after group stage completes

#### Free For All
- Simple round-by-round display (no bracket tree needed)

### 3B. Bracket Tree Component

**File:** `src/plugins/tournaments/components/bracket-tree.tsx`

This is the highest-complexity component. Implementation approach:

**Data transformation:**
1. Group matches by `roundId`
2. Order rounds by `roundNumber` (columns left to right)
3. Order matches within each round by `matchNumber`
4. Resolve `matchEntries` to get participant names per match slot
5. Use `edges` to draw connector lines between rounds

**Match node:**
```
┌──────────────────────────┐
│ [Seed] Player A Name  2  │  ← winner highlighted (green bg)
│ [Seed] Player B Name  1  │
│ Match #3 · Completed     │
└──────────────────────────┘
```

- Pending matches: gray border, "TBD" for empty slots
- Completed matches: winner row has green-tinted bg
- Bye matches: single entry shown, "BYE" label
- Forfeit matches: red "Forfeit" label on forfeiting entry

**Layout:** CSS Grid or Flexbox with columns per round. Connector lines via SVG overlay or CSS borders (::before/::after pseudo-elements connecting vertically between rounds).

**Sizing:** Match nodes ~240px wide, 80px tall. Vertical spacing doubles each round for proper alignment.

**Scrolling:** Horizontal scroll container for brackets larger than viewport. Optional zoom controls.

**Interactivity (admin):** Click a pending/in_progress match → opens ReportScoreDialog

### 3C. Match Card Component

**File:** `src/plugins/tournaments/components/match-card.tsx`

Reusable match display used in bracket tree and match list views.

**Props:** `match`, `matchEntries`, `entries` (participant summaries), `isAdmin`, `onReportScore`, `onForfeit`

**States:**
- Pending: Gray card, "TBD" slots, no actions
- In Progress: Blue-tinted border, participant names shown
- Completed: Green checkmark on winner, scores displayed
- Forfeit: Red "Forfeit" label
- Bye: Muted card, single participant, "BYE" label

---

## Phase 4: Match Reporting + Standings

### 4A. Matches Tab

**File:** `src/plugins/tournaments/components/matches-tab.tsx`

**Layout:**
- Filter bar: Round selector (dropdown), Status filter (dropdown)
- Match list — vertical stack of MatchCard components
- Admin actions on each match: "Report Score", "Forfeit" buttons

**Data:**
- Match rows: `trpc.plugin.tournaments.getMatches.useQuery({ tournamentId, roundId?, status? })` — returns only match rows (no matchEntries or participant summaries)
- Bracket data: `trpc.plugin.tournaments.getBracket.useQuery({ tournamentId })` — provides `matchEntries` (entryId per match slot) and `edges`
- Participant lookup: `trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId })` — provides `entryId → { name, image }` mapping

The matches tab must combine all three queries: match rows for filtering/pagination, matchEntries from bracket data to populate MatchCard slots, and participants for display names. Build the same `entryId → participant` lookup map used by the bracket tab.

### 4B. Report Score Dialog

**File:** `src/plugins/tournaments/components/report-score-dialog.tsx`

**Fields:**
- Participant A score (number input, label shows participant name)
- Participant B score (number input, label shows participant name)
- Winner selector (radio: Participant A / Participant B) — auto-selected based on higher score, but overridable
- Optional: Additional score fields as key-value pairs (for `scores` Record)

**Validation:**
- Winner must be one of the match participants
- `expectedVersion` sent from match data to prevent stale updates

**Mutation:** `trpc.plugin.tournaments.reportScore.useMutation()`
**On success:** Invalidate `getBracket`, `getMatches`, `getStandings`

### 4C. Forfeit Dialog

**File:** `src/plugins/tournaments/components/forfeit-dialog.tsx`

- Select which entry is forfeiting (dropdown of match participants)
- Confirmation with AlertDialog
- **Mutation:** `trpc.plugin.tournaments.forfeitMatch.useMutation()`

### 4D. Standings Tab

**File:** `src/plugins/tournaments/components/standings-tab.tsx`

**Visible when:** Format uses standings (round_robin, swiss, group, group_knockout)

**Layout:**
- Stage selector (if multiple stages)
- Group selector (if groups exist — tabs or dropdown)
- Standings table:

```
Rank | Participant     | W  | L  | D  | Pts | Tiebreakers
  1  | [Avatar] Alice  | 3  | 0  | 1  | 10  | +5
  2  | [Avatar] Bob    | 2  | 1  | 1  |  7  | +2
  ...
```

- Use JetBrains Mono font for numeric columns
- Highlight advancing positions (top N per group) with subtle green bg

**Data:**
- Standing rows: `trpc.plugin.tournaments.getStandings.useQuery({ tournamentId, stageId?, groupId? })` — returns only standing rows (rank, wins, losses, draws, points, tiebreakers, entryId)
- Stage/group metadata: `trpc.plugin.tournaments.getBracket.useQuery({ tournamentId })` — provides `stages` and `groups` arrays for the stage selector and group tabs
- Participant lookup: `trpc.plugin.tournaments.getParticipants.useQuery({ tournamentId })` — provides `entryId → { name, image }` mapping for participant names in the table

The standings tab must combine all three: standings for the table data, bracket for stage/group selectors, and participants for display names. Advancing row highlight logic uses `config.advancePerGroup` from the tournament's config.

### 4E. Advancement Controls

**File:** `src/plugins/tournaments/components/advancement-controls.tsx`

Rendered in the status action bar when applicable:

- **Swiss format, in_progress:** "Generate Next Round" button → `advanceSwissRound` mutation. Disabled if current round isn't complete. Shows round number (e.g., "Generate Round 3 of 5").
- **Group + Knockout format, group stage completed:** "Generate Knockout Bracket" button → `advanceGroupStage` mutation. Shows how many entries will advance.

Both use AlertDialog for confirmation with a summary of what will happen.

---

## Phase 5: Team Management UI

### 5A. Team Cards in Participants Tab

**File:** `src/plugins/tournaments/components/team-card.tsx`

When `participantType === "team"`, the Participants tab renders team cards instead of a flat entry table.

**Team card:**
```
┌─────────────────────────────────────────┐
│ Team Alpha                [Registered]  │
│ Captain: Alice · 3/4 members            │
│                                         │
│  [Avatar] Alice (Captain)               │
│  [Avatar] Bob             [Remove]      │
│  [Avatar] Charlie         [Remove]      │
│                                         │
│  [Register Team]  [Join Team]           │
└─────────────────────────────────────────┘
```

- Admin sees: "Register Team", "Remove Member" buttons
- Members see: "Join Team" (if not on a team), "Leave Team" (if on this team)
- Registration status badge per team entry
- Member count vs min/max constraints shown

### 5B. Create Team Dialog

**File:** `src/plugins/tournaments/components/create-team-dialog.tsx`

Admin only. Fields:
- Team name (text input)
- Captain (member search — must be active activity member)

**Mutation:** `trpc.plugin.tournaments.createTeam.useMutation()`

---

## Phase 6: Public Tournament Pages

All public routes are activity-scoped, matching the existing `/$username/$groupSlug/activities.$activitySlug.tsx` pattern from the v2 plan.

### 6A. Public Tournament List

**File:** `src/routes/$username.$groupSlug/activities.$activitySlug/tournaments/index.tsx`

**Route:** `/:username/:groupSlug/activities/:activitySlug/tournaments`

**Integration:** Also add a "Tournaments" section to `src/routes/$username.$groupSlug/activities.$activitySlug.tsx` below existing content, linking to this page when the activity has public tournaments.

**Data:** `trpc.plugin.tournaments.publicListByActivity.useQuery({ activityId })`

Shows tournament cards (name, format, status, date) with links to public detail page.

### 6B. Public Tournament Detail Page

**File:** `src/routes/$username.$groupSlug/activities.$activitySlug/tournaments/$tournamentId/index.tsx`

**Route:** `/:username/:groupSlug/activities/:activitySlug/tournaments/:tournamentId`

Read-only page, no auth required. Only shows for `visibility: "public"` and non-draft status.

**Layout:**
- Tournament name, format badge, status badge, start date
- Tabs: Bracket | Standings | Matches

**Data:**
- Tournament info: `trpc.plugin.tournaments.publicGetById.useQuery({ tournamentId })`
- Bracket: `trpc.plugin.tournaments.publicGetBracket.useQuery({ tournamentId })`
- Standings: `trpc.plugin.tournaments.publicGetStandings.useQuery({ tournamentId })`

Reuses the same bracket tree, standings table, and match card components from dashboard — but without admin actions. Pass `isAdmin={false}` to all shared components.

**Public data is safe:** `data-access/public.ts` selects only public columns (no organizationId, config internals, etc.)

### 6C. Public Match Detail Page

**File:** `src/routes/$username.$groupSlug/activities.$activitySlug/tournaments/$tournamentId/matches/$matchId.tsx`

**Route:** `/:username/:groupSlug/activities/:activitySlug/tournaments/:tournamentId/matches/:matchId`

Read-only match detail page. Shows match participants, scores, status, stage/round context.

**Data:** `trpc.plugin.tournaments.publicGetMatch.useQuery({ tournamentId, matchId })`

Reuses the MatchCard component with `isAdmin={false}`. Shows stage name, round number, group name (if applicable), and links back to the tournament bracket view.

---

## Phase 7: Navigation + Wiring

### 7A. Activity Settings Integration

**Modify:** `src/routes/dashboard/org.$orgId/activities/$activityId/index.tsx`

Add alongside existing plugin sections:
```tsx
{enabledPlugins?.["tournaments"] && (
  <TournamentsSection activityId={activityId} orgId={orgId} isAdmin={isAdmin} />
)}
```

Also add a "Tournaments" nav button in the activity header (like the existing "Smart Groups" button), linking to the tournaments list page.

**Note:** No sidebar modification needed. Tournaments navigation lives only in the activity settings header (activity-level plugin nav buttons), consistent with how Smart Groups and Ranking are wired. The global `nav-main.tsx` sidebar does not have per-activity plugin entries.

---

## File Structure Summary

```
src/plugins/tournaments/
├── components/
│   ├── tournaments-section.tsx        # Activity settings integration (Phase 1A)
│   ├── tournament-overview.tsx        # Overview tab (Phase 2B)
│   ├── participants-tab.tsx           # Participants management (Phase 2C)
│   ├── seeding-tab.tsx                # Seed management (Phase 2D)
│   ├── bracket-tab.tsx                # Bracket container + format dispatch (Phase 3A)
│   ├── bracket-tree.tsx               # Elimination bracket tree renderer (Phase 3B)
│   ├── match-card.tsx                 # Reusable match display (Phase 3C)
│   ├── matches-tab.tsx               # Match list + filters (Phase 4A)
│   ├── report-score-dialog.tsx        # Score entry dialog (Phase 4B)
│   ├── forfeit-dialog.tsx             # Forfeit confirmation (Phase 4C)
│   ├── standings-tab.tsx              # Standings table (Phase 4D)
│   ├── advancement-controls.tsx       # Swiss/Group advancement (Phase 4E)
│   ├── team-card.tsx                  # Team roster display (Phase 5A)
│   └── create-team-dialog.tsx         # Team creation dialog (Phase 5B)

src/routes/
├── dashboard/org.$orgId/activities/$activityId/
│   └── tournaments/
│       ├── index.tsx                  # Tournament list page (Phase 1B)
│       ├── create.tsx                 # Create tournament page (Phase 1C)
│       └── $tournamentId/
│           └── index.tsx              # Tournament detail page (Phase 2A)
└── $username.$groupSlug/
    └── activities.$activitySlug/
        └── tournaments/
            ├── index.tsx              # Public tournament list (Phase 6A)
            └── $tournamentId/
                ├── index.tsx          # Public tournament detail (Phase 6B)
                └── matches/
                    └── $matchId.tsx   # Public match detail (Phase 6C)
```

---

## Shared Component Dependencies

These shadcn/ui components are already available in `src/components/ui/`:
- Button, Badge, Card, Skeleton, Input, Label, Switch
- Dialog, AlertDialog, Dropdown Menu
- Select, Tabs, Avatar, Separator, Scroll Area
- Calendar, DateTime Picker (for tournament dates)

No new shadcn components need to be added.

---

## Data Flow Summary

### Dashboard (authenticated)

```
Component
  → trpc.plugin.tournaments.{endpoint}.useQuery/useMutation()
  → tRPC HTTP Batch Link
  → /api/trpc/$ handler
  → orgProcedure (checks org membership)
  → router.ts endpoint (checks admin role, tournament existence)
  → data-access layer
  → Drizzle ORM → PostgreSQL
```

### Public (unauthenticated)

```
Component
  → trpc.plugin.tournaments.public{endpoint}.useQuery()
  → tRPC HTTP Batch Link
  → /api/trpc/$ handler
  → publicProcedure (no auth)
  → router.ts endpoint (checks visibility=public, status≠draft)
  → data-access/public.ts (safe column projection)
  → Drizzle ORM → PostgreSQL
```

---

## Build Order & Dependencies

| Phase | Depends On | Deliverable |
|-------|-----------|-------------|
| 1A | Nothing | Tournaments section on activity settings |
| 1B | 1A | Tournament list page |
| 1C | 1B | Create tournament page |
| 2A | 1B, 1C | Tournament detail page shell + tabs |
| 2B | 2A | Overview tab |
| 2C | 2A | Participants tab (individual + team) |
| 2D | 2A, 2C | Seeding tab |
| 3A | 2A | Bracket tab (dispatches by format) |
| 3B | 3A | Bracket tree renderer (elimination formats) |
| 3C | 3A | Match card component |
| 4A | 3C | Matches tab (list view) |
| 4B | 4A | Report score dialog |
| 4C | 4A | Forfeit dialog |
| 4D | 2A | Standings tab |
| 4E | 4D | Advancement controls (Swiss, Group→Knockout) |
| 5A | 2C | Team card component |
| 5B | 5A | Create team dialog |
| 6A | Nothing (public API ready) | Public tournament list on activity page |
| 6B | 3B, 4D | Public tournament detail page |
| 6C | 6B | Public match detail page |
| 7A | 1A | Activity settings wiring |

---

## Verification Checklist

For each phase, verify:

1. `pnpm dev` — page renders without errors
2. `pnpm lint` — no type errors or ESLint violations
3. Manual test: navigate to the page, perform the action, verify data updates
4. Admin guard: non-admin users cannot see/use admin-only actions
5. Loading states: Skeleton components shown while data fetches
6. Error states: Error messages shown for failed mutations (toasts or inline)
7. Empty states: Meaningful message + CTA when no data exists
8. Responsive: Bracket tree scrolls horizontally on mobile, tables stack or scroll
9. Public pages: No internal data leaked (check browser network tab)

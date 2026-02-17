# Ranking Plugin — Implementation Plan

## Context

Enhance member profiles with a ranking system. Admin picks a **domain** (e.g., Padel — works for any activity type: sports, reading, yoga, etc.) which determines pre-defined stat fields to track. Admin defines custom levels (e.g., D- to A+). Ranking is a plugin, scoped **per-activity**.

A "domain" is just a code-defined template of stat fields — not sport-specific. Adding a new domain = add one file + register it. No schema changes needed.

## MVP Scope

- **Manual level assignment only** — admin assigns levels by hand (auto-ranking deferred)
- **Numbers only** — all stats are plain integer counters
- **Padel domain only** — first domain template
- **Admin records stats** — member self-reporting deferred
- Schema includes `autoRankConfig` JSONB column (reserved for future scoring models: weighted sum, thresholds, milestones)

## Plugin Enablement — Activity-Level

The `rankingDefinition` record itself IS the enablement — no separate toggle needed.

- **Enabled** = a `rankingDefinition` exists for the activity with `isActive: true`
- **Disabled** = no definition exists, or `isActive: false` (soft-disable, data preserved)
- **Catalog** registers ranking as `scope: "activity"`
- Admin flow: activity settings → "Set up Rankings" → creates definition → ranking is live

## How It Works

1. Admin opens activity settings → sees "Rankings" option
2. Admin creates a ranking → picks a **domain** (e.g., Padel)
3. Domain determines the **stat fields** (Wins, Losses, Sets Won, Sets Lost, Matches Played) — code-defined
4. Admin defines **custom levels** (names, order, colors) — e.g., D-, D, D+, C-, C, C+, B-, B, B+, A-, A, A+
5. Admin **manually assigns** a level to a member
6. Admin can **record stats** for a member after sessions
7. Member profile shows an **enhanced rank card** with level and stats

---

## Database — 3 New Tables in `src/db/schema.ts`

### `rankingDefinition` — One per activity

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | CUID2 |
| `activityId` | text FK → activity (UNIQUE) | One ranking per activity |
| `organizationId` | text FK → organization | Org scoping |
| `name` | text | Display name |
| `domainId` | text | "padel" — determines stat fields |
| `levels` | jsonb | `[{ id, name, color, order }]` — custom levels |
| `autoRankConfig` | jsonb? | Reserved for future auto-ranking |
| `isActive` | boolean | Default true — enable/disable toggle |
| `createdBy` | text FK → user | |
| `createdAt` | timestamptz | |
| `updatedAt` | timestamptz | |

### `memberRank` — Current rank per member

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | CUID2 |
| `rankingDefinitionId` | text FK | |
| `userId` | text FK | |
| `currentLevelId` | text? | References a level `id` from definition's `levels` jsonb |
| `stats` | jsonb | Cumulative: `{ wins: 15, losses: 8, ... }` |
| `lastActivityAt` | timestamptz? | |
| `createdAt` / `updatedAt` | timestamptz | |

Indexes: UNIQUE `(rankingDefinitionId, userId)`, `(userId)`

### `rankStatEntry` — Per-session stat records (audit trail)

| Column | Type | Purpose |
|--------|------|---------|
| `id` | text PK | CUID2 |
| `rankingDefinitionId` | text FK | |
| `userId` | text FK | |
| `sessionId` | text? FK → eventSession | Optional session link |
| `stats` | jsonb | Delta: `{ wins: 1, losses: 0 }` |
| `recordedBy` | text FK → user | Audit |
| `notes` | text? | |
| `createdAt` | timestamptz | |

---

## Domain Catalog — Code-Defined

File: `src/plugins/ranking/domains/index.ts`

### Padel (`domains/padel.ts`)

```
id: "padel"
name: "Padel"
statFields:
  - { id: "matches_played", label: "Matches Played" }
  - { id: "wins", label: "Wins" }
  - { id: "losses", label: "Losses" }
  - { id: "sets_won", label: "Sets Won" }
  - { id: "sets_lost", label: "Sets Lost" }
```

---

## Plugin Files

### Create (11 files)

```
src/plugins/ranking/
├── types.ts                          # Types: LevelDef, Domain
├── schemas.ts                        # Zod schemas
├── router.ts                         # tRPC procedures
├── domains/
│   ├── index.ts                      # Domain registry + lookup
│   └── padel.ts                      # Padel stat definitions
├── data-access/
│   ├── ranking-definitions.ts
│   ├── member-ranks.ts
│   └── stat-entries.ts
└── components/
    ├── member-rank-card.tsx           # Profile display card
    ├── ranking-setup-form.tsx         # Create/edit ranking definition
    └── stat-recording-dialog.tsx      # Record stats for a member
```

### Modify (5 files)

| File | Change |
|------|--------|
| `src/db/schema.ts` | Add 3 tables + relations |
| `src/plugins/catalog.ts` | Add ranking plugin entry (`scope: "activity"`) |
| `src/plugins/registry.ts` | Register ranking router |
| `src/routes/dashboard/org.$orgId/members/$userId.tsx` | Add rank card section |
| `src/routes/dashboard/org.$orgId/profile.tsx` | Add rank card (self-view) |

---

## tRPC Router

| Procedure | Type | Access | Purpose |
|-----------|------|--------|---------|
| `listDomains` | query | member | List available domains |
| `getByActivity` | query | member | Get ranking definition for an activity |
| `create` | mutation | admin | Create ranking for an activity (= enable) |
| `update` | mutation | admin | Update levels or toggle `isActive` |
| `assignLevel` | mutation | admin | Manually set a member's level |
| `recordStats` | mutation | admin | Record stats for a member |
| `getLeaderboard` | query | member | Members sorted by level order |
| `getMemberRank` | query | member | Single member rank detail |
| `getMemberRanksByUser` | query | member | All ranks for a user across activities |

---

## Build Sequence

1. Schema — 3 tables + relations + migration
2. Types + Schemas — TypeScript types, Zod validation
3. Domains — Padel stat definitions
4. Data Access — 3 files (definitions, ranks, entries)
5. Router — tRPC procedures
6. Plugin registration — catalog + registry
7. UI — Setup form, stat recording, rank card
8. Profile integration — wire card into profile pages

## Verification

1. `pnpm db:generate && pnpm db:migrate` — migration applies
2. `pnpm lint` — no type errors
3. Manual test: open activity settings → create padel ranking → define levels (D- to A+) → assign member level → record stats → view profile card

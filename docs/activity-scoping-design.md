# Activity Scoping Design — Plugin & Session Architecture

## Status: Open Discussion

---

## The Problem

Currently: **Org = Group (1:1)**, and plugins are scoped to the org. If future plugins like ranking, tournaments, and matchmaking are org-scoped, here's what breaks:

| Scenario | What happens |
|----------|-------------|
| Padel player ranked alongside tennis player | Nonsensical ranking |
| Tournament created org-wide | Mixes activities that shouldn't be mixed |
| Matchmaking org-wide | Pairs people across unrelated activities |
| Analytics org-wide | Can't see "how are my padel sessions doing vs tennis?" |

A community owner running padel + tennis + board games in **one org** would get all their plugin data mixed together.

---

## The Two Paths

### Path A: Expect users to create multiple orgs (one per activity)

- No schema change needed
- **But**: fragments the community. Members join 3 orgs instead of 1. Owner manages 3 dashboards. Shared announcements? Shared member directory? Gone.
- Real-world behavior: **people won't do this**.

### Path B: Add an "Activity" concept inside the org

- Org stays as the community container (one org = "Cairo Sports Club")
- Activities live under the org: Padel, Tennis, Board Games
- Sessions belong to an Activity
- Plugins (rank, tournament, matchmaking) scope to **Activity**, not Org
- Analytics can filter by activity or show org-wide
- Members belong to the org once, but can participate in multiple activities

```
Organization (community)
├── Activity: Padel
│   ├── Sessions...
│   ├── Rankings (plugin, scoped here)
│   └── Tournaments (plugin, scoped here)
├── Activity: Tennis
│   ├── Sessions...
│   └── Rankings (plugin, scoped here)
└── Activity: Board Games
    └── Sessions...
```

---

## Implementation Options (Path B)

### Lightweight Version

- Add a simple `activity` table (`id`, `name`, `orgId`)
- Add an optional `activityId` FK on `eventSession`
- Plugins receive the activity scope when available
- Sessions without an activity stay org-wide (backward compatible)

### Heavier Version

- Activities become a full entity with their own settings, member subscriptions, join forms, etc.
- More flexibility, but significantly more complexity

---

## Open Questions

1. **Is this something to design now**, or just flag for the future? (The MVP resolved decision was "no separate Activity entity for MVP")
2. **Should Activity be required on sessions**, or optional (so simple single-activity orgs don't need it)?
3. **Do Activities have their own member lists** (e.g., "I'm in the Padel activity but not Tennis"), or is org membership enough?

These answers shape how much complexity to add.

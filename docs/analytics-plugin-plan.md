# Analytics Plugin Plan

## Context

Gatherly currently only has per-user engagement stats (sessions attended, attendance rate, no-shows). There are **no org-level aggregate analytics** — organizers can't see trends, growth, or performance across their group. This plugin adds an analytics dashboard so organizers can understand their group's health and session performance at a glance, replacing the "export to Excel and figure it out" workflow.

The plugin follows the existing plugin architecture (`src/plugins/ai/` as reference) and is enabled by default for all organizations.

---

## Decisions (from discussion)

| Decision | Choice |
|----------|--------|
| Scope | All 4 buckets: Group Health, Session Performance, Attendance Patterns, Revenue |
| UI placement | Summary widgets on org overview + dedicated analytics page |
| Data strategy | On-demand (computed from existing tables, no new tables) |
| Visualization | Recharts charts + stat cards |
| Chart library | Recharts via shadcn `chart` component |
| Time ranges | 7d, 30d (default), 90d |
| Access | Owner + Admin only |
| Architecture | `src/plugins/analytics/` (follows existing plugin pattern) |

---

## Metrics Breakdown

### 1. Group Health
- **Total members** (current count)
- **New members** over selected period (line chart)
- **Active members** (attended at least 1 session in period) vs **inactive**
- **Member retention** — % of members from previous period who attended again this period

### 2. Session Performance
- **Total sessions** held in period
- **Average capacity utilization** — mean of (joinedCount / maxCapacity) across sessions
- **Average no-show rate** — mean of (no_shows / joined) per session
- **Capacity utilization over time** (line chart — per session)
- **Most popular sessions** — top 5 by fill rate

### 3. Attendance Patterns
- **Overall show rate** — total shows / total (shows + no-shows) in period
- **Show rate trend** (line chart over time)
- **Peak days** — bar chart of attendance by day of week
- **Top attendees** — top 5 members by sessions attended in period
- **Repeat rate** — % of attendees who came to 2+ sessions in period

### 4. Revenue
- **Total revenue** in period (sum of price * paid participants)
- **Revenue per session** (average)
- **Payment collection rate** — % paid of those who should pay (sessions with price > 0)
- **Outstanding payments** — count of unpaid participations for priced sessions
- **Revenue trend** (line chart over time)

---

## Implementation Steps

### Step 1: Install shadcn chart component

```bash
npx shadcn@latest add chart
```

This installs Recharts + creates `src/components/ui/chart.tsx`. Chart CSS variables already exist in `src/styles.css`.

### Step 2: Plugin structure — create files

```
src/plugins/analytics/
├── router.ts           # tRPC endpoints (orgProcedure, admin-only)
├── queries.ts          # All SQL query functions
├── types.ts            # TypeScript types for analytics data
└── components/
    ├── analytics-summary.tsx    # Summary widget cards for org overview
    ├── group-health.tsx         # Member growth chart + active/inactive
    ├── session-performance.tsx  # Capacity utilization, no-show rate
    ├── attendance-patterns.tsx  # Show rate trend, peak days, top attendees
    └── revenue-overview.tsx     # Revenue charts + payment stats
```

### Step 3: Register plugin

**Modify `src/plugins/catalog.ts`** — Add analytics plugin metadata:
```typescript
{ id: "analytics", name: "Analytics", description: "Group analytics and insights for organizers" }
```

**Modify `src/plugins/registry.ts`** — Import and register `analyticsRouter`.

### Step 4: Types (`src/plugins/analytics/types.ts`)

Define return types for each analytics bucket:
- `GroupHealthStats` — totalMembers, newMembers, activeMembers, inactiveMembers, retentionRate, memberGrowth (array of { date, count })
- `SessionPerformanceStats` — totalSessions, avgCapacityUtilization, avgNoShowRate, capacityTrend (array of { date, title, utilization }), topSessions (array of { title, fillRate })
- `AttendancePatternStats` — overallShowRate, showRateTrend (array of { date, rate }), peakDays (array of { day, count }), topAttendees (array of { userId, name, count }), repeatRate
- `RevenueStats` — totalRevenue, avgRevenuePerSession, collectionRate, outstandingCount, outstandingAmount, revenueTrend (array of { date, amount })
- `AnalyticsSummary` — condensed version of all 4 for the overview widget

### Step 5: Query functions (`src/plugins/analytics/queries.ts`)

All queries filter by `organizationId` and date range. Source tables: `participation`, `eventSession`, `member` (from auth-schema).

Key queries:
- `getGroupHealthStats(orgId, from, to)` — member table for growth, participation for active/inactive
- `getSessionPerformanceStats(orgId, from, to)` — eventSession + participation aggregates
- `getAttendancePatternStats(orgId, from, to)` — participation + eventSession, group by day-of-week
- `getRevenueStats(orgId, from, to)` — eventSession (price) + participation (payment status)
- `getAnalyticsSummary(orgId, from, to)` — lightweight version returning key numbers only

### Step 6: tRPC router (`src/plugins/analytics/router.ts`)

All endpoints use `orgProcedure` with admin role check. Shared input schema for time range:

```typescript
const timeRangeInput = z.object({
  days: z.enum(["7", "30", "90"]).default("30"),
})
```

Endpoints:
- `analytics.summary` — returns `AnalyticsSummary` (for overview widget)
- `analytics.groupHealth` — returns `GroupHealthStats`
- `analytics.sessionPerformance` — returns `SessionPerformanceStats`
- `analytics.attendancePatterns` — returns `AttendancePatternStats`
- `analytics.revenue` — returns `RevenueStats`

### Step 7: Summary widget on org overview

**Modify `src/routes/dashboard/org.$orgId/index.tsx`**:
- Import `AnalyticsSummary` component
- Add it after the header section, before upcoming sessions (admin-only)
- Shows 4 compact stat cards: Total Members, Avg Attendance, Show Rate, Revenue (30d)
- "View Analytics" link to full page

**Create `src/plugins/analytics/components/analytics-summary.tsx`**:
- 4 stat cards in a responsive grid
- Each card: icon, label, value, change indicator (up/down arrow + %)
- Compact design — fits in the existing overview layout

### Step 8: Full analytics page

**Create `src/routes/dashboard/org.$orgId/analytics.tsx`**:
- Time range selector (7d / 30d / 90d tabs)
- 4 sections matching the 4 buckets, each with its own component
- Loading skeletons while data fetches
- Admin-only access check (redirect if member)

### Step 9: Chart components

**`group-health.tsx`**:
- Stat cards: Total Members, New Members, Active Members, Retention Rate
- Line chart: Member growth over time (new joins per day/week)

**`session-performance.tsx`**:
- Stat cards: Sessions Held, Avg Capacity %, Avg No-Show Rate
- Bar chart: Capacity utilization per session
- Table: Top 5 sessions by fill rate

**`attendance-patterns.tsx`**:
- Stat cards: Show Rate, Repeat Rate
- Line chart: Show rate trend over time
- Bar chart: Attendance by day of week
- List: Top 5 attendees

**`revenue-overview.tsx`**:
- Stat cards: Total Revenue, Avg/Session, Collection Rate, Outstanding
- Line chart: Revenue trend over time

### Step 10: Add sidebar navigation

**Modify `src/components/dashboard/nav-main.tsx`**:
- Add "Analytics" to `adminNavItems` (before Settings):
  ```typescript
  { title: "Analytics", url: "/dashboard/org/$orgId/analytics", icon: BarChart3, adminOnly: true }
  ```

### Step 11: Enable by default

**Modify `src/data-access/organization-settings.ts`** (in `getOrCreateOrgSettings`):
- Ensure `analytics` plugin is in `enabledPlugins` by default for new orgs
- Or: skip the `isPluginEnabled` check for analytics (since it's always-on per requirements)

---

## Files Summary

### New files (9)
| File | Purpose |
|------|---------|
| `src/plugins/analytics/router.ts` | tRPC endpoints |
| `src/plugins/analytics/queries.ts` | SQL query functions |
| `src/plugins/analytics/types.ts` | TypeScript types |
| `src/plugins/analytics/components/analytics-summary.tsx` | Overview widget |
| `src/plugins/analytics/components/group-health.tsx` | Member growth charts |
| `src/plugins/analytics/components/session-performance.tsx` | Capacity/no-show charts |
| `src/plugins/analytics/components/attendance-patterns.tsx` | Show rate, peak days, top attendees |
| `src/plugins/analytics/components/revenue-overview.tsx` | Revenue charts |
| `src/routes/dashboard/org.$orgId/analytics.tsx` | Full analytics page |

### Modified files (4)
| File | Change |
|------|--------|
| `src/plugins/catalog.ts` | Add analytics plugin metadata |
| `src/plugins/registry.ts` | Register analytics router |
| `src/components/dashboard/nav-main.tsx` | Add Analytics nav item (admin) |
| `src/routes/dashboard/org.$orgId/index.tsx` | Add summary widget (admin) |

### Auto-generated (2)
| File | Trigger |
|------|---------|
| `src/components/ui/chart.tsx` | `npx shadcn@latest add chart` |
| `src/routeTree.gen.ts` | TanStack Router (auto) |

---

## Verification

1. `npx shadcn@latest add chart` — installs Recharts + chart component
2. `pnpm lint` — no TypeScript errors
3. `pnpm dev` — dev server starts
4. Navigate to `/dashboard/org/$orgId` as admin — summary widget visible
5. Navigate to `/dashboard/org/$orgId` as member — summary widget NOT visible
6. Click "Analytics" in sidebar — full analytics page loads
7. Switch time ranges (7d / 30d / 90d) — data updates
8. All 4 sections render charts and stats
9. Empty state: new org with no sessions shows zeros gracefully (no errors, no broken charts)

---

## Research Sources

- [Meetup Group Stats](https://help.meetup.com/hc/en-us/articles/360002862532-How-do-I-see-my-Meetup-group-s-stats)
- [Meetup Pro Dashboard Analytics](https://help.meetup.com/hc/en-us/articles/360027018331-Understanding-network-analytics-on-your-Pro-Dashboard)
- [2026 Meetup Roadmap](https://www.meetup.com/blog/2026-meetup-roadmap/)
- [Eventbrite Event Data Analysis](https://www.eventbrite.com/blog/event-data-analysis/)
- [Spond Features](https://www.spond.com/en-us/)
- [TeamSnap Features](https://www.teamsnap.com/teams/features)

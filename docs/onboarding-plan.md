# User Onboarding Feature Plan

## Context

After signup, users land on an empty dashboard with no guidance, no discovery, and no personalization. This feature adds a required 3-step onboarding wizard that collects user interests, intent, and location. This data forms the foundation for future group discovery, recommendations, and matchmaking plugins.

Invite-only groups remain hidden from discovery — only open/approval groups will be surfaceable.

---

## What We're Building

### Onboarding Wizard (3 steps, required, no skip)

1. **Intent** — "Join groups" / "Organize groups" / "Both" (3 clickable cards)
2. **Interests** — Pick from categorized tags (10+ categories, scrollable accordion with toggle chips). Min 1 interest required.
3. **Location** — City/region text input + timezone (auto-detected from browser, overridable via dropdown)

After completion → save data → redirect to `/dashboard`

### Org Interest Tagging

Add an optional interest picker to the org creation form so organizers can tag their groups with interests.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where to store intent/city/timezone/onboardingCompleted | Better Auth `additionalFields` on user table | Follows existing pattern for `phoneNumber` + `username`. Simple scalar values, no joins needed. |
| Interest storage | Many-to-many relational tables (not JSONB/arrays) | Most flexible for future matching queries. |
| Wizard state | Local `useState` in route component | Ephemeral state, single route, no URL navigation between steps. Jotai/URL params overkill. |
| Interest picker UI | Scrollable accordion sections with toggle badge chips | Tabs would be awkward with 10+ categories on mobile. Accordion lets users scan/expand/collapse. |
| Reusable interest picker | Shared `InterestPicker` component | Used in both onboarding step 2 AND org creation form. |

---

## Implementation Steps

### Step 1: Better Auth additionalFields

**Modify `src/auth/index.ts`** — Add 4 new fields to `user.additionalFields`:
- `intent` (string, required: false, input: false)
- `city` (string, required: false, input: false)
- `timezone` (string, required: false, input: false)
- `onboardingCompleted` (boolean, required: false, defaultValue: false, input: false)

`input: false` = not accepted during signup, set later via direct DB update in onboarding mutation.

Then run: `echo "y" | pnpm auth:generate` to regenerate `src/db/auth-schema.ts`.

### Step 2: Database schema — interest tables

**Modify `src/db/schema.ts`** — Add 4 new tables:

| Table | Columns | Purpose |
|-------|---------|---------|
| `interest_category` | id, name (unique), slug (unique), displayOrder, createdAt | Category grouping (e.g., "Sports & Fitness") |
| `interest` | id, categoryId (FK), name, slug, createdAt | Individual tag (e.g., "Basketball"). Unique on (categoryId, slug). |
| `user_interest` | id, userId (FK → user), interestId (FK → interest), createdAt | User ↔ interest junction. Unique on (userId, interestId). |
| `organization_interest` | id, organizationId (FK → org), interestId (FK → interest), createdAt | Org ↔ interest junction. Unique on (orgId, interestId). |

Add Drizzle relations for all 4 tables. Note: cannot extend `userRelations` in auto-generated `auth-schema.ts`, but `userInterestRelations` with `one(user, ...)` is sufficient for querying.

### Step 3: Generate & run migration

```bash
pnpm db:generate && pnpm db:migrate
```

### Step 4: Add types

**Modify `src/db/types.ts`** — Add Select/Insert type exports for the 4 new tables.

### Step 5: Zod schemas

**Create `src/schemas/onboarding.ts`**:
- `intentSchema` — `z.enum(["join", "organize", "both"])`
- `onboardingSchema` — `{ intent, interestIds: z.array(z.string()).min(1), city: z.string().min(1), timezone: z.string().min(1) }`

### Step 6: Data access layer

**Create `src/data-access/interests.ts`**:
- `getAllInterestsGrouped()` — Fetch all categories with their interests, ordered by displayOrder
- `getUserInterests(userId)` — Fetch user's interest IDs
- `setUserInterests(userId, interestIds)` — Delete + re-insert user interests
- `setOrganizationInterests(orgId, interestIds)` — Delete + re-insert org interests
- `getOrganizationInterests(orgId)` — Fetch org's interest IDs

### Step 7: tRPC onboarding router

**Create `src/trpc/routers/onboarding.ts`**:
- `getInterests` (publicProcedure) — Returns all categories with interests
- `complete` (protectedProcedure) — Validates input with `onboardingSchema`, updates user fields (intent, city, timezone, onboardingCompleted=true), saves user interests

**Modify `src/trpc/routers/_app.ts`** — Register `onboarding: onboardingRouter`

### Step 8: Onboarding UI components

**Create `src/components/onboarding/interest-picker.tsx`** — Reusable component:
- Fetches interests via `trpc.onboarding.getInterests.useQuery()`
- Scrollable accordion sections per category
- Toggle `Badge` chips for each interest (selected = filled, unselected = outline)
- Selected count indicator
- Props: `selected: string[]`, `onChange: (ids: string[]) => void`

**Create `src/components/onboarding/step-intent.tsx`** — Step 1:
- Three clickable cards: Join / Organize / Both
- Each with icon, title, description
- "Continue" button (disabled until selection)

**Create `src/components/onboarding/step-interests.tsx`** — Step 2:
- Uses `InterestPicker` component
- "Continue" button (disabled if no interests selected)
- "Back" button

**Create `src/components/onboarding/step-location.tsx`** — Step 3:
- City: `Input` text field
- Timezone: `Select` dropdown (reuse timezone pattern from org creation in `src/routes/dashboard/groups/create.tsx`)
- "Complete" button + "Back" button
- Error display

### Step 9: Onboarding route

**Create `src/routes/onboarding.tsx`**:
- Auth guard: redirect to `/login` if not signed in
- Already-onboarded guard: redirect to `/dashboard` if `onboardingCompleted`
- `useState<number>` for current step, `useState<OnboardingData>` for collected data
- Auto-detect timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Step indicator (3 dots/bars)
- Background styling matching auth pages
- Renders step components based on current step

### Step 10: Signup redirect

**Modify `src/routes/(auth)/register.tsx`** (line 89):
- Change `navigate({ to: "/dashboard" })` → `navigate({ to: "/onboarding" })`

### Step 11: Dashboard onboarding guard

**Modify `src/routes/dashboard.tsx`** (after line 22):
- Add: if user is authenticated but `!session.user.onboardingCompleted` → `<Navigate to="/onboarding" />`
- This catches users who navigate to `/dashboard` directly

### Step 12: Org creation — interest tagging

**Modify `src/routes/dashboard/groups/create.tsx`**:
- Add `InterestPicker` component to the form (optional, no minimum)
- Add `interestIds` state
- Pass `interestIds` to `createOrg.mutate()` call

**Modify `src/trpc/routers/user.ts`** (`createOrg` mutation):
- Add `interestIds: z.array(z.string()).optional()` to input schema
- After org creation, call `setOrganizationInterests(org.id, input.interestIds)` if provided

### Step 13: Seed script

**Create `scripts/seed-interests.ts`**:
- 12 categories with 5-8 tags each (~75 total interests)
- Categories: Sports & Fitness, Technology, Arts & Culture, Education & Learning, Business & Networking, Health & Wellness, Social & Community, Outdoor & Adventure, Food & Drink, Gaming, Religion & Spirituality, Parenting & Family
- Follow pattern from `scripts/create-demo-user.ts`
- Idempotent: check if data exists before inserting

**Modify `package.json`**:
- Add `"db:seed:interests": "pnpm exec tsx --env-file=.env ./scripts/seed-interests.ts"`
- Update `"db:reset"` to include `&& pnpm db:seed:interests`

---

## Files Summary

### New files (10)
| File | Purpose |
|------|---------|
| `src/schemas/onboarding.ts` | Zod schemas for onboarding input |
| `src/data-access/interests.ts` | DB queries for interests |
| `src/trpc/routers/onboarding.ts` | tRPC onboarding router |
| `src/routes/onboarding.tsx` | Onboarding wizard route |
| `src/components/onboarding/interest-picker.tsx` | Reusable interest picker |
| `src/components/onboarding/step-intent.tsx` | Step 1: intent selection |
| `src/components/onboarding/step-interests.tsx` | Step 2: interest selection |
| `src/components/onboarding/step-location.tsx` | Step 3: location |
| `scripts/seed-interests.ts` | Seed interest data |

### Modified files (8)
| File | Change |
|------|--------|
| `src/auth/index.ts` | Add 4 additionalFields |
| `src/db/schema.ts` | Add 4 tables + relations |
| `src/db/types.ts` | Add type exports |
| `src/trpc/routers/_app.ts` | Register onboarding router |
| `src/trpc/routers/user.ts` | Add interestIds to createOrg |
| `src/routes/(auth)/register.tsx` | Change redirect to /onboarding |
| `src/routes/dashboard.tsx` | Add onboarding guard |
| `src/routes/dashboard/groups/create.tsx` | Add interest picker |
| `package.json` | Add seed script, update db:reset |

### Auto-generated
| File | Trigger |
|------|---------|
| `src/db/auth-schema.ts` | `pnpm auth:generate` |
| `src/db/migrations/0003_*.sql` | `pnpm db:generate` |
| `src/routeTree.gen.ts` | TanStack Router (auto) |

---

## Verification

1. **DB reset**: `pnpm db:reset` — should create all tables, seed demo user + interests
2. **Type check**: `pnpm lint` — no TypeScript errors
3. **Register flow**: Sign up a new user → should redirect to `/onboarding` (not dashboard)
4. **Onboarding wizard**: Complete all 3 steps → should save and redirect to `/dashboard`
5. **Dashboard guard**: Navigate to `/dashboard` directly when not onboarded → should redirect to `/onboarding`
6. **Already onboarded**: Navigate to `/onboarding` when already completed → should redirect to `/dashboard`
7. **Org creation**: Create a new org → interest picker should be visible and optional
8. **DB verification**: Check `user` table has intent/city/timezone/onboardingCompleted populated. Check `user_interest` has entries. Check `organization_interest` if org was tagged.

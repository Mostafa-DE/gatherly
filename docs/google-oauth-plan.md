# Plan: Google OAuth + One Tap (Single Onboarding Flow)

## Context

Gatherly currently supports email/password auth only. We want to add Google sign-in via:
- Standard "Continue with Google" OAuth button
- Google One Tap popup

Constraint: `user.phoneNumber` and `user.username` are currently required, but Google sign-up may not provide them.

Decision: make `phoneNumber` and `username` nullable at auth creation time, and collect missing values inside `/onboarding` (same page, conditional fields). No `/complete-profile` page.

---

## Implementation Steps

### Step 1: Update Better Auth Config

**File**: `src/auth/index.ts`

- Change `phoneNumber` and `username` in `user.additionalFields` from `required: true` to `required: false`
- Add `socialProviders.google` using:
  - `clientId: process.env.GOOGLE_CLIENT_ID`
  - `clientSecret: process.env.GOOGLE_CLIENT_SECRET`
  - optional `mapProfileToUser` to map name/image
- Add `oneTap()` plugin from `better-auth/plugins`
- Add `account.accountLinking.trustedProviders: ["google"]`

### Step 2: Regenerate Auth Schema + DB Migration

- Run `echo "y" | pnpm auth:generate` to regenerate `src/db/auth-schema.ts`
- Run `pnpm db:generate`
- Run `pnpm db:migrate` to drop `NOT NULL` on `user.username` and `user.phone_number`

### Step 3: Update Auth Client for One Tap

**File**: `src/auth/client.ts`

- Add `oneTapClient({ clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID })` from `better-auth/client/plugins`
- Export `oneTap` action from `authClient`

### Step 4: Add Environment Variables

**Files**: `.env`, `.env.example`

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `VITE_GOOGLE_CLIENT_ID` (same value as `GOOGLE_CLIENT_ID`)

### Step 5: Extend Onboarding Schema + Mutation to Collect Missing Profile Fields

**File**: `src/schemas/onboarding.ts`

- Extend onboarding step-1 input schema to optionally accept:
  - `username` (reusing `usernameSchema` from `src/schemas/user.ts`)
  - `phoneNumber` (reusing `phoneNumberSchema` from `src/schemas/user.ts`)

**File**: `src/trpc/routers/onboarding.ts`

- In `complete` mutation:
  - Read current `ctx.user.username` / `ctx.user.phoneNumber`
  - If either is missing, require it from input
  - Validate uniqueness in DB before write
  - Update user with country/city/timezone and missing profile fields in one transaction
  - Handle unique-constraint race safely (return clear error if taken)
  - Continue current org bootstrap logic only after profile fields are present

**File**: `src/trpc/routers/user.ts`

- Add defensive guard in `createOrg` mutation:
  - If `ctx.user.username` is null, throw `BAD_REQUEST` with clear message to complete onboarding first

### Step 6: Add Google Auth UI Pieces

**New file**: `src/components/auth/google-icon.tsx`

- Google icon component

**New file**: `src/components/auth/google-sign-in-button.tsx`

- Reusable button for `signIn.social({ provider: "google", callbackURL })`
- Accept `redirectTo` and `label` props
- Preserve redirect intent by passing callback/redirect through to onboarding flow

**New file**: `src/hooks/use-google-one-tap.ts`

- Trigger `oneTap()` only on login/register and only when user is signed out
- Pass callback URL that lands on onboarding flow

### Step 7: Update Onboarding Page (Single Source of Truth)

**File**: `src/routes/onboarding.tsx`

- Keep existing onboarding flow, but add conditional profile fields on step 1:
  - If `session.user.username` is missing, show username input with availability check
  - If `session.user.phoneNumber` is missing, show phone input
  - If already present, hide these fields
- Submit username/phone only when shown
- Keep existing guards:
  - No session -> `/login`
  - Already onboarded -> `/dashboard`
- Remove any redirect to a separate profile completion page

### Step 8: Update Login + Register Pages

**Files**: `src/routes/(auth)/login.tsx`, `src/routes/(auth)/register.tsx`

- Add One Tap hook call
- Add Google sign-in button below form submit with separator
- Post-auth redirect behavior:
  - If `onboardingCompleted` is `false`, navigate to `/onboarding`
  - If `onboardingCompleted` is `true`, navigate to redirect target or `/dashboard`

### Step 9: Keep Route Guards Aligned

**File**: `src/routes/dashboard.tsx`

- Keep auth + onboarding guard:
  - No session -> `/login`
  - Not onboarded -> `/onboarding`
- Do not add `/complete-profile` checks

---

## Auth Flow After Implementation

```
Login/Register page
  ├─ Email/Password → session
  ├─ Continue with Google → /api/auth/callback/google → session
  └─ One Tap → /api/auth/one-tap/callback → session

Post-sign-in routing
  1. No session -> /login
  2. onboardingCompleted = false -> /onboarding
  3. onboardingCompleted = true -> redirect target or /dashboard

Onboarding step 1
  - Always collect country/city/timezone
  - Conditionally collect username/phone if missing
  - If username/phone already exist, fields are hidden
```

---

## Key Edge Cases

| Scenario | Handling |
|----------|----------|
| Existing email/password user signs in with Google (same email) | Account links via `trustedProviders`, existing profile fields remain, continue normally |
| New Google user (missing username/phone) | User is created, sent to onboarding, missing fields are shown and required there |
| Returning Google user with completed onboarding | Skips onboarding and lands on dashboard/redirect target |
| One Tap dismissed | Nothing happens; email/password and Google button remain available |
| Username/phone conflict during onboarding | Mutation returns validation error; user can retry with different value |

---

## Verification

1. `pnpm dev` starts without auth/runtime errors
2. Email/password login/register behavior remains unchanged
3. Google new user -> onboarding step 1 shows username/phone -> complete onboarding -> dashboard
4. Google existing onboarded user -> directly to dashboard
5. Existing email/password user signs in with Google (same email) -> account linked -> no duplicate user
6. Onboarding with taken username/phone shows clear error and does not partially complete
7. `pnpm lint` passes

---

## Files Changed (Summary)

| File | Action |
|------|--------|
| `src/auth/index.ts` | Modify — Google provider, One Tap plugin, account linking, nullable username/phone |
| `src/db/auth-schema.ts` | Regenerate — nullable username/phoneNumber |
| `src/auth/client.ts` | Modify — add `oneTapClient`, export `oneTap` |
| `src/schemas/onboarding.ts` | Modify — add optional username/phone for onboarding input |
| `src/trpc/routers/onboarding.ts` | Modify — require missing profile fields in onboarding, uniqueness + transaction-safe update |
| `src/trpc/routers/user.ts` | Modify — guard `createOrg` when username is missing |
| `src/components/auth/google-icon.tsx` | Create — Google icon |
| `src/components/auth/google-sign-in-button.tsx` | Create — Google OAuth button |
| `src/hooks/use-google-one-tap.ts` | Create — One Tap trigger hook |
| `src/routes/(auth)/login.tsx` | Modify — add Google button + One Tap behavior |
| `src/routes/(auth)/register.tsx` | Modify — add Google button + One Tap behavior |
| `src/routes/onboarding.tsx` | Modify — conditional username/phone fields on step 1 |
| `src/routes/dashboard.tsx` | Keep onboarding guard (no complete-profile route) |
| `.env` / `.env.example` | Modify — add Google env vars |

# Implemented Functionality (Current State)

_Last updated: 2026-02-07_

This document describes what is currently implemented from a functional perspective, based on the existing app code.

## Markdown Files Reviewed

All project Markdown files were reviewed:
- `AGENTS.md`
- `CODE_STYLE.md`
- `README.md`
- `CLAUDE.md`
- `docs/DESIGN_SYSTEM.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/PROJECT_OVERVIEW.md`

## 1. Authentication and User Account

Implemented:
- Email/password registration and login.
- Required phone number during registration.
- Auth session handling via Better Auth.
- Logout support via auth client.
- User profile page to update:
  - name
  - profile image URL
  - phone number
- User invitation inbox:
  - list pending invitations
  - accept invitation
  - reject invitation

## 2. Organization (Group) Management

Implemented:
- Create organization/group with:
  - name
  - slug
  - timezone
  - default join mode (`open`, `invite`, `approval`)
  - currency
- Multi-organization membership per user.
- Organization switcher in dashboard.
- Active organization context per session.

Membership and role features implemented:
- Roles supported: `owner`, `admin`, `member`.
- Owner/admin can list members.
- Owner can promote/demote members (`member` <-> `admin`).
- Owner/admin can remove members (with protection rules in use-cases).

Invitation features implemented:
- Owner/admin can invite by email.
- Owner/admin can list pending invitations.
- Owner/admin can cancel pending invitations.

## 3. Public Organization Join Flow

Implemented on `/org/$slug`:
- Public org page by slug with member count and join mode.
- Join behavior by org join mode:
  - `open`: authenticated user can join directly.
  - `approval`: authenticated user can submit join request.
  - `invite`: self-join disabled (invite required).
- Pending join request state handling.
- “already member” handling.

Join form support implemented:
- Public page fetches org join-form schema.
- Dynamic form fields rendered from schema.
- Required field checks in UI.
- Submitted answers are stored in `group_member_profile` when join/approval succeeds.

## 4. Join Requests (Approval Mode)

Implemented:
- Authenticated user can create join request for approval-mode org.
- User can cancel own pending request.
- User can view own requests.
- Owner/admin can list pending org requests.
- Owner/admin can approve request:
  - request status updated
  - member added through Better Auth API
  - form answers persisted to member profile
- Owner/admin can reject request.

## 5. Organization Settings and Member Profile Schema

Implemented settings domain:
- Org settings record with:
  - `joinFormSchema`
  - `joinFormVersion`
  - `currency`
- Auto-create default settings if missing.
- Join form schema update with version increment.
- Currency update.

Implemented UI capabilities:
- Settings page with general settings (timezone, default join mode).
- Join form builder (add/remove/reorder fields, type/options/required).
- Currency selection.

Profile features implemented:
- Per-org member profile answers storage.
- Member can view/update own group profile.
- Validation against configured join form schema:
  - required fields
  - field type checks
  - option validation
  - rejects unknown answer keys
- Profile history section shows member’s participation history within org.

## 6. Session Management

Implemented data model:
- Session entity (`event_session`) with:
  - title, description, date/time, location
  - max capacity, waitlist size
  - price
  - join mode
  - status (`draft`, `published`, `completed`, `cancelled`)
  - soft delete (`deletedAt`)

Implemented session operations:
- Create session (starts as `draft`).
- Edit session (blocked once `completed`/`cancelled`).
- Publish draft session.
- Mark published session as completed.
- Cancel draft/published session.
- Soft delete session.

Implemented session listing:
- Draft sessions with counts (owner-only on backend).
- Upcoming sessions with participant counts + preview avatars.
- Past sessions with participant counts + preview avatars.
- Session detail page with status, capacity, pricing, participant preview.

## 7. Participation and Roster

Implemented participation model:
- Status: `joined`, `waitlisted`, `cancelled`.
- Attendance: `pending`, `show`, `no_show`.
- Payment: `unpaid`, `paid`.
- Notes per participation.

Implemented member actions:
- Join published session.
- Cancel own participation.
- View own participation for a session.
- View own participation history in org.

Implemented join/capacity logic:
- Transaction + row locking on session row for concurrency safety.
- If capacity available -> `joined`.
- If full and waitlist available -> `waitlisted`.
- If both full -> error.
- Idempotent join behavior for existing active participation.
- Auto-promotion from waitlist when a joined participant cancels.
- Waitlist ordering by (`joinedAt`, `id`).

Implemented roster/admin actions:
- View roster by status.
- Update attendance/payment/notes per participant.
- Bulk attendance update.
- Admin add participant by email/phone (must be existing org member).
- Move participant to another session in same org.

Double-booking guard implemented:
- Prevents active participation in two sessions at the exact same `dateTime`.

## 8. APIs and Middleware

Implemented:
- `GET /api/health` with status + timestamp.
- Better Auth handler at `/api/auth/*`.
- tRPC handler at `/api/trpc/*`.
- Request middleware injects user/session from Better Auth into request context.

## 9. Data Integrity and Access Controls

Implemented integrity controls:
- Partial unique index: one active participation per user per session.
- Transactional join/cancel/move paths.
- Scoped org checks for session/participation access before mutation.
- Session state transition rules enforced.

Implemented authorization patterns:
- `protectedProcedure` for authenticated calls.
- `orgProcedure` enforces active org + membership.
- Owner/admin checks in org/participation/join-request routers.

## 10. Tests Present

Implemented test coverage includes:
- Session data-access behavior.
- Participation data-access behavior (join idempotency, auto-promotion, move semantics).
- Join-request router behavior (approval/rejection/security).
- Router authorization checks.
- Organization membership/invitation use-cases.
- Group profile validation use-case.

## 11. Current Gaps / Mismatches

Current behavior mismatches visible in code:
- Session router currently enforces owner-only for create/update/status/delete, while some UI screens/actions are shown for admins.
- Join form and currency update endpoints are owner-only, but settings UI is accessible to admins and can expose actions they cannot complete.

Partially implemented/not yet implemented behavior:
- Session join modes `approval_required` and `invite_only` are defined but joining those modes currently returns “coming soon”.
- Session-level join forms are not implemented (org-level form is implemented).
- CSV export is not implemented.

## 12. Quick Functional Verification

1. Create account -> login -> create group.
2. Configure join mode and join form in group settings.
3. Open public group URL (`/org/<slug>`) from another user account and join/request.
4. Approve request (if approval mode).
5. Create session, publish it, and join from member account.
6. Fill capacity to verify waitlist behavior.
7. Cancel a joined participant and confirm auto-promotion.
8. Open roster and update attendance/payment/notes.
9. Move participant to another session and confirm source is cancelled + target created.

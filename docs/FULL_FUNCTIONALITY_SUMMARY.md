# Full Functionality Summary

_Generated: 2026-02-08_

This document summarizes the functionality currently implemented in the codebase.

## 1. Platform Foundations

- Full-stack TypeScript app using TanStack Start + TanStack Router + tRPC.
- PostgreSQL persistence via Drizzle ORM.
- Better Auth for authentication, sessions, organizations, memberships, and invitations.
- Global request middleware injects authenticated `user` and `session` into server context.
- Health endpoint at `GET /api/health`.
- API handlers exposed at:
  - `/api/auth/*` (Better Auth handler)
  - `/api/trpc/*` (tRPC handler)

## 2. Authentication and Account

- Email/password registration and login.
- Auto sign-in enabled after registration.
- Required profile fields at signup:
  - `username` (unique)
  - `phoneNumber` (unique)
- Username availability check during registration.
- Dashboard profile page supports updating:
  - name
  - profile image URL
  - phone number
- Session-aware route protection on dashboard pages.
- Email verification warning banner shown in dashboard when email is unverified.

## 3. Organization (Group) Model

- Organization == Group (single concept).
- Users can create organizations with:
  - name
  - user slug (public slug segment)
  - timezone
  - default join mode (`open`, `invite`, `approval`)
  - currency (optional at creation, supported currency list enforced)
- Internal org slug generated as `{ownerUsername}-{userSlug}`.
- Users can belong to multiple organizations.
- Active organization switching supported in dashboard.

## 4. Roles and Access Control

- Membership roles supported: `owner`, `admin`, `member`.
- `orgProcedure` enforces:
  - authenticated user
  - active organization selected
  - user membership in active organization
- Role-gated capabilities:
  - Owner/admin: invite members, manage join requests, access members pages.
  - Owner only (backend enforced): create/update/delete sessions, update session status, update org settings, update join form schema, update currency.
- `withOrgScope` guards session/participation mutation access to active org.

## 5. Organization Membership Flows

- Public group page at `/$username/$groupSlug`.
- Public org info retrieval by `ownerUsername + userSlug`.
- Public member count display.
- Join flows by org default join mode:
  - `open`: direct join available.
  - `approval`: submit join request.
  - `invite`: direct self-join blocked.
- Prevents duplicate membership on join.
- Tracks pending join request state for current user.

## 6. Invite Links

- Token-based invite link system (org-scoped).
- Admin/owner can create invite links with:
  - role (`member` or `admin`)
  - expiration date
  - max uses (or unlimited)
- Public validation endpoint (`inviteLink.validate`).
- Authenticated token usage endpoint (`inviteLink.useToken`) that:
  - adds member via Better Auth
  - optionally stores submitted form answers in member profile
  - increments usage count
- Invite link management UI:
  - list links
  - copy share URL
  - deactivate links
  - view status (`Active`, `Expired`, `Depleted`, `Deactivated`)

## 7. Invitation Inbox (Email Invitations)

- Admin/owner can send email invitations by role.
- Duplicate pending invite prevention by email+org.
- Admin/owner can list pending org invitations and cancel them.
- End users can view their own pending invitations and:
  - accept invitation
  - reject invitation
- Invitation ownership and expiry checks are enforced.

## 8. Join Requests (Approval Mode)

- Authenticated users can create join requests for approval-mode orgs.
- One pending request per user per org is enforced (DB-level unique partial index).
- Users can cancel their own pending requests.
- Users can list all their join requests across orgs.
- Admin/owner can:
  - list pending org requests
  - approve request (adds membership)
  - reject request
- Submitted join-request form answers are persisted to group member profile on approval.

## 9. Organization Settings

- Org settings stored in `organization_settings`.
- Auto-creates default settings record when absent.
- Supports:
  - join form schema storage/versioning
  - organization currency
- Join form version increments on schema update.
- General org settings mutation supports:
  - timezone
  - default join mode

## 10. Dynamic Group Member Profile

- One profile per `(organizationId, userId)` stored in `group_member_profile`.
- Profile answers are JSON-based and tied to org join form schema.
- Supported field types:
  - text, textarea, email, phone, number, date, checkbox, select, multiselect
- Validation use-case enforces:
  - required fields
  - type correctness
  - option validity for select/multiselect
  - unknown-field rejection
  - optional min/max/pattern validation where configured
- Profile flows:
  - self profile view/update
  - submit join form
  - admin/owner view another member profile
- Org layout shows banners for incomplete required/optional profile fields (members only).

## 11. Session Management

- Session entity (`event_session`) includes:
  - title, description, datetime, location
  - max capacity, max waitlist
  - price (nullable)
  - join mode
  - status (`draft`, `published`, `completed`, `cancelled`)
  - soft delete (`deletedAt`)
- Session operations:
  - create (starts as `draft`)
  - update details (blocked for completed/cancelled)
  - update status with state-machine transition checks
  - soft delete
- Session list variants:
  - all list
  - upcoming
  - past
  - upcoming with counts + participant preview
  - past with counts + participant preview
  - drafts with counts + participant preview (owner-only)
- Session detail UI includes:
  - status and capacity indicators
  - join/waitlist status
  - participant preview
  - admin actions (publish/complete/cancel/delete/edit/roster access)
- Public session page at `/$username/$groupSlug/sessions/$sessionId` for published sessions.

## 12. Participation and Roster

- Participation statuses: `joined`, `waitlisted`, `cancelled`.
- Attendance statuses: `pending`, `show`, `no_show`.
- Payment statuses: `unpaid`, `paid`.
- Join behavior:
  - session must be published and not deleted
  - idempotent if already joined/waitlisted
  - capacity-aware join/waitlist assignment
  - waitlist ordering by `(joinedAt, id)`
- Concurrency and integrity:
  - session row locking (`FOR UPDATE`) in join/cancel/admin-add/move flows
  - partial unique index for one active participation per user+session
  - unique-conflict recovery for join race conditions
- Cancellation behavior:
  - own cancellation allowed before session completion
  - auto-promotes first waitlisted user when a joined participation cancels
- Double-booking guard:
  - blocks active participation in two sessions at the exact same datetime
- Roster capabilities:
  - list by status
  - update attendance/payment/notes
  - bulk attendance update
  - admin add participant by email/phone (must be org member)
  - move participant to another session in same org
  - move operation intentionally does not auto-promote source session
- History capabilities:
  - member self history in org
  - admin view of any member history

## 13. Dashboard and Navigation UX

- Authenticated dashboard shell with:
  - responsive sidebar
  - organization switcher
  - role-aware navigation
  - quick actions
  - breadcrumbs
  - theme toggle
- Dashboard modules:
  - home (org cards + pending join requests)
  - account profile
  - user invitation inbox
  - organization overview
  - sessions pages (list/create/edit/detail/roster)
  - group profile + participation history
  - members list + member detail page
  - invitations management
  - join requests management
  - invite links management

## 14. Sharing Features

- Share dialog supports:
  - copy link
  - WhatsApp deep link prefilled message
  - QR code generation
  - native share API (when available)
- Share targets:
  - group public URL
  - session public URL
- Invite link generation is integrated into share flows for admin/owner.

## 15. Data Integrity and Constraints

- Important DB constraints/indexes include:
  - one pending join request per user+org
  - one group member profile per user+org
  - unique invite token
  - one active participation per user+session
- Soft deletion used for sessions to preserve history.
- State-machine based session transition validation.
- Extensive org-scoped authorization checks before mutations.

## 16. Tests Present

- Data-access tests for sessions, participations, invite links.
- Router tests for join requests, invite links, authorization behavior.
- Use-case tests for organization membership and invitations.
- Use-case tests for group member profile validation.

## 17. Tooling and Operations

- DB scripts:
  - start/stop/reset local DB via Docker Compose
  - drizzle generate/migrate/studio
- Auth schema generator script for Better Auth.
- Demo user seed script.
- Vitest test runner and separate server test config.

## 18. Known Partials / Current Mismatches

- Session join modes `approval_required` and `invite_only` are defined, but joining those modes currently returns "coming soon" errors (only `open` works end-to-end).
- Backend enforces owner-only permissions for session mutations and settings updates, while some admin-facing UI entry points are visible.
- CSV export is not implemented.
- Session-level custom forms are not implemented (organization-level form is implemented).


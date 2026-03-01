# Solid Merged Plan: OpenClaw Telegram Commands with Gatherly Approval Workflow

## Summary
Implement a Telegram-first admin command system using OpenClaw, with Gatherly as the source of truth and execution engine.
We combine:
1. The **service-integration strength** from `lovely-brewing-mango.md` (`botApiKey`, `botProcedure`, `getContext`), and
2. The **data-integrity guarantees** from our plan (persisted draft/follow-up/approval lifecycle, strict disambiguation, mandatory approval before any write, in-app queue mirror).

MVP commands:
- `mark_attendance`
- `record_match_result`

Phase 2 command:
- `create_session`

---

## 1) Target Architecture

### Command flow
1. Admin sends voice/text in Telegram.
2. OpenClaw transcribes + parses to structured intent JSON.
3. OpenClaw calls `bot.getContext` to fetch canonical IDs (sessions, participants, players, rankings).
4. OpenClaw submits command to Gatherly using canonical IDs.
5. Gatherly validates payload, IDs, org scope, and role permissions and stores command request.
6. If required fields are missing or IDs are invalid, Gatherly returns structured follow-up prompts/errors.
7. If complete, Gatherly marks `pending_approval` and returns preview.
8. Approval can happen in Telegram or in-app queue.
9. On approval, Gatherly executes via existing internal routers and persists result.

### Non-goals for MVP
- No direct auto-write on initial message.
- No free-form raw transcript parsing in Gatherly (OpenClaw sends structured JSON).
- No server-side fuzzy name matching in Gatherly.

---

## 2) Data Model (DB changes)

### A) `bot_api_key`
Purpose: secure machine-to-machine auth for OpenClaw.

Fields:
- `id`, `organizationId`, `createdByUserId`, `label`
- `keyHash` (SHA-256), `keyPrefix`
- `lastUsedAt`, `expiresAt`, `isRevoked`, `createdAt`

Indexes:
- `bot_api_key_org_idx`
- `bot_api_key_hash_idx`

### B) `telegram_identity_link`
Purpose: map Telegram sender to Gatherly user for role authorization.

Fields:
- `id`, `organizationId`, `userId`
- `telegramUserId`, `telegramChatId` (nullable)
- `linkedByUserId`, `linkedAt`, `createdAt`

Constraints:
- Unique `(organizationId, telegramUserId)`
- Index `(organizationId, userId)`

### C) `assistant_action_request`
Purpose: persisted approval + follow-up state machine.

Fields:
- `id`, `organizationId`, `requestedBy`, `approvedBy`
- `source` (`telegram`), `sourceEventId`
- `action` (`mark_attendance` | `record_match_result` | `create_session`)
- `status` (`needs_input` | `pending_approval` | `approved` | `executed` | `rejected` | `failed`)
- `transcript`, `requestedPayload`, `resolvedPayload`
- `missingFields`, `followUpQuestions`
- `executionResult`, `executionError`
- `approvedAt`, `executedAt`, `createdAt`, `updatedAt`

Constraints/indexes:
- Unique `(organizationId, source, sourceEventId)` for idempotency
- Index `(organizationId, status, createdAt desc)`

---

## 3) Telegram Linking UX (concrete flow)

### Dashboard-initiated deep-link flow (MVP)
1. Admin clicks **Link Telegram** in Gatherly settings.
2. Dashboard calls `bot.generateLinkToken()` and gets `{ linkToken, deepLinkUrl }`.
3. Gatherly creates a short-lived signed JWT `linkToken` (e.g. 10 minutes) encoding `{ userId, organizationId, exp, jti }`.
4. No DB table is used for token storage; Gatherly verifies signature + expiry on `bot.linkTelegram`.
5. Dashboard opens `deepLinkUrl`.
6. Admin taps Start in Telegram.
7. OpenClaw sends `linkToken + telegramUserId + chatId` to Gatherly `bot.linkTelegram` endpoint.
8. Gatherly validates JWT and writes `telegram_identity_link`.
9. Gatherly returns success and OpenClaw confirms in chat.

### Additional operations
- `Unlink Telegram` in dashboard.
- Re-link replaces old mapping for same user/org.

---

## 4) Backend Modules and Files

### New files
- `src/data-access/bot-api-keys.ts`
- `src/data-access/telegram-identity-links.ts`
- `src/data-access/assistant-action-requests.ts`
- `src/schemas/bot.ts`
- `src/schemas/assistant-action.ts`
- `src/trpc/routers/bot.ts`
- `src/trpc/routers/assistant-action.ts`
- `src/routes/api/integrations/claw/events.ts` (optional REST ingress if needed beyond tRPC)
- OpenClaw skill doc (outside repo or in ops docs): `SKILL.md`

### Modified files
- `src/db/schema.ts` (new tables + relations)
- `src/db/types.ts` (new type exports)
- `src/trpc/index.ts` (add `botProcedure`)
- `src/trpc/routers/_app.ts` (register `bot`, `assistantAction`)
- Optional UI route for queue (phase 2): `src/routes/dashboard/org.$orgId/assistant-actions.tsx`

---

## 5) Public APIs / Interfaces / Types

### A) `botProcedure` (new in `src/trpc/index.ts`)
- Auth via `Authorization: Bearer <bot_key>`
- Validates key status, expiry, revocation, creator admin membership
- Injects:
  - `ctx.activeOrganization`
  - `ctx.user` (attributed admin for audit)
  - `ctx.membership`
  - `ctx.botKeyId`

### B) `botRouter` endpoints (`src/trpc/routers/bot.ts`)

#### Admin key management (`orgProcedure + admin only`)
- `bot.generateApiKey({ label, expiresAt? }) -> { plaintextKey, keyMeta }`
- `bot.listApiKeys() -> masked list`
- `bot.revokeApiKey({ keyId })`
- `bot.generateLinkToken() -> { linkToken, deepLinkUrl }`

#### Telegram linking (`botProcedure`)
- `bot.linkTelegram({ linkToken, telegramUserId, telegramChatId? })`
- `bot.unlinkTelegram({ telegramUserId })`

#### OpenClaw operational endpoints (`botProcedure`)
- `bot.getContext({ activityId?, sessionId?, includeUpcoming?, includePast?, pastLimit? })`
  - Returns canonical IDs + display names for activities/sessions/participants/ranking info.
- `bot.submitCommand({ sourceEventId, telegramUserId, action, payload, transcript? })`
  - Creates or idempotently returns `assistant_action_request`.
- `bot.answerFollowUp({ actionRequestId, payloadPatch })`
  - Merges patch and re-validates.
- `bot.approveCommand({ actionRequestId, telegramUserId })`
  - Executes only if approver is linked owner/admin.
- `bot.rejectCommand({ actionRequestId, telegramUserId, reason? })`

### C) `assistantActionRouter` endpoints (`orgProcedure`)
- `assistantAction.listPending({ limit, offset })`
- `assistantAction.getById({ actionRequestId })`
- `assistantAction.approve({ actionRequestId })`
- `assistantAction.reject({ actionRequestId, reason? })`
- `assistantAction.listHistory({ statuses?, limit, offset })`

### D) Action payload types (`src/schemas/assistant-action.ts`)
- `mark_attendance` payload:
  - `{ sessionId, updates: [{ userId, attendance: "show" | "no_show" | "pending" }] }`
- `record_match_result` payload aligned with existing `recordMatchSchema`
- `create_session` payload aligned with existing `createSessionSchema` (Phase 2)
- Follow-up question shape:
  - `{ field, question, options?: [{id,label}] }`

---

## 6) Execution Logic (No duplicate business rules)

On approval:
- `mark_attendance` -> map `userId` to `participationId` for the target `sessionId`, then call existing `participation.bulkUpdateAttendance`
- `record_match_result` -> internal caller to existing `plugin.ranking.recordMatch`
- `create_session` (Phase 2) -> internal caller to existing `session.create`

This keeps all existing org/admin/match/session validation centralized and unchanged.

---

## 7) Validation and Responsibility Split

### OpenClaw responsibilities
- Resolve human names/time phrases to canonical IDs via `bot.getContext`.
- Submit structured JSON using canonical IDs.
- Ask user follow-up questions when Gatherly returns missing/invalid-field responses.

### Gatherly responsibilities
- Validate schema, IDs, org scope, permissions, and business invariants.
- Never perform fuzzy name matching.
- Return deterministic validation/follow-up responses.
- Enforce approval gate before any mutation.

### Required behavior
- Missing/invalid fields produce `needs_input` with structured follow-up guidance.
- No action can execute unless status is `approved`.
- Every mutation writes an auditable `assistant_action_request` record.

---

## 8) Security and Integrity

- Bot auth: hashed API keys, revocable, expirable.
- Sender auth: Telegram identity link required.
- Permission check: linked user must be `owner/admin` in org.
- Idempotency: unique `sourceEventId`.
- Replay defense (if REST ingress used): timestamp + signature verification.
- Rate limiting recommended on bot endpoints (org/key scoped).

---

## 9) OpenClaw SKILL Contract (operational spec)

OpenClaw instructions must enforce:
1. Always call `bot.getContext` before submission when IDs are unknown.
2. Resolve names to canonical IDs in OpenClaw before `submitCommand`.
3. Always send structured JSON with canonical IDs.
4. If Gatherly returns follow-up/missing field errors, ask user and call `answerFollowUp`.
5. Never treat local LLM confirmation as execution; call `approveCommand` explicitly.
6. Surface Gatherly validation errors verbatim to user.

---

## 10) Testing Plan

### Unit/data-access
- Key creation/validation/revocation/expiry.
- Telegram link create/find/conflict.
- JWT `linkToken` sign/verify (valid, expired, wrong signature, wrong org/user claims).
- Assistant action lifecycle transitions and invalid transitions.

### Router/integration tests
- `submitCommand` creates `needs_input` when required fields are missing.
- `submitCommand` rejects invalid canonical IDs.
- `submitCommand` -> `pending_approval` when complete.
- Telegram approval executes and marks `executed`.
- Rejection marks `rejected`.
- Execution failure marks `failed`.
- Duplicate `sourceEventId` is idempotent.
- Non-admin linked user denied.

### Acceptance scenarios
1. Voice: “Mark Ahmed and Sara as present for tonight session” -> OpenClaw resolves IDs -> pending approval -> approved -> attendance updated.
2. Voice: “Record match Ahmed/Sara vs Ali/Omar 6-3 6-4” -> OpenClaw resolves IDs -> approve -> match recorded.
3. In-app queue sees same pending request and can approve/reject.

---

## 11) Rollout Plan

### Phase 1 (MVP backend)
- DB tables + bot auth + Telegram linking + command lifecycle for `mark_attendance` and `record_match_result` + tests.

### Phase 2 (Ops + Telegram UX)
- Finalize OpenClaw skill prompts, response templates, and follow-up interaction polish.
- Add `create_session` support.

### Phase 3 (In-app mirror)
- Minimal pending approvals page in dashboard.

### Phase 4
- Expand commands (stats/publish session/cancel session/etc.) using same lifecycle.

---

## 12) Environment and Local Testing (ngrok)

### OpenClaw environment variables (Railway)
- `GATHERLY_BASE_URL`
- `GATHERLY_BOT_API_KEY`

OpenClaw builds target URLs from `GATHERLY_BASE_URL` (do not hardcode hostnames in skills/prompts).

### Local testing with deployed OpenClaw
1. Run Gatherly locally (for example on `http://localhost:3000`).
2. Expose local app via ngrok (`ngrok http 3000`).
3. Set Railway OpenClaw `GATHERLY_BASE_URL` to the ngrok URL.
4. Keep endpoint paths unchanged; only base URL changes.

Flow:
- `Telegram -> OpenClaw (Railway) -> ngrok URL -> local Gatherly`

### Production setup
- Set `GATHERLY_BASE_URL` to production Gatherly domain.
- Keep same API paths and payloads.

### Environment safety
- Use separate bot API keys for development and production.
- Prefer reserved/static ngrok domain (or equivalent tunnel) to reduce config churn.

---

## 13) Assumptions and Defaults
- OpenClaw already deployed and capable of sending structured JSON.
- Telegram is the first channel; in-app capture comes later.
- All bot-origin mutations require explicit approval.
- Org scope only for MVP.
- Execution remains synchronous in API path for MVP (no worker queue yet).

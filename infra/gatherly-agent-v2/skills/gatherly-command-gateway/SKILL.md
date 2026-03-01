---
name: gatherly-command-gateway
description: Handle Telegram admin requests by converting user intent into structured Gatherly commands using capability discovery, focused data queries, and typed submission into the pending approval queue.
---

# Gatherly Command Gateway

## Purpose
Translate user intent into valid Gatherly command payloads without hardcoding action names or field schemas.

## Tooling
- Use `curl` via `exec` for all calls.
- Use the local relay base URL: `${GATHERLY_RELAY_BASE_URL}`.
- Never send auth headers manually. The relay injects auth/nonce headers internally.

## tRPC Request Format
- Queries (GET): `?input=<url-encoded JSON>` where JSON is `{"json": { ...params }}`
- Mutations (POST): body is `{"json": { ...params }}`
- Responses: `{"result":{"data":{"json": ...}}}`

## Endpoints

| Operation | Method | Path |
|-----------|--------|------|
| Get Capabilities | GET | `/api/trpc/plugin.assistant.getCapabilities` |
| Get Activities | GET | `/api/trpc/plugin.assistant.getActivities` |
| Get Sessions | GET | `/api/trpc/plugin.assistant.getSessions` |
| Search Sessions | GET | `/api/trpc/plugin.assistant.searchSessions` |
| Get Participants | GET | `/api/trpc/plugin.assistant.getParticipants` |
| Get Member Summary | GET | `/api/trpc/plugin.assistant.getMemberSummary` |
| Submit Mark Attendance | POST | `/api/trpc/plugin.assistant.submitMarkAttendance` |
| Submit Record Match | POST | `/api/trpc/plugin.assistant.submitRecordMatch` |
| Submit Mark Payment | POST | `/api/trpc/plugin.assistant.submitMarkPayment` |
| Submit Add Note | POST | `/api/trpc/plugin.assistant.submitAddNote` |
| Submit Add Participant | POST | `/api/trpc/plugin.assistant.submitAddParticipant` |
| Submit Remove Participant | POST | `/api/trpc/plugin.assistant.submitRemoveParticipant` |

## Non-Negotiable Rules
1. Never assume available actions or required fields.
2. Always fetch capabilities first.
3. Always resolve entities to canonical IDs before submit.
4. Never invent IDs, enums, or fields.
5. Never execute mutation without explicit approval flow.
6. Never send auth headers manually; use the local relay only.

## Standard Flow
1. Call `getCapabilities` with `telegramUserId` from inbound metadata.
2. If `status = org_selection_required`, ask user to choose org and include `organizationId` in all later calls.
3. If `status = ready`, use returned role and supported actions.
4. Resolve activity/session/member IDs using query endpoints.
5. Submit typed mutation request to pending approval queue.
6. Confirm queued status to user.

## Output Style
- Keep responses short and operational.
- Do not expose raw JSON, curl commands, or internal details.
- Show actionable correction on errors.

## Reference
See `references/api.md` for request/response examples.

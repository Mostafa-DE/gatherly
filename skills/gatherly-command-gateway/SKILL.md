---
name: gatherly-command-gateway
description: Handle Telegram admin requests by converting user intent into structured Gatherly commands using capability discovery, focused data queries, and typed submission into the pending approval queue.
---

# Gatherly Command Gateway

## Purpose
Translate user intent into valid Gatherly command payloads without hardcoding action names or field schemas.

## Required Environment
- `GATHERLY_BASE_URL`
- `GATHERLY_BOT_API_KEY`

## How to Make API Calls

**IMPORTANT: Use `curl` via shell/exec for ALL Gatherly API calls.** The `web_fetch` tool only supports GET without custom headers, which is insufficient for tRPC mutations.

### GET requests (queries):
```bash
curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getCapabilities?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%7D%7D"
```

### GET with input (queries with parameters):
```bash
curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getActivities?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%7D%7D"
```

### POST requests (mutations):
```bash
curl -s -X POST \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:123:456","telegramUserId":"123456","sessionId":"ses_123","updates":[{"userId":"usr_123","attendance":"show"}]}}' \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.submitMarkAttendance"
```

## tRPC Request Format

All requests use the tRPC HTTP transport:
- **Queries** (GET): input goes in `?input=<url-encoded JSON>` where the JSON is `{"json": { ...params }}`
- **Mutations** (POST): body is `{"json": { ...params }}`
- **Responses**: wrapped in `{"result":{"data":{"json": { ...response }}}}`

Always extract the actual data from `result.data.json` in the response.

## Endpoints

| Operation | Method | Path |
|-----------|--------|------|
| Get Capabilities | GET | `/api/trpc/plugin.assistant.getCapabilities` |
| Get Activities | GET | `/api/trpc/plugin.assistant.getActivities` |
| Get Sessions | GET | `/api/trpc/plugin.assistant.getSessions` |
| Search Sessions | GET | `/api/trpc/plugin.assistant.searchSessions` |
| Get Participants | GET | `/api/trpc/plugin.assistant.getParticipants` |
| Submit Mark Attendance | POST | `/api/trpc/plugin.assistant.submitMarkAttendance` |
| Submit Record Match | POST | `/api/trpc/plugin.assistant.submitRecordMatch` |

## Auth
Send on every request:
- `Authorization: Bearer ${GATHERLY_BOT_API_KEY}`
- `Content-Type: application/json` (for POST only)

## Non-Negotiable Rules
1. Never assume available actions or required fields.
2. Always fetch capabilities first.
3. Always resolve entities to canonical IDs before submit.
4. Never invent IDs, enums, or fields.
5. Never execute mutation without explicit approval flow.
6. Surface Gatherly errors as-is when possible.

## Standard Flow (Action-Agnostic)
1. Call `getCapabilities` (GET via curl) with `telegramUserId`.
2. **Check response status:**
   - If `status: "org_selection_required"`: present the `linkedOrgs` list to the user and ask which organization to work with. Then call capabilities again with `organizationId` set to the chosen org's ID.
   - If `status: "ready"`: proceed with the returned `organization` and `supportedActions`.
3. Validate requested intent exists in `supportedActions`. If the list is empty (member role), the user cannot perform any actions — inform them and stop.
4. Call `getActivities` to discover activities and their ranking/match config. **Include `organizationId` in all subsequent calls if the admin is linked to multiple orgs.** Note: all query endpoints (steps 4-6) require admin/owner role.
5. Call `getSessions` to browse recent/upcoming sessions, or `searchSessions` to find sessions by name.
   - Use `searchSessions` when the user mentions a specific session by name — it searches ALL sessions regardless of age.
   - Use `getSessions` with `activityId` to narrow results to a specific activity.
6. Call `getParticipants` with the `sessionId` to get participant details.
7. Resolve names/time phrases to canonical IDs from the data above.
8. Build typed payload and call the appropriate submit endpoint (`submitMarkAttendance` or `submitRecordMatch`).
9. If status is `pending_approval`, confirm to the user that the command has been queued. Approval/rejection happens from the Gatherly dashboard by an admin.

**Important:** Once an `organizationId` is obtained from the capabilities step, pass it in every subsequent API call.

## Output Style to User
- Short and operational.
- Before approval: show a clear preview of what will happen.
- After execution: show success summary and identifiers.
- On failure: show actionable correction steps.

## Reliability and Safety
- Treat `sourceEventId` as idempotency key (use format `tg:<chatId>:<messageId>`).
- Retry only transient network errors.
- Do not retry permanent validation errors without new user input.
- Keep strict separation between preview and execution.

## Prohibited Behavior
- Free-form database updates.
- Silent fallback to guessed entities.
- Skipping Gatherly validation because confidence is high.
- Executing on implicit approval.

## Reference
See `references/api.md` for detailed request/response envelopes and examples.

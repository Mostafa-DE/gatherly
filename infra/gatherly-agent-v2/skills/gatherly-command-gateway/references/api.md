# Gatherly Command Gateway API Reference

This document defines the API envelope for OpenClaw <-> Gatherly command orchestration.

**IMPORTANT:** Use `curl` via shell/exec for all API calls. The `web_fetch` tool does not support POST or custom headers.

## Table of Contents
- [Base URL](#base-url)
- [Headers](#headers)
- [tRPC Transport Format](#trpc-transport-format)
- [1) Get Capabilities](#1-get-capabilities)
- [2) Get Activities](#2-get-activities)
- [3) Get Sessions](#3-get-sessions)
- [4) Search Sessions](#4-search-sessions)
- [5) Get Participants](#5-get-participants)
- [6) Get Member Summary](#6-get-member-summary)
- [7) Submit Mark Attendance](#7-submit-mark-attendance)
- [8) Submit Record Match](#8-submit-record-match)
- [9) Submit Mark Payment](#9-submit-mark-payment)
- [10) Submit Add Note](#10-submit-add-note)
- [11) Submit Add Participant](#11-submit-add-participant)
- [12) Submit Remove Participant](#12-submit-remove-participant)
- [Error Handling Contract](#error-handling-contract)

## Base URL
Use `${GATHERLY_BASE_URL}` from environment.

## Headers
- `Authorization: Bearer ${GATHERLY_BOT_API_KEY}`
- `Content-Type: application/json` (POST requests only)

## tRPC Transport Format

**Queries (GET):**
- Input is URL-encoded JSON in `?input=<encoded>` query parameter
- The JSON structure is: `{"json": { ...params }}`
- Response: `{"result": {"data": {"json": { ...response }}}}`

**Mutations (POST):**
- Body is: `{"json": { ...params }}`
- Response: `{"result": {"data": {"json": { ...response }}}}`

**Errors:**
- Response: `{"error": {"json": {"message": "...", "code": -32001, "data": {"code": "UNAUTHORIZED", ...}}}}`

## 1) Get Capabilities

Discover supported actions and their required fields. Call this first.

**Input fields:**
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin is linked to multiple orgs, pass the chosen org ID here

### curl (initial call — no organizationId)
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getCapabilities?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%7D%7D"
```

### curl (with organizationId — after org selection)
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getCapabilities?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%7D%7D"
```

Each `supportedActions` entry includes `endpoint` (tRPC procedure name), `method` (`POST`), and `path` (full URL path) so you know exactly how to call the corresponding submit endpoint.

### Response — `status: "ready"` (single org or organizationId provided)
```json
{
  "result": {
    "data": {
      "json": {
        "status": "ready",
        "organization": { "id": "org_123", "name": "My Community" },
        "role": "owner",
        "supportedActions": [
          {
            "action": "mark_attendance",
            "endpoint": "submitMarkAttendance",
            "method": "POST",
            "path": "/api/trpc/plugin.assistant.submitMarkAttendance",
            "requiresApproval": true,
            "fields": [
              { "name": "sessionId", "type": "string", "required": true, "description": "The session to mark attendance for. Use getActivities then getSessions or searchSessions to find the session ID." },
              { "name": "updates", "type": "array", "required": true, "description": "Array of { userId: string, attendance: 'show' | 'no_show' | 'pending' }. Use getParticipants to get user IDs." }
            ]
          },
          {
            "action": "record_match_result",
            "endpoint": "submitRecordMatch",
            "method": "POST",
            "path": "/api/trpc/plugin.assistant.submitRecordMatch",
            "requiresApproval": true,
            "fields": [
              { "name": "activityId", "type": "string", "required": true, "description": "The activity this match belongs to. Use getActivities to find the activity ID." },
              { "name": "sessionId", "type": "string", "required": true, "description": "The session this match was played in. Use getSessions or searchSessions to find the session ID." },
              { "name": "matchFormat", "type": "string", "required": true, "description": "MUST match one of activity.matchFormats.supported from getActivities. Use activity.matchFormats.default if user does not specify." },
              { "name": "team1", "type": "array", "required": true, "description": "Array of user IDs for team 1. Length MUST match the format's playersPerTeam from activity.matchFormats.formatRules." },
              { "name": "team2", "type": "array", "required": true, "description": "Array of user IDs for team 2. Length MUST match the format's playersPerTeam from activity.matchFormats.formatRules." },
              { "name": "scores", "type": "array", "required": true, "description": "Array of sets/games. Each element is a tuple [team1Score, team2Score]. Example for padel/tennis: [[6, 3], [6, 4]] means Set 1: 6-3, Set 2: 6-4. For object-score sports (basketball, football): use {team1: number, team2: number}." },
              { "name": "notes", "type": "string", "required": false }
            ]
          }
        ]
      }
    }
  }
}
```

### Response — `status: "org_selection_required"` (multiple admin orgs, no organizationId)
```json
{
  "result": {
    "data": {
      "json": {
        "status": "org_selection_required",
        "linkedOrgs": [
          { "organizationId": "org_123", "name": "Padel Club", "role": "owner" },
          { "organizationId": "org_456", "name": "Tennis League", "role": "admin" }
        ],
        "supportedActions": []
      }
    }
  }
}
```

When you receive `org_selection_required`, present the org list to the user, ask them to pick one, then call `getCapabilities` again with `organizationId`.

## 2) Get Activities

Fetch activities with ranking/match configuration. **Requires admin/owner role** — members will receive a `FORBIDDEN` error.

**Input fields:**
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `activityId` (optional) — filter to a specific activity
- `includeInactive` (optional, default: `false`) — include inactive activities

### curl
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getActivities?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%7D%7D"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "organization": { "id": "org_123", "name": "My Community" },
        "activities": [
          {
            "id": "act_123",
            "name": "Padel",
            "slug": "padel",
            "isActive": true,
            "domainId": "padel",
            "matchFormats": {
              "supported": ["singles", "doubles"],
              "default": "doubles",
              "formatRules": {
                "singles": { "playersPerTeam": 1, "minPlayersPerTeam": 1, "maxPlayersPerTeam": 1 },
                "doubles": { "playersPerTeam": 2, "minPlayersPerTeam": 2, "maxPlayersPerTeam": 2 }
              }
            }
          }
        ]
      }
    }
  }
}
```

## 3) Get Sessions

Browse recent/upcoming sessions. Use for time-based session discovery. **Requires admin/owner role.**

**Input fields:**
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `activityId` (optional) — filter sessions to a specific activity
- `sessionId` (optional) — filter to a specific session by ID
- `includeUpcoming` (optional, default: `true`) — include future sessions
- `includePast` (optional, default: `true`) — include past sessions
- `pastLimit` (optional, default: `30`, max: `100`) — max number of past sessions to return

### curl (list all sessions)
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getSessions?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%7D%7D"
```

### curl (sessions for a specific activity)
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getSessions?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%2C%22activityId%22%3A%22ACTIVITY_ID_HERE%22%7D%7D"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "organization": { "id": "org_123", "name": "My Community" },
        "sessions": [
          { "id": "ses_123", "title": "Weekend Padel Session", "dateTime": "2026-02-21T19:00:00.000Z", "activityId": "act_123", "status": "published", "location": null }
        ]
      }
    }
  }
}
```

## 4) Search Sessions

Find sessions by title. Searches ALL sessions (past + upcoming, any age) using case-insensitive partial match. Use this when the user mentions a specific session by name. **Requires admin/owner role.**

**Input fields:**
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `query` (required, 1-200 chars) — search term for session title
- `activityId` (optional) — filter to a specific activity
- `limit` (optional, default: `20`, max: `50`) — max results

### curl
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.searchSessions?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%2C%22query%22%3A%22Weekend%20Padel%22%7D%7D"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "organization": { "id": "org_123", "name": "My Community" },
        "sessions": [
          { "id": "ses_123", "title": "Weekend Padel Session #5", "dateTime": "2026-02-21T19:00:00.000Z", "activityId": "act_123", "status": "published", "location": null },
          { "id": "ses_099", "title": "Weekend Padel Session #4", "dateTime": "2026-02-14T19:00:00.000Z", "activityId": "act_123", "status": "completed", "location": null }
        ]
      }
    }
  }
}
```

## 5) Get Participants

Get participants for a specific session. Use to resolve user names to IDs for submit endpoints. **Requires admin/owner role.**

**Input fields:**
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `sessionId` (required) — the session to get participants for

### curl
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getParticipants?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%2C%22sessionId%22%3A%22SESSION_ID_HERE%22%7D%7D"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "organization": { "id": "org_123", "name": "My Community" },
        "sessionId": "ses_123",
        "participants": [
          { "participationId": "part_123", "userId": "usr_123", "name": "Ahmed", "nickname": null, "attendance": "pending", "status": "joined" }
        ]
      }
    }
  }
}
```

## 6) Get Member Summary

Search for a member by name, email, or nickname and get their full profile including engagement stats, unpaid sessions, and rankings. **Requires admin/owner role.** No approval required — this is a read-only query.

**Input fields:**
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `query` (optional, 1-200 chars) — search term for name, email, or nickname
- `userId` (optional) — direct lookup by user ID

**Note:** Either `query` or `userId` must be provided.

### curl (search by name)
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getMemberSummary?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%2C%22query%22%3A%22Ahmed%22%7D%7D"
```

### curl (direct lookup by userId)
```bash
/usr/bin/curl -s \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.getMemberSummary?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22TELEGRAM_USER_ID%22%2C%22organizationId%22%3A%22org_123%22%2C%22userId%22%3A%22usr_123%22%7D%7D"
```

### Response — single match (full profile)
```json
{
  "result": {
    "data": {
      "json": {
        "organization": { "id": "org_123", "name": "My Community" },
        "matches": null,
        "member": {
          "userId": "usr_123",
          "name": "Ahmed",
          "email": "ahmed@example.com",
          "nickname": "Ahm",
          "engagement": {
            "sessionsAttended": 12,
            "sessionsTotal": 15,
            "noShows": 1,
            "attendanceRate": 0.8
          },
          "unpaidSessions": [
            { "sessionId": "ses_456", "title": "Friday Padel", "dateTime": "2026-02-20T19:00:00.000Z" }
          ],
          "rankings": [
            { "id": "mr_1", "userId": "usr_123", "rankingDefinitionId": "rd_1", "stats": {}, "lastActivityAt": "2026-02-20T19:00:00.000Z" }
          ]
        }
      }
    }
  }
}
```

### Response — multiple matches (disambiguation needed)
```json
{
  "result": {
    "data": {
      "json": {
        "organization": { "id": "org_123", "name": "My Community" },
        "matches": [
          { "userId": "usr_123", "name": "Ahmed Ali", "nickname": "Ahm" },
          { "userId": "usr_456", "name": "Ahmed Hassan", "nickname": null }
        ],
        "member": null
      }
    }
  }
}
```

When multiple matches are returned, present the list to the user and ask them to clarify which member they mean, then call again with the specific `userId`.

### Response — no matches
```json
{
  "result": {
    "data": {
      "json": {
        "organization": { "id": "org_123", "name": "My Community" },
        "matches": [],
        "member": null
      }
    }
  }
}
```

## 7) Submit Mark Attendance

Submit a typed attendance marking request into the pending approval queue.

**Input fields:**
- `sourceEventId` (required) — idempotency key (format: `tg:<chatId>:<messageId>`)
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `transcript` (optional) — original voice transcript
- `sessionId` (required) — the session to mark attendance for
- `updates` (required) — array of `{ userId: string, attendance: "show" | "no_show" | "pending" }` (min 1, max 200)

### curl
```bash
/usr/bin/curl -s -X POST \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:chat123:msg456","telegramUserId":"TELEGRAM_USER_ID","organizationId":"org_123","sessionId":"ses_123","updates":[{"userId":"usr_123","attendance":"show"},{"userId":"usr_456","attendance":"show"}],"transcript":"mark ahmed and sara present"}}' \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.submitMarkAttendance"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "actionRequestId": "aar_123",
        "status": "pending_approval",
        "created": true
      }
    }
  }
}
```

## 8) Submit Record Match

Submit a typed match result recording request into the pending approval queue.

**Input fields:**
- `sourceEventId` (required) — idempotency key (format: `tg:<chatId>:<messageId>`)
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `transcript` (optional) — original voice transcript
- `activityId` (required) — the activity this match belongs to
- `sessionId` (required) — the session this match was played in
- `matchFormat` (required) — must match one of `activity.matchFormats.supported`
- `team1` (required) — array of user IDs for team 1
- `team2` (required) — array of user IDs for team 2
- `scores` (required) — score data (e.g. `[[6, 3], [6, 4]]` for set scores)
- `notes` (optional, max 500 chars) — match notes

### curl
```bash
/usr/bin/curl -s -X POST \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:chat123:msg789","telegramUserId":"TELEGRAM_USER_ID","organizationId":"org_123","activityId":"act_123","sessionId":"ses_123","matchFormat":"doubles","team1":["usr_1","usr_2"],"team2":["usr_3","usr_4"],"scores":[[6,3],[6,4]],"transcript":"record match doubles 6-3 6-4"}}' \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.submitRecordMatch"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "actionRequestId": "aar_456",
        "status": "pending_approval",
        "created": true
      }
    }
  }
}
```

## 9) Submit Mark Payment

Submit a typed payment marking request into the pending approval queue.

**Input fields:**
- `sourceEventId` (required) — idempotency key (format: `tg:<chatId>:<messageId>`)
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `transcript` (optional) — original voice transcript
- `sessionId` (required) — the session to mark payment for
- `updates` (required) — array of `{ userId: string, payment: "paid" | "unpaid" }` (min 1, max 200)

### curl
```bash
/usr/bin/curl -s -X POST \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:chat123:msg101","telegramUserId":"TELEGRAM_USER_ID","organizationId":"org_123","sessionId":"ses_123","updates":[{"userId":"usr_123","payment":"paid"},{"userId":"usr_456","payment":"paid"}],"transcript":"mark ahmed and sara as paid"}}' \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.submitMarkPayment"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "actionRequestId": "aar_789",
        "status": "pending_approval",
        "created": true
      }
    }
  }
}
```

## 10) Submit Add Note

Submit a request to add a note to a participant in a session.

**Input fields:**
- `sourceEventId` (required) — idempotency key (format: `tg:<chatId>:<messageId>`)
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `transcript` (optional) — original voice transcript
- `sessionId` (required) — the session the participant belongs to
- `userId` (required) — the user to add a note to
- `notes` (required, max 1000 chars) — the note text (replaces any existing note)

### curl
```bash
/usr/bin/curl -s -X POST \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:chat123:msg202","telegramUserId":"TELEGRAM_USER_ID","organizationId":"org_123","sessionId":"ses_123","userId":"usr_123","notes":"Arrived late, joined second half"}}' \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.submitAddNote"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "actionRequestId": "aar_303",
        "status": "pending_approval",
        "created": true
      }
    }
  }
}
```

## 11) Submit Add Participant

Submit a request to add a member to a session as a participant.

**Input fields:**
- `sourceEventId` (required) — idempotency key (format: `tg:<chatId>:<messageId>`)
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `transcript` (optional) — original voice transcript
- `sessionId` (required) — the session to add the participant to
- `userId` (required) — the user to add as a participant

### curl
```bash
/usr/bin/curl -s -X POST \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:chat123:msg404","telegramUserId":"TELEGRAM_USER_ID","organizationId":"org_123","sessionId":"ses_123","userId":"usr_123","transcript":"add ahmed to friday session"}}' \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.submitAddParticipant"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "actionRequestId": "aar_505",
        "status": "pending_approval",
        "created": true
      }
    }
  }
}
```

## 12) Submit Remove Participant

Submit a request to remove a participant from a session.

**Input fields:**
- `sourceEventId` (required) — idempotency key (format: `tg:<chatId>:<messageId>`)
- `telegramUserId` (required) — the Telegram user ID
- `organizationId` (optional) — if the admin has multiple orgs
- `transcript` (optional) — original voice transcript
- `sessionId` (required) — the session to remove the participant from
- `userId` (required) — the user to remove

### curl
```bash
/usr/bin/curl -s -X POST \
  -H "Authorization: Bearer ${GATHERLY_BOT_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:chat123:msg606","telegramUserId":"TELEGRAM_USER_ID","organizationId":"org_123","sessionId":"ses_123","userId":"usr_456","transcript":"remove sara from friday session"}}' \
  "${GATHERLY_BASE_URL}/api/trpc/plugin.assistant.submitRemoveParticipant"
```

### Response
```json
{
  "result": {
    "data": {
      "json": {
        "actionRequestId": "aar_707",
        "status": "pending_approval",
        "created": true
      }
    }
  }
}
```

## Error Handling Contract

Errors follow the tRPC error format:
```json
{
  "error": {
    "json": {
      "message": "Invalid or expired API key",
      "code": -32001,
      "data": {
        "code": "UNAUTHORIZED",
        "httpStatus": 401
      }
    }
  }
}
```

Common error codes:
- `UNAUTHORIZED` (401) — invalid/expired API key
- `FORBIDDEN` (403) — user not admin, Telegram not linked
- `BAD_REQUEST` (400) — invalid payload, validation error
- `NOT_FOUND` (404) — resource not found
- `INTERNAL_SERVER_ERROR` (500) — execution failure

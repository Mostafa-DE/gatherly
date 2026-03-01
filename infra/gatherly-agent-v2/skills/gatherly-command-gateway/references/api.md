# Gatherly Relay API Reference

All requests must go through the local relay:
- Base URL: `${GATHERLY_RELAY_BASE_URL}`
- Never send auth headers manually.

The relay forwards to Gatherly and injects:
- Required authentication and per-request identity headers.

## tRPC Envelope

Queries (GET):
- `?input=<url-encoded JSON>`
- JSON shape: `{"json": { ...params }}`

Mutations (POST):
- Body shape: `{"json": { ...params }}`

Response envelope:
- `{"result":{"data":{"json": ...}}}`

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

## Example Calls

### Get Capabilities (GET)
```bash
/usr/bin/curl -s \
  "${GATHERLY_RELAY_BASE_URL}/api/trpc/plugin.assistant.getCapabilities?input=%7B%22json%22%3A%7B%22telegramUserId%22%3A%22123456%22%7D%7D"
```

### Submit Add Note (POST)
```bash
/usr/bin/curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"json":{"sourceEventId":"tg:chat123:msg202","telegramUserId":"123456","organizationId":"org_123","sessionId":"ses_123","userId":"usr_123","notes":"Arrived late"}}' \
  "${GATHERLY_RELAY_BASE_URL}/api/trpc/plugin.assistant.submitAddNote"
```

## Error Shape
```json
{
  "error": {
    "json": {
      "message": "Request could not be completed",
      "data": {
        "code": "INTERNAL_SERVER_ERROR",
        "httpStatus": 500
      }
    }
  }
}
```

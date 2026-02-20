# API Contract (v0)

## GET /api/status
Returns service status and model configuration.

Response example:
```json
{
  "ok": true,
  "serverTime": "2026-02-17T12:00:00.000Z",
  "sessions": 2,
  "llmConfigured": true
}
```

## POST /api/chat
Send a chat message and receive reply/state/draft.

Request example:
```json
{
  "sessionId": "optional",
  "text": "subject: Photosynthesis grade: Grade 8 duration: 45 minutes"
}
```

Response example:
```json
{
  "sessionId": "xxx",
  "reply": "I have summarized your intent...",
  "state": { "...": "..." },
  "intent": {
    "fields": { "subject": "Photosynthesis" },
    "missingFields": ["goals", "keyPoints"],
    "ready": false,
    "confirmed": false
  },
  "draft": null
}
```

## POST /api/upload
Upload reference materials (stored only for now).

FormData:
- files[]
- sessionId

## GET /api/session/:id
Fetch full session state.

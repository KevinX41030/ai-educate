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

## GET /api/rag/status
Returns knowledge base index statistics.

## POST /api/rag/query
Query the local knowledge base (baseline keyword retrieval).

Request example:
```json
{
  "query": "photosynthesis light reaction",
  "topK": 3
}
```

## POST /api/rag/reload
Reload the local knowledge base index.

## POST /api/export/pptx
Export the latest PPTX based on the session draft.

Request example:
```json
{
  "sessionId": "optional",
  "draft": { "ppt": [] },
  "useAi": true,
  "useTemplate": true,
  "mode": "editable",
  "regenerateScene": false
}
```

Notes:
- `mode` currently supports `editable`
- `regenerateScene=true` will rebuild the intermediate scene before export
- if the session already has `scene`, export will reuse it instead of regenerating on every click

## POST /api/ppt/scene/regenerate
Generate or refresh the intermediate PPT scene spec used by preview and export.

Request example:
```json
{
  "sessionId": "optional",
  "draft": { "ppt": [] },
  "force": true
}
```

Response example:
```json
{
  "sessionId": "optional",
  "source": "llm",
  "updatedAt": "2026-03-08T12:00:00.000Z",
  "scene": {
    "theme": {},
    "slides": []
  }
}
```

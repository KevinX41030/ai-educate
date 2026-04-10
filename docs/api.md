# API Contract

## GET /api/status
返回服务状态、当前会话数、模型配置情况和知识库状态。

Response example:
```json
{
  "ok": true,
  "serverTime": "2026-02-17T12:00:00.000Z",
  "sessions": 2,
  "llmConfigured": true,
  "rag": {
    "files": 1,
    "chunks": 3,
    "updatedAt": "2026-04-07T08:00:00.000Z"
  }
}
```

## POST /api/chat
发送一条对话消息，返回最新回复、session 状态、draft/scene。

Request example:
```json
{
  "sessionId": "optional",
  "text": "我准备给初二讲光合作用，45分钟"
}
```

Response example:
```json
{
  "sessionId": "xxx",
  "reply": "我先按这个方向整理需求...",
  "state": { "...": "..." },
  "intent": {
    "fields": { "subject": "光合作用" },
    "missingFields": ["goals", "keyPoints"],
    "ready": false,
    "confirmed": false,
    "nextAction": "ask_more",
    "showGenerateCTA": false,
    "ctaLabel": "立即生成 PPT",
    "ctaReason": ""
  },
  "draft": null,
  "scene": null,
  "sceneStatus": "idle",
  "rag": []
}
```

## POST /api/chat/stream
SSE 版对话接口。

事件流：
- `status`
- `reply_delta`
- `model_delta`
- `result`
- `error`
- `done`

约束：
- 失败时必须先发 `error`，再发 `done { ok: false }`
- `done` 不能单独被前端视作成功

## POST /api/upload
上传参考资料。

FormData:
- files[]
- sessionId

## GET /api/session/:id
获取完整会话快照，包含：
- `state`
- `intent`
- `messages`
- `rag`

## GET /api/rag/status
返回知识库索引统计。

## POST /api/rag/query
基于关键词查询本地知识库。

Request example:
```json
{
  "query": "photosynthesis light reaction",
  "topK": 3
}
```

## POST /api/rag/reload
Reload the local knowledge base index.

## POST /api/ppt/generate
根据当前 session 或传入 fields/draft 生成 PPT draft。

如果缺少必要字段，返回：
```json
{
  "error": "missing_fields",
  "missingFields": ["goals", "keyPoints"]
}
```

## POST /api/ppt/generate/stream
SSE 版 PPT 生成接口。

事件流：
- `status`
- `draft_preview`
- `model_delta`
- `result`
- `error`
- `done`

## POST /api/export/pptx
根据当前 session 或传入 draft/scene 导出 PPTX。

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
- `mode` currently supports `editable` and `hybrid`
- `regenerateScene=true` will rebuild the intermediate scene before export
- if the session already has `scene`, export will reuse it instead of regenerating on every click
- current `scene` may also carry `designPreset`, e.g. `corporate`, `editorial`, `classroom`

## POST /api/ppt/scene/regenerate
生成或刷新 preview/export 使用的中间 `scene`。

Request example:
```json
{
  "sessionId": "optional",
  "draft": { "ppt": [] },
  "force": true
}
```

## POST /api/ppt/scene/regenerate/stream
SSE 版 scene 重排接口。

事件流：
- `status`
- `model_delta`
- `result`
- `error`
- `done`

## POST /api/ppt/slide/enhance
只针对单页做 AI 增强，不修改其他页面。

Request example:
```json
{
  "sessionId": "optional",
  "draft": { "ppt": [] },
  "scene": { "slides": [] },
  "slideIndex": 2,
  "instruction": "把这一页改得更像公开课展示，层次更清楚。"
}
```

## POST /api/session/fields
直接更新结构化字段。更新后会清空旧 draft/scene，等待下一次生成。

Response example:
```json
{
  "sessionId": "optional",
  "source": "llm",
  "updatedAt": "2026-03-08T12:00:00.000Z",
  "scene": {
    "designPreset": "editorial",
    "theme": {},
    "slides": []
  }
}
```

# AGENTS

## Project notes
- This repo is an AI-assisted lesson/PPT generator with a Node server in `server/` and a web app in `web/`.
- Before debugging a live issue, verify that the running server really comes from this worktree. In recent debugging, port `5174` was serving `/Users/kevinx/ai-educate/server`, not the current worktree.

## LLM / upstream pitfalls
- The current upstream gateway is sensitive to `responses` requests that include `text.format: { type: 'json_object' }`.
- On the current gateway, `responses + text.format=json_object` can return `502` even when the same prompt works without that field.
- For this project, prefer prompt-level JSON constraints plus local `safeJsonParse()` instead of forcing `text.format=json_object` on `responses` calls.
- Do not assume “chat works” means “generate works”. We confirmed cases where `/api/chat/stream` succeeded while `/api/ppt/generate` failed because generation payloads are heavier and more structured.
- The current upstream channel may not expose every model. In one confirmed case, `gpt-4o-mini` returned `model_not_found`, while `gpt-5.4` and `gpt-5.2-codex` worked.

## SSE / streaming pitfalls
- When an SSE request fails, do not emit `done` with `{ ok: true }` after an `error` event.
- Error flows should end as: `error` event -> `done` event with `{ ok: false, error: ... }`.
- Upstream failures may return raw HTML (for example Cloudflare `502` pages). Always sanitize them before returning messages to the frontend.
- Frontend and backend should treat `status`, `error`, `result`, and `done` as separate stream states. Do not treat `done` alone as success.

## Workspace / agent behavior notes
- `showGenerateCTA=true` means the frontend will immediately show a generate button. Assistant copy must not say “还差一个关键点” or any other blocking wording at the same time.
- If the assistant reply still sounds blocking, backend logic should downgrade the CTA decision instead of showing contradictory UI.
- If the model reply is missing or fails, fallback copy must stay conversational. Avoid rigid form-style replies that dump every missing field at once.

## Recommended debugging steps
- First verify which server process is actually serving the UI port.
- Then test both local endpoints:
  - `curl -N http://localhost:5174/api/chat/stream ...`
  - `curl -N http://localhost:5174/api/ppt/generate/stream ...`
- If chat works but generate fails, compare the actual `responses` request shape instead of assuming the upstream is fully down.
- If needed, test the upstream directly with a minimal `curl` request before changing application logic.
- Keep request/response logging concise and avoid leaking secrets in logs.

## Safe defaults for future edits
- Prefer small, incremental prompt changes over broad rewrites.
- Preserve true streaming behavior for chat and generation paths.
- Keep backend validation for UI semantics; do not rely only on free-form model wording.
- If a fix only exists in another local checkout, port it here explicitly instead of assuming the running service already uses this repo.

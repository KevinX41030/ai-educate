#!/usr/bin/env bash
set -euo pipefail

ENV_PATH="${1:-${ENV_PATH:-}}"
if [[ -z "${ENV_PATH}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  CANDIDATE_REPO="${SCRIPT_DIR}/../.env"
  CANDIDATE_HOME="/Users/kevinx/ai-educate/.env"
  if [[ -f "${CANDIDATE_REPO}" ]]; then
    ENV_PATH="${CANDIDATE_REPO}"
  elif [[ -f "${CANDIDATE_HOME}" ]]; then
    ENV_PATH="${CANDIDATE_HOME}"
  else
    echo "No .env found. Provide path: scripts/llm-check.sh /path/to/.env" >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1090
. "${ENV_PATH}"
set +a

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "OPENAI_API_KEY is missing in ${ENV_PATH}" >&2
  exit 1
fi

BASE="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
BASE="${BASE%/}"
MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

RESP_PAYLOAD=$(printf '{"model":"%s","input":"ping"}' "$MODEL")
CHAT_PAYLOAD=$(printf '{"model":"%s","messages":[{"role":"user","content":"ping"}]}' "$MODEL")

RESP_TMP=$(mktemp)
CHAT_TMP=$(mktemp)

cleanup() {
  rm -f "$RESP_TMP" "$CHAT_TMP"
}
trap cleanup EXIT

printf "Using env: %s\n" "$ENV_PATH"
printf "Base: %s\nModel: %s\n\n" "$BASE" "$MODEL"

printf "== /responses ==\n"
RESP_CODE=$(curl -sS -o "$RESP_TMP" -w "%{http_code}" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  "$BASE/responses" \
  -d "$RESP_PAYLOAD")
printf "HTTP %s\n" "$RESP_CODE"
head -c 400 "$RESP_TMP" || true
printf "\n\n"

printf "== /chat/completions ==\n"
CHAT_CODE=$(curl -sS -o "$CHAT_TMP" -w "%{http_code}" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  "$BASE/chat/completions" \
  -d "$CHAT_PAYLOAD")
printf "HTTP %s\n" "$CHAT_CODE"
head -c 400 "$CHAT_TMP" || true
printf "\n"

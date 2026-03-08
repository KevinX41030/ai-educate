#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:5174}"
BASE_URL="${BASE_URL%/}"

SCENE_TMP=$(mktemp)
EDITABLE_TMP=$(mktemp "${TMPDIR:-/tmp}/editable.XXXXXX.pptx")
HYBRID_TMP=$(mktemp "${TMPDIR:-/tmp}/hybrid.XXXXXX.pptx")

cleanup() {
  rm -f "$SCENE_TMP" "$EDITABLE_TMP" "$HYBRID_TMP"
}
trap cleanup EXIT

REQUEST_BODY=$(cat <<'JSON'
{
  "draft": {
    "ppt": [
      { "id": "cover", "title": "光合作用", "type": "cover", "bullets": ["初二", "45分钟"] },
      { "id": "toc", "title": "目录", "type": "toc", "bullets": ["定义", "过程", "案例", "总结"] },
      { "id": "concept", "title": "光合作用定义", "type": "content", "bullets": ["说明能量转化", "识别反应条件", "理解关键产物"] },
      { "id": "process", "title": "光合作用过程", "type": "content", "bullets": ["光反应的输入", "暗反应的过程", "整体流程总结"] },
      { "id": "summary", "title": "总结", "type": "summary", "bullets": ["回顾概念", "理解流程", "连接实验", "完成练习"] }
    ],
    "lessonPlan": {
      "goals": "理解光合作用的定义与过程",
      "process": ["导入问题", "讲解定义", "拆解流程", "课堂讨论", "总结与练习"],
      "methods": "讲授 + 探究",
      "activities": "基于叶片实验分析案例",
      "homework": "完成课堂练习并绘制流程图"
    },
    "interactionIdea": {
      "title": "抢答互动",
      "description": "围绕光反应与暗反应设置 5 道抢答题"
    },
    "theme": {
      "primary": "#1F3B73",
      "accent": "#4C8BF5",
      "background": "#F8FAFC",
      "text": "#0F172A",
      "font": "Microsoft YaHei"
    },
    "layoutHints": ["cover_right_panel", "content_two_column", "summary_cards"]
  },
  "force": false
}
JSON
)

printf '== scene regenerate ==\n'
SCENE_CODE=$(curl -sS -o "$SCENE_TMP" -w "%{http_code}" \
  -H 'Content-Type: application/json' \
  "$BASE_URL/api/ppt/scene/regenerate" \
  -d "$REQUEST_BODY")
printf 'HTTP %s\n' "$SCENE_CODE"
head -c 240 "$SCENE_TMP" || true
printf '\n\n'

printf '== editable export ==\n'
EDITABLE_CODE=$(curl -sS -o "$EDITABLE_TMP" -w "%{http_code}" \
  -H 'Content-Type: application/json' \
  "$BASE_URL/api/export/pptx" \
  -d '{"mode":"editable","useAi":false,"draft":{"ppt":[{"id":"cover","title":"光合作用","type":"cover","bullets":["初二","45分钟"]},{"id":"toc","title":"目录","type":"toc","bullets":["定义","过程","案例","总结"]},{"id":"concept","title":"光合作用定义","type":"content","bullets":["说明能量转化","识别反应条件","理解关键产物"]},{"id":"process","title":"光合作用过程","type":"content","bullets":["光反应的输入","暗反应的过程","整体流程总结"]},{"id":"summary","title":"总结","type":"summary","bullets":["回顾概念","理解流程","连接实验","完成练习"]}],"lessonPlan":{"goals":"理解光合作用的定义与过程","process":["导入问题","讲解定义","拆解流程","课堂讨论","总结与练习"],"methods":"讲授 + 探究","activities":"基于叶片实验分析案例","homework":"完成课堂练习并绘制流程图"},"interactionIdea":{"title":"抢答互动","description":"围绕光反应与暗反应设置 5 道抢答题"},"theme":{"primary":"#1F3B73","accent":"#4C8BF5","background":"#F8FAFC","text":"#0F172A","font":"Microsoft YaHei"},"layoutHints":["cover_right_panel","content_two_column","summary_cards"]}}')
printf 'HTTP %s, bytes=%s\n\n' "$EDITABLE_CODE" "$(wc -c < "$EDITABLE_TMP")"

printf '== hybrid export ==\n'
HYBRID_CODE=$(curl -sS -o "$HYBRID_TMP" -w "%{http_code}" \
  -H 'Content-Type: application/json' \
  "$BASE_URL/api/export/pptx" \
  -d '{"mode":"hybrid","useAi":false,"regenerateScene":true,"draft":{"ppt":[{"id":"cover","title":"光合作用","type":"cover","bullets":["初二","45分钟"]},{"id":"toc","title":"目录","type":"toc","bullets":["定义","过程","案例","总结"]},{"id":"concept","title":"光合作用定义","type":"content","bullets":["说明能量转化","识别反应条件","理解关键产物"]},{"id":"process","title":"光合作用过程","type":"content","bullets":["光反应的输入","暗反应的过程","整体流程总结"]},{"id":"summary","title":"总结","type":"summary","bullets":["回顾概念","理解流程","连接实验","完成练习"]}],"lessonPlan":{"goals":"理解光合作用的定义与过程","process":["导入问题","讲解定义","拆解流程","课堂讨论","总结与练习"],"methods":"讲授 + 探究","activities":"基于叶片实验分析案例","homework":"完成课堂练习并绘制流程图"},"interactionIdea":{"title":"抢答互动","description":"围绕光反应与暗反应设置 5 道抢答题"},"theme":{"primary":"#1F3B73","accent":"#4C8BF5","background":"#F8FAFC","text":"#0F172A","font":"Microsoft YaHei"},"layoutHints":["cover_right_panel","content_two_column","summary_cards"]}}')
printf 'HTTP %s, bytes=%s\n' "$HYBRID_CODE" "$(wc -c < "$HYBRID_TMP")"

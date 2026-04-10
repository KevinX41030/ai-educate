# ai-educate

一个面向教学场景的 AI 课件生成系统，当前已经跑通从需求整理到 PPT 导出的完整 MVP 链路：
- Vue 3 + Vite 前端：首页一句话进入、需求整理、生成页实时预览
- Node/Express 服务端：会话状态、流式接口、PPT 生成与导出
- LLM + 本地 RAG：结构化意图抽取、课件 draft 生成、scene 增强
- PPT 中间场景层：支持预览、重排、单页增强、导出复用

## 目录结构

```
ai-educate/
  server/          # API 服务
  web/             # Vue 前端
  data/uploads/    # 上传文件
  data/exports/    # 导出产物
  data/knowledge_base/  # 本地知识库
  docs/
```

## 当前架构

系统主链路是：

`用户输入 -> intent/fields -> draft -> scene -> pptx`

对应模块：
- `server/agent.js`：需求抽取、会话推进、生成门槛判断
- `server/llm.js`：Responses/Chat API 调用与流式解析
- `server/ppt/scene.js`：draft 与 scene 的双向映射
- `server/ppt/presentation-state.js`：预览态、scene 同步、流式 draft preview
- `server/export/pptx.js`：PPTX 导出
- `web/src/composables/useWorkspace.js`：前端工作区状态与流式交互

## 已实现功能

- 多轮对话收集课程信息
- 结构化教学意图抽取与 CTA 决策
- 文件上传占位接入
- 基于本地知识库的关键词 RAG
- PPT draft 流式生成
- scene 自动构建与 AI 重排
- 单页 AI 增强
- 实时预览与 PPTX 导出
- SSE 错误流与上游 HTML/502 清洗
- 基础自动化测试

## 启动方式

```bash
npm install
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:5174

## 开发时查看日志与热更新

如果想分别查看日志、并启用后端热更新，建议分开启动：
```bash
npm run dev:server
npm run dev:web
```

- 前端（Vite）自带热更新
- 后端使用 nodemon 热更新（配置见 `server/nodemon.json`）

## 模型配置（LLM）

复制 `.env.example` 为 `.env`，填写 API Key 与 Base URL：

```bash
OPENAI_API_KEY=你的key
OPENAI_BASE_URL=https://api.iksvip.cc/v1
OPENAI_MODEL=gpt-5.2-codex
```

如需使用其他模型，将 `OPENAI_MODEL` 替换为你的模型 ID 即可。

注意：
- 当前项目优先兼容 `responses` 接口，但不强依赖 `text.format=json_object`
- 如果上游对 `responses` JSON 约束不稳定，会回退到 prompt-level JSON + 本地解析

## 测试

```bash
npm test
```

当前测试覆盖：
- `agent` 生成门槛与本地 fallback
- streaming preview / scene 同步
- SSE 错误结束流
- 上游错误消息清洗

## 生产构建

```bash
npm run build
npm run start
```

## 规范文档
- API 约定：`docs/api.md`
- 教学意图 Schema：`docs/schema/intent.schema.json`
- 课件草稿 Schema：`docs/schema/lesson.schema.json`
 - PPT Scene Schema：`docs/schema/ppt-scene.schema.json`
 - 本地知识库：`data/knowledge_base/`
 - 功能验证指引：`docs/verification.md`

## 下一步
- 接入 PDF/Word/PPT 文本解析，让上传资料真正进入 RAG
- 升级 RAG 为可解释引用链路
- 继续拆分前端工作区状态与后端路由层

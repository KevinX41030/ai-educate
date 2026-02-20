# ai-educate (enterprise scaffold)

“多模态AI互动式教学智能体”的企业级脚手架：
- Vue 3 + Vite 前端（多轮对话 / 上传 / 预览）
- Node/Express API 服务
- 规则占位 + LLM 生成 + 基线 RAG（关键词检索）

## 目录结构

```
ai-educate/
  server/        # API 服务
  web/           # Vue 前端
  data/uploads/  # 上传文件
  docs/
```

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

## 模型配置（Codex/LLM）

复制 `.env.example` 为 `.env`，填写 API Key 与 Base URL：

```bash
OPENAI_API_KEY=你的key
OPENAI_BASE_URL=https://api.iksvip.cc/v1
OPENAI_MODEL=gpt-5.2-codex
```

如需使用 Codex 模型，将 `OPENAI_MODEL` 替换为你的模型 ID 即可。

## 生产构建

```bash
npm run build
npm run start
```

## 规范文档
- API 约定：`docs/api.md`
- 教学意图 Schema：`docs/schema/intent.schema.json`
- 课件草稿 Schema：`docs/schema/lesson.schema.json`
 - 本地知识库：`data/knowledge_base/`
 - 功能验证指引：`docs/verification.md`

## 下一步
- 接入多模态解析（PDF/视频等）
- 生成 `.pptx` / `.docx` 导出

# ai-educate (enterprise scaffold)

“多模态AI互动式教学智能体”的企业级脚手架：
- Vue 3 + Vite 前端（多轮对话 / 上传 / 预览）
- Node/Express API 服务
- 规则占位的对话与课件草稿生成（便于后续接入 LLM/RAG）

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

## 模型配置（Codex/LLM）

复制 `.env.example` 为 `.env`，填写 API Key 与 Base URL：

```bash
OPENAI_API_KEY=你的key
OPENAI_BASE_URL=https://api.iksvip.cc/v1
OPENAI_MODEL=gpt-4o-mini
```

如需使用 Codex 模型，将 `OPENAI_MODEL` 替换为你的模型 ID 即可。

## 生产构建

```bash
npm run build
npm run start
```

## 下一步
- 接入 Codex/LLM（替换 `server/agent.js` 规则逻辑）
- 接入本地知识库与检索（RAG）
- 接入多模态解析（PDF/视频等）
- 生成 `.pptx` / `.docx` 导出

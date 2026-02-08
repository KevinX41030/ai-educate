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

# ai-educate (MVP scaffold)

本项目为“多模态AI互动式教学智能体”的可运行脚手架，包含：
- 多轮对话澄清（规则化占位）
- 参考资料上传（仅保存，解析待接入）
- 课件初稿预览（PPT 结构 + 教案草稿 + 互动创意占位）

## 启动

```bash
npm install
npm run dev
```

浏览器打开：`http://localhost:5173`

## 下一步
- 接入真实大模型（替换 `server/agent.js` 的规则逻辑）
- 接入本地知识库与检索（RAG 模块）
- 接入多模态解析（PDF/视频等）
- 生成 `.pptx` / `.docx` 的导出

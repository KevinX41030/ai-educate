# 功能验证指引（v0）

> 建议分开启动，方便观察日志与热更新。

## 1. 启动服务

```bash
npm install
npm run dev:server
npm run dev:web
```

访问：
- 前端：http://localhost:5173
- 后端：http://localhost:5174

## 2. LLM 连接检查

```bash
curl -s http://localhost:5173/api/status
```

确认 `llmConfigured: true`。

如果需要调试模型输出，在 `.env` 中加入：
```
LLM_DEBUG=1
```
重启后端后再测试对话，控制台会输出模型原始返回（截断）。

## 3. 对话与意图抽取

输入示例：
```
我准备给初二讲光合作用，45分钟，目标是理解原理，知识点包括光反应、暗反应
```

预期：
- 右侧“需求确认”显示待补充项或提示“信息已齐全”
- 需求摘要自动填充

## 4. 确认生成草稿

点击“确认生成”，预期：
- PPT 草稿出现封面/目录/内容/总结页
- 教案草稿出现目标/过程/方法/活动/作业
- 互动设计出现示例

## 5. 知识库 RAG（baseline）

知识库位置：`data/knowledge_base/`（已内置示例：`photosynthesis.md`）

输入包含知识点的课程后点击“确认生成”，预期：
- 右侧“知识库引用”出现片段

也可直接请求：
```bash
curl -s http://localhost:5174/api/rag/query \
  -H 'Content-Type: application/json' \
  -d '{"query":"光合作用 光反应 暗反应","topK":3}'
```

## 6. 参考资料上传

上传 PDF / PPT / 图片 / 视频，预期：
- 对话区提示“文件已上传”
- 文件列表出现上传记录（解析占位）

## 7. 常见问题

- 无回复：检查是否打开 `http://localhost:5173`，并确认 Network 中有 `/api/chat` 请求。
- 一直追问：输入中缺少必要字段或模型未解析，尝试用结构化句子输入。

## 8. PPTX 导出

1) 生成课件初稿后，确认右侧出现“PPT 场景预览”  
2) 点击“重新排版”，预览更新且提示“场景已就绪”  
3) 点击“导出”按钮，浏览器下载 `lesson-*.pptx` 文件  
4) 打开文件确认包含封面/目录/内容/总结页

## 9. PPTX 主题样式

- 默认使用“现代企业蓝”主题（主色 #1F3B73，强调色 #4C8BF5）  
- 内容页为双栏布局，右侧提示卡自动填充要点  
- 模板文件位于 `server/templates/ai-educate-template.pptx`，可替换为自定义设计稿  
- 内容页包含概念/流程/案例/活动四种版式，导出时自动匹配  
- 如需强制重建默认模板，设置 `TEMPLATE_REBUILD=1` 后重新导出  

## 10. AI 增强 PPT 内容

系统现在先生成中间 `scene` 再导出：
- 初稿生成后会自动提供基础 scene 预览
- 点击“重新排版”时会调用 AI 生成增强 scene
- 导出默认复用现有 scene，避免每次导出都重新跑排版
- 如果 AI 排版失败，会回退到基于草稿的基础 scene

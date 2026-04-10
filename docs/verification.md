# 功能验证指引（v0）

> 建议分开启动，方便观察日志与热更新。

## 1. 启动服务

```bash
npm install
npm test
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

## 4. 确认生成草稿 / 流式预览

点击“确认生成”，预期：
- PPT 草稿出现封面/目录/内容/总结页
- 教案草稿出现目标/过程/方法/活动/作业
- 互动设计出现示例
- 如果走流式生成，页面会先收到 `draft_preview` 再收到最终 `result`

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
3) 选择“可编辑版”导出，确认下载 `lesson-*.pptx` 文件  
4) 再切换到“混合版”导出，确认同样成功下载  
5) 打开两个文件，对比混合版的背景、右侧卡片和总结页卡片视觉更完整

## 9. 自动化测试

```bash
npm test
```

当前覆盖：
- 生成门槛判断与本地 fallback
- draft preview / scene 状态同步
- SSE 失败流
- 上游错误文案清洗

## 10. PPTX 主题样式

- 系统现在会在 `corporate` / `editorial` / `classroom` 三种设计预设之间自动选择  
- 理科/严谨主题更容易落到 `corporate`，人文/极简主题更容易落到 `editorial`，低龄/互动主题更容易落到 `classroom`  
- 编辑态导出优先走 scene 渲染，不再被单一模板固定住  
- 模板文件仍保留在 `server/templates/ai-educate-template.pptx`，用于兼容旧路径  
- 内容页包含概念/流程/案例/活动四种信息结构，导出时自动匹配  

## 11. AI 增强 PPT 内容

系统现在先生成中间 `scene` 再导出：
- 初稿生成后会自动提供基础 scene 预览
- 点击“重新排版”时会调用 AI 生成增强 scene
- 导出默认复用现有 scene，避免每次导出都重新跑排版
- 如果 AI 排版失败，会回退到基于草稿的基础 scene
- `hybrid` 模式会把背景和装饰层合成为页面图层，同时保留核心标题/正文为原生文字
- `scene` 现在还会带一个 `designPreset`，用于区分整体视觉风格而不是只换文案

## 12. 一键 smoke 验证

如果本地服务已经启动，可执行：

```bash
scripts/ppt-export-smoke.sh
```

该脚本会依次验证：
- `/api/ppt/scene/regenerate`
- `editable` 导出
- `hybrid` 导出

## 13. 2026-04-08 自测记录

执行环境：
- 后端：`http://127.0.0.1:5174`
- 上游：`.env` 中的 `OPENAI_BASE_URL=https://api.ikuncode.cc/v1`
- 模型：`.env` 中的 `OPENAI_MODEL=gpt-5.4`

已执行：

```bash
npm test
npm run build
```

接口 smoke 结果：
- `GET /api/status`：`200`，`llmConfigured=true`
- `POST /api/chat`：`200`，返回 `nextAction=ready_to_generate`
- `POST /api/chat/stream`：事件顺序包含 `status -> model_delta -> reply_delta -> result -> done`
- `POST /api/chat/stream` 空文本：事件顺序为 `error -> done`，且 `done.ok=false`
- `POST /api/ppt/generate`：`200`，成功返回 `draft`，本次为 12 页，`sceneStatus=stale`
- `POST /api/ppt/scene/regenerate`：`200`，`source=llm`，`sceneStatus=ready`
- `POST /api/ppt/edit`：`200`，指定页修改生效
- `POST /api/export/docx`：`200`，导出文件非空，本次约 `11 KB`
- `POST /api/export/pptx`：`200`，导出文件非空，本次约 `270 KB`
- `POST /api/ppt/generate/stream`：事件顺序包含 `status -> model_delta -> draft_preview -> result -> done`
- `POST /api/ppt/scene/regenerate/stream`：事件顺序包含 `status -> model_delta -> result -> done`
- `POST /api/ppt/edit/stream`：事件顺序包含 `status -> model_delta -> result -> done`

补充说明：
- 首次请求如果传入一个不存在的 `sessionId`，服务会返回新的真实 `sessionId`；后续 smoke 需要复用响应里的 `sessionId`，不要继续使用自定义占位值。
- 当前上游依然会在长流式请求里插入 `ping` 事件，这属于正常保活，不应当被前端当作错误或结果。

## 14. 2026-04-08 浏览器级验证

验证方式：
- 使用本机 Headless Chrome DevTools 协议打开 `http://127.0.0.1:5174/workspace`
- Safari WebDriver 未启用 Remote Automation，因此未采用 Safari

覆盖链路：
- `/workspace` 首屏加载
- 前端隐藏文件上传控件触发上传
- 上传后文件列表与助手提示更新
- 对话输入自然语言需求
- 出现“立即生成PPT”按钮并可点击
- 跳转 `/generate` 后自动开始生成
- 生成页输入跟进修改要求并提交

实际结果：
- 工作区成功加载，欢迎文案、上传区、生成入口均可见
- 上传 `photosynthesis-ui.docx` 后，页面显示文件名和“已解析”，助手消息为“文件已上传，其中 1 份已完成解析，后续生成会自动参考。”
- 输入“结合叶片遮光实验和常见误区生成初二45分钟复习课”后，前端展示生成 CTA：
  - `ctaLabel=立即生成PPT`
  - `ctaReason=已有明确课题、年级、时长、实验重点、误区与风格，可直接生成初版课件。`
- 点击 CTA 后成功跳转到 `/generate`
- 生成页显示：
  - 标题：`PPT 已生成`
  - 页数：`13 页`
- 在生成页提交“再补一个更像老师课堂追问的问题”后，处理记录出现 `已完成整套课件修改。`

说明：
- 这轮验证确认了前端真实交互链路可用，不只是接口层可用。

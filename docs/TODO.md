# 多模态AI互动式教学智能体 · TODO

> 当前状态：核心 MVP 已跑通，后续重点从“能演示”转向“可维护、可验证、可扩展”。

## 已完成

- [x] Node 服务端 + Vue 前端单仓结构
- [x] 多轮对话收集课程需求
- [x] 教学意图结构化抽取与生成 CTA 决策
- [x] 本地知识库 baseline RAG（切块 + 关键词检索）
- [x] PPT draft 生成（封面/目录/内容/总结）
- [x] lessonPlan / interactionIdea 结构生成
- [x] scene 中间层建模与 schema
- [x] scene 重排、流式 draft preview、单页 AI 增强
- [x] PPTX 导出
- [x] SSE 错误流与上游 HTML 错误清洗
- [x] 基础自动化测试（agent / scene state / SSE）

## 近期优先级

### P0 工程稳定性
- [ ] 将 `server/index.js` 继续拆成 route + handler 层
- [ ] 将 `web/src/composables/useWorkspace.js` 拆成更小的状态模块
- [ ] 为导出链路与关键 API 增加集成测试

### P1 上传资料闭环
- [ ] PDF / Word / PPT 文本与结构提取
- [ ] 上传资料入索引并参与 RAG
- [ ] 在前端展示资料片段来源

### P2 RAG 质量
- [ ] 检索结果去重与排序优化
- [ ] 简单评测：召回率与引用准确性
- [ ] 生成内容的引用来源可视化

### P3 生成能力扩展
- [ ] Word 教案导出
- [ ] 更细粒度的局部再生成
- [ ] 多模态资料解析（OCR / 视频转写）

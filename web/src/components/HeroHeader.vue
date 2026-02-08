<template>
  <header class="hero">
    <div>
      <p class="eyebrow">多模态AI互动式教学智能体 · 企业级脚手架</p>
      <h1>从教学意图到课件初稿，形成标准化闭环。</h1>
      <p class="subtitle">
        当前版本已完成规范化对话流程、资料上传与课件草稿预览，为接入 RAG、多模态解析与模型生成做准备。
      </p>
    </div>
    <div class="hero-card">
      <div>
        <p class="label">系统状态</p>
        <p class="status">{{ status }}</p>
      </div>
      <div>
        <p class="label">建议输入格式</p>
        <p class="mono">主题: 光合作用\n年级: 初二\n时长: 45分钟\n目标: 理解原理</p>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  status: {
    type: String,
    default: '准备就绪'
  }
});
</script>

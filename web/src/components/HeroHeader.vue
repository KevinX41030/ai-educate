<template>
  <header class="topbar">
    <div>
      <h1>多模态AI互动式教学智能体</h1>
      <p>企业级教学共创工作台 · 课件智能生成</p>
    </div>
    <div class="topbar-meta">
      <span class="status-pill">{{ status }}</span>
      <span class="hint-pill">示例：主题: 光合作用 / 年级: 初二 / 时长: 45分钟</span>
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

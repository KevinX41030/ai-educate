<template>
  <div class="app-shell">
    <header class="shell-header">
      <RouterLink to="/" class="shell-brand">
        <div class="shell-brand-mark">AI</div>
        <div class="shell-brand-copy">
          <strong>AI 课件制作系统</strong>
          <span>多页面教学创作工作流</span>
        </div>
      </RouterLink>

      <nav class="shell-nav">
        <RouterLink to="/" class="shell-nav-link">首页</RouterLink>
        <RouterLink to="/create" class="shell-nav-link">创建课件</RouterLink>
        <RouterLink to="/copilot" class="shell-nav-link">AI 共创</RouterLink>
        <RouterLink to="/preview" class="shell-nav-link">预览导出</RouterLink>
      </nav>

      <div class="shell-meta">
        <div class="shell-project-pill">
          <small>当前课件</small>
          <strong>{{ lessonTitle }}</strong>
          <span>{{ progressText }}</span>
        </div>
        <span class="shell-status-pill">{{ status }}</span>
      </div>
    </header>

    <main class="shell-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { RouterLink, RouterView } from 'vue-router';
import { useWorkspace } from './composables/useWorkspace';

const { initWorkspace, lessonTitle, progressText, status } = useWorkspace();

onMounted(() => {
  initWorkspace();
});
</script>

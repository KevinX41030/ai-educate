<template>
  <div class="page-grid">
    <section class="shell-card page-main-card">
      <div class="page-intro">
        <span class="panel-kicker">Create · 创建课件</span>
        <h1>先定义好这节课要讲什么</h1>
        <p>这一页只处理课程目标和结构化信息，不把聊天、预览混在一起，让输入过程更专注。</p>
      </div>

      <IntentPanel
        :fields="fields"
        :intent="intent"
        :on-submit="handleFormSubmit"
      />

      <div class="page-actions">
        <RouterLink class="button-link ghost-link" to="/">返回首页</RouterLink>
        <RouterLink class="button-link primary-link" to="/copilot">下一步：AI 共创</RouterLink>
      </div>
    </section>

    <WorkspaceSidebar />
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import IntentPanel from '../components/IntentPanel.vue';
import WorkspaceSidebar from '../components/WorkspaceSidebar.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { fields, handleFormSubmit, intent } = useWorkspace();
</script>

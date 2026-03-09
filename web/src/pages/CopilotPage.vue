<template>
  <div class="page-grid">
    <section class="shell-card page-main-card">
      <div class="page-intro">
        <span class="panel-kicker">Copilot · AI 共创</span>
        <h1>把补充说明、资料和风格要求集中告诉 AI</h1>
        <p>这里专门负责连续对话和资料上传，让助手像真正的协作对象，而不是表单附属功能。</p>
      </div>

      <ChatPanel
        :messages="messages"
        :files="files"
        :on-send="handleSend"
        :on-clear="handleClear"
        :on-upload="handleUpload"
      />

      <div class="page-actions">
        <RouterLink class="button-link ghost-link" to="/create">返回创建页</RouterLink>
        <RouterLink class="button-link primary-link" to="/preview">下一步：查看预览</RouterLink>
      </div>
    </section>

    <WorkspaceSidebar />
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import ChatPanel from '../components/ChatPanel.vue';
import WorkspaceSidebar from '../components/WorkspaceSidebar.vue';
import { useWorkspace } from '../composables/useWorkspace';

const { files, handleClear, handleSend, handleUpload, messages } = useWorkspace();
</script>

<template>
  <section class="workspace-page">
    <aside class="workspace-pane workspace-info-pane shell-card">
      <CourseInfoPanel
        :fields="fields"
        :summary="summary"
        :files="files"
        :missing-field-labels="missingFieldLabels"
        :draft="draft"
        :export-label="exportLabel"
        :on-reset="handleClear"
        :on-export="handleExport"
      />
    </aside>

    <section class="workspace-pane workspace-chat-pane shell-card">
      <WorkspaceChatPanel
        :messages="messages"
        :busy="isBusy || isAutoGenerating"
        :on-send="handleSend"
        :on-upload="handleUpload"
      />
    </section>
  </section>
</template>

<script setup>
import { onMounted } from 'vue';
import CourseInfoPanel from '../components/CourseInfoPanel.vue';
import WorkspaceChatPanel from '../components/WorkspaceChatPanel.vue';
import { useWorkspace } from '../composables/useWorkspace';

const {
  draft,
  exportLabel,
  fields,
  files,
  handleClear,
  handleExport,
  handleSend,
  handleUpload,
  initWorkspace,
  isAutoGenerating,
  isBusy,
  messages,
  missingFieldLabels,
  summary
} = useWorkspace();

onMounted(() => {
  initWorkspace();
});
</script>

<style scoped>
.workspace-page {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.workspace-pane {
  padding: 22px;
  border-radius: 16px;
}

.workspace-chat-pane {
  min-height: calc(100vh - 40px);
}

.workspace-info-pane {
  position: sticky;
  top: 20px;
}

@media (max-width: 1380px) {
  .workspace-page {
    grid-template-columns: 292px minmax(0, 1fr);
  }
}

@media (max-width: 1180px) {
  .workspace-page {
    grid-template-columns: 1fr;
  }

  .workspace-info-pane {
    position: static;
  }
}
</style>

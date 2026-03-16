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
        :on-refresh-preview="handleRegenerateScene"
        :on-export="handleExport"
      />
    </aside>

    <section class="workspace-pane workspace-chat-pane shell-card">
      <WorkspaceChatPanel
        :messages="messages"
        :busy="isBusy || isAutoGenerating"
        :phase="workspacePhase"
        :on-send="handleSend"
        :on-upload="handleUpload"
      />
    </section>

    <aside class="workspace-pane workspace-preview-pane shell-card">
      <LivePreviewPanel
        :draft="draft"
        :scene="scene"
        :scene-status="sceneStatus"
        :fields="fields"
      />
    </aside>
  </section>
</template>

<script setup>
import { onMounted } from 'vue';
import CourseInfoPanel from '../components/CourseInfoPanel.vue';
import LivePreviewPanel from '../components/LivePreviewPanel.vue';
import WorkspaceChatPanel from '../components/WorkspaceChatPanel.vue';
import { useWorkspace } from '../composables/useWorkspace';

const {
  draft,
  exportLabel,
  fields,
  files,
  handleClear,
  handleExport,
  handleRegenerateScene,
  handleSend,
  handleUpload,
  initWorkspace,
  isAutoGenerating,
  isBusy,
  messages,
  missingFieldLabels,
  scene,
  sceneStatus,
  summary,
  workspacePhase
} = useWorkspace();

onMounted(() => {
  initWorkspace();
});
</script>

<style scoped>
.workspace-page {
  display: grid;
  grid-template-columns: 272px minmax(0, 1.28fr) 420px;
  gap: 18px;
  align-items: start;
}

.workspace-pane {
  padding: 22px;
  border-radius: 20px;
}

.workspace-chat-pane {
  min-height: calc(100vh - 40px);
}

.workspace-info-pane,
.workspace-preview-pane {
  position: sticky;
  top: 20px;
}

@media (max-width: 1380px) {
  .workspace-page {
    grid-template-columns: 248px minmax(0, 1.2fr) 380px;
  }
}

@media (max-width: 1180px) {
  .workspace-page {
    grid-template-columns: 1fr;
  }

  .workspace-info-pane,
  .workspace-preview-pane {
    position: static;
  }
}
</style>

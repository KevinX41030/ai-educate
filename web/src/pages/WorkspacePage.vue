<template>
  <section class="workspace-page">
    <aside class="workspace-pane workspace-info-pane shell-card">
      <CourseInfoPanel
        :fields="fields"
        :summary="summary"
        :files="files"
        :draft="draft"
        :export-label="exportLabel"
        :can-generate="canGeneratePpt"
        :generate-label="draft ? '查看PPT' : '生成PPT'"
        :on-reset="handleClear"
        :on-generate="handleGenerate"
        :on-update-field="handleFieldChange"
      />
    </aside>

    <section class="workspace-chat-pane">
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
import { onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import CourseInfoPanel from '../components/CourseInfoPanel.vue';
import WorkspaceChatPanel from '../components/WorkspaceChatPanel.vue';
import { useWorkspace } from '../composables/useWorkspace';

const route = useRoute();
const router = useRouter();
let initialPromptHandled = false;

const {
  canGeneratePpt,
  draft,
  exportLabel,
  fields,
  files,
  handleClear,
  handleConfirm,
  handleFieldChange,
  handleSend,
  handleUpload,
  initWorkspace,
  isAutoGenerating,
  isBusy,
  messages,
  startFromPrompt,
  syncFields,
  summary
} = useWorkspace();

const handleGenerate = async () => {
  await syncFields();
  if (draft.value) {
    await router.push({ name: 'ppt-live' });
    return;
  }
  await router.push({ name: 'ppt-live', query: { autostart: '1' } });
};

onMounted(() => {
  initWorkspace();
});

watch(
  () => route.query.prompt,
  async (value) => {
    const prompt = `${Array.isArray(value) ? value[0] || '' : value || ''}`.trim();
    if (!prompt || initialPromptHandled) return;
    initialPromptHandled = true;
    await startFromPrompt(prompt);
    await router.replace({ name: 'workspace' });
  },
  { immediate: true }
);
</script>

<style scoped>
.workspace-page {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  min-height: 100vh;
}

.workspace-pane {
  padding: 20px;
  border-radius: 14px;
}

.workspace-chat-pane {
  display: flex;
  justify-content: center;
  min-height: 0;
  height: 100vh;
  overflow: hidden;
  padding: 20px 24px 20px 20px;
}

.workspace-info-pane {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  max-height: 100vh;
  padding: 24px 20px;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: none;
}

@media (max-width: 1380px) {
  .workspace-page {
    grid-template-columns: 332px minmax(0, 1fr);
  }
}

@media (max-width: 1180px) {
  .workspace-page {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .workspace-chat-pane,
  .workspace-info-pane {
    position: static;
    max-height: none;
    height: auto;
    overflow: visible;
  }

  .workspace-chat-pane {
    padding: 16px;
  }

  .workspace-info-pane {
    border-radius: 0;
    border-left: 1px solid rgba(40, 49, 78, 0.08);
  }
}
</style>

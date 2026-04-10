<template>
  <div class="page-grid preview-page-grid">
    <section class="shell-card page-main-card preview-main-card">
      <div class="page-intro">
        <span class="panel-kicker">Preview · 课件预览</span>
        <h1>在一个独立页面里专心看结果</h1>
        <p>这一页只保留预览、确认生成、预览刷新和导出，避免与输入过程互相干扰。</p>
      </div>

      <PreviewPanel
        :summary="summary"
        :classroom="displayClassroom"
        :draft="displayDraft"
        :scene="displayScene"
        :preview-status="displaySceneStatus"
        :intent="intent"
        :rag="rag"
        :fields="fields"
        :files="files"
        :can-export="Boolean(draft || classroom)"
        :on-confirm="handleConfirm"
        :generation-state="generationState"
        :on-resume-generation="handleResumeGeneration"
        :on-export="handleExport"
        :on-export-docx="handleExportDocx"
        :export-label="exportLabel"
        :on-regenerate-scene="handleRegenerateScene"
      />

      <div class="page-actions">
        <RouterLink class="button-link ghost-link" to="/copilot">返回共创页</RouterLink>
        <RouterLink class="button-link secondary-link" to="/create">修改需求</RouterLink>
      </div>
    </section>

    <WorkspaceSidebar />
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router';
import PreviewPanel from '../components/PreviewPanel.vue';
import WorkspaceSidebar from '../components/WorkspaceSidebar.vue';
import { useWorkspace } from '../composables/useWorkspace';

const {
  classroom,
  displayClassroom,
  displayDraft,
  displayScene,
  displaySceneStatus,
  draft,
  exportLabel,
  fields,
  files,
  handleConfirm,
  handleResumeGeneration,
  handleExport,
  handleExportDocx,
  handleRegenerateScene,
  intent,
  generationState,
  rag,
  scene,
  sceneStatus,
  summary
} = useWorkspace();
</script>

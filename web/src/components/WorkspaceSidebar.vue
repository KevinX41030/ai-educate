<template>
  <aside class="workspace-sidebar">
    <div class="sidebar-card">
      <span class="panel-kicker">当前进度</span>
      <h3>{{ activeStepLabel }}</h3>
      <p>{{ activeStep.description }}</p>
      <div class="sidebar-progress-bar">
        <span :style="{ width: `${progressPercent}%` }"></span>
      </div>
      <small>{{ progressText }}</small>
    </div>

    <div class="sidebar-card">
      <div class="sidebar-title">页面导航</div>
      <RouterLink
        v-for="step in stepItems"
        :key="`${step.id}-${step.index}`"
        :to="step.path"
        class="sidebar-route"
        :class="{ active: isStepActive(step), done: step.done }"
      >
        <span class="sidebar-route-index">{{ step.index }}</span>
        <span class="sidebar-route-copy">
          <strong>{{ step.label }}</strong>
          <small>{{ step.description }}</small>
        </span>
      </RouterLink>
    </div>

    <div class="sidebar-card">
      <div class="sidebar-title">课程摘要</div>
      <div class="sidebar-brief-list">
        <div class="sidebar-brief-item">
          <span>主题</span>
          <strong>{{ fields.subject || '待填写' }}</strong>
        </div>
        <div class="sidebar-brief-item">
          <span>年级</span>
          <strong>{{ fields.grade || '待填写' }}</strong>
        </div>
        <div class="sidebar-brief-item">
          <span>课时</span>
          <strong>{{ fields.duration || '待填写' }}</strong>
        </div>
        <div class="sidebar-brief-item">
          <span>知识点</span>
          <strong>{{ keyPointPreview }}</strong>
        </div>
      </div>
      <div v-if="missingFieldLabels.length" class="sidebar-missing-tags">
        <span v-for="label in missingFieldLabels" :key="label">{{ label }}</span>
      </div>
    </div>

    <div class="sidebar-card">
      <div class="sidebar-title">快速操作</div>
      <div class="sidebar-actions">
        <button class="ghost" type="button" @click="handleClear">重新开始</button>
        <RouterLink class="button-link secondary-link" to="/copilot">继续共创</RouterLink>
        <RouterLink class="button-link primary-link" to="/preview">查看预览</RouterLink>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { useWorkspace } from '../composables/useWorkspace';

const route = useRoute();
const {
  activeStep,
  activeStepLabel,
  draft,
  fields,
  handleClear,
  keyPointPreview,
  missingFieldLabels,
  progressPercent,
  progressText,
  stepItems
} = useWorkspace();

const routeStepId = computed(() => {
  if (activeStep.value?.path === route.path) return activeStep.value.id;
  if (route.path === '/create') return 'basics';
  if (route.path === '/copilot') return 'copilot';
  if (route.path === '/preview') return draft.value ? 'preview' : 'confirm';
  return 'basics';
});

const isStepActive = (step) => {
  return routeStepId.value === step.id;
};
</script>

<style scoped>
.workspace-sidebar {
  display: grid;
  gap: 16px;
}

.sidebar-card {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.64);
  box-shadow: var(--shadow-soft);
  backdrop-filter: blur(24px);
}

.sidebar-card h3 {
  margin: 0;
  font-size: 24px;
}

.sidebar-card p,
.sidebar-card small {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--muted);
}

.sidebar-progress-bar {
  height: 10px;
  border-radius: 999px;
  background: rgba(91, 108, 255, 0.08);
  overflow: hidden;
}

.sidebar-progress-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
}

.sidebar-route {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  border-radius: 18px;
  color: inherit;
  text-decoration: none;
  background: #ffffff;
  border: 1px solid transparent;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.sidebar-route:hover {
  transform: translateY(-1px);
  border-color: rgba(91, 108, 255, 0.18);
}

.sidebar-route.active {
  background: rgba(91, 108, 255, 0.08);
  border-color: rgba(91, 108, 255, 0.28);
}

.sidebar-route.done {
  background: rgba(36, 200, 165, 0.08);
}

.sidebar-route-index {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: rgba(91, 108, 255, 0.1);
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 800;
}

.sidebar-route-copy {
  display: grid;
  gap: 5px;
}

.sidebar-route-copy strong {
  font-size: 14px;
}

.sidebar-route-copy small {
  font-size: 12px;
}

.sidebar-brief-list {
  display: grid;
  gap: 10px;
}

.sidebar-brief-item {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(91, 108, 255, 0.06);
}

.sidebar-brief-item span {
  color: var(--muted);
  font-size: 12px;
}

.sidebar-brief-item strong {
  line-height: 1.5;
}

.sidebar-missing-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sidebar-missing-tags span {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 184, 77, 0.14);
  color: #a25b00;
  font-size: 12px;
  font-weight: 700;
}

.sidebar-actions {
  display: grid;
  gap: 10px;
}
</style>

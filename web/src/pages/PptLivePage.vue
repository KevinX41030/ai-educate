<template>
  <section class="ppt-live-page">
    <aside class="ppt-live-sidebar shell-card">
      <div class="ppt-live-intro">
        <span class="panel-kicker">生成页</span>
        <h1>{{ draft ? 'PPT 已生成' : '正在生成 PPT' }}</h1>
        <p>{{ pageDescription }}</p>
      </div>

      <div class="ppt-live-status-card">
        <div class="ppt-live-status-row">
          <span>当前状态</span>
          <strong>{{ stageStatusText }}</strong>
        </div>
        <div class="ppt-live-status-grid">
          <div>
            <span>页面数量</span>
            <strong>{{ slideCount }} 页</strong>
          </div>
          <div>
            <span>资料数量</span>
            <strong>{{ files.length }} 份</strong>
          </div>
        </div>
        <p>{{ summarySnippet }}</p>
      </div>

      <div v-if="recognizedFields.length" class="ppt-live-fields-card">
        <span class="ppt-live-label">课程信息</span>
        <div class="ppt-live-fields-list">
          <div v-for="item in recognizedFields" :key="item.label" class="ppt-live-field-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>

      <div class="ppt-live-actions">
        <button class="ghost" type="button" @click="goBack">返回整理页</button>
        <button class="primary" type="button" :disabled="!draft" @click="handleExport">
          导出 PPT
        </button>
      </div>

      <label v-if="draft" class="ppt-live-section">
        <span class="ppt-live-label">继续调整</span>
        <textarea
          v-model="followup"
          rows="4"
          placeholder="继续补充课堂风格、页面重点或要调整的内容。"
          @keydown.enter.exact.prevent="handleFollowup"
        ></textarea>
      </label>

      <button v-if="draft" class="secondary" type="button" :disabled="!canFollowup" @click="handleFollowup">
        调整当前 PPT
      </button>

      <div class="ppt-live-feed">
        <div class="ppt-live-feed-head">
          <span class="ppt-live-label">处理记录</span>
          <strong>{{ recentMessages.length }} 条</strong>
        </div>
        <div class="ppt-live-feed-list">
          <article
            v-for="(message, index) in recentMessages"
            :key="message.id || `${message.role}-${index}`"
            class="ppt-live-feed-item"
            :class="message.role"
          >
            <span>{{ message.role === 'user' ? '你' : 'AI' }}</span>
            <p>{{ message.text }}</p>
          </article>
        </div>
      </div>
    </aside>

    <section class="ppt-live-stage shell-card">
      <div class="ppt-live-stage-head">
        <div>
          <span class="panel-kicker">实时预览</span>
          <h2>{{ stageTitle }}</h2>
        </div>
        <div class="ppt-live-stage-meta">
          <strong>{{ slideCount }} 页</strong>
          <span>{{ stageStatusText }}</span>
        </div>
      </div>

      <div v-if="showEmptyState" class="ppt-live-empty">
        <strong>请先在整理页完成需求整理，再点击“生成PPT”。</strong>
        <p>生成页只负责展示 PPT 生成过程和最终预览，不负责整理课程需求。</p>
        <button class="primary" type="button" @click="goBack">返回整理页</button>
      </div>

      <LivePreviewPanel v-else :draft="draft" :scene="scene" :scene-status="sceneStatus" :fields="fields" />
    </section>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import LivePreviewPanel from '../components/LivePreviewPanel.vue';
import { useWorkspace } from '../composables/useWorkspace';

const route = useRoute();
const router = useRouter();
const followup = ref('');
const autostartHandled = ref(false);

const {
  draft,
  fields,
  files,
  handleConfirm,
  handleExport,
  handleSend,
  initWorkspace,
  isAutoGenerating,
  isBusy,
  messages,
  scene,
  sceneStatus,
  summary,
  intent,
  workspacePhase
} = useWorkspace();

initWorkspace();

const slideCount = computed(() => scene.value?.slides?.length || draft.value?.ppt?.length || 0);
const canFollowup = computed(() => followup.value.trim().length > 0 && !isBusy.value && !isAutoGenerating.value);
const showEmptyState = computed(() => !draft.value && !intent.value?.ready && !isBusy.value && !isAutoGenerating.value);
const stageTitle = computed(() => fields.value.subject || 'PPT 页面生成中');
const pageDescription = computed(() => {
  if (showEmptyState.value) return '请先返回整理页，把需求整理完整后再发起生成。';
  if (draft.value) return '当前页面用于查看生成中的 PPT 页面，以及生成完成后的最终预览。';
  return '正在根据整理页中的课程信息生成 PPT，请稍候。';
});
const stageStatusText = computed(() => {
  if (isAutoGenerating.value || isBusy.value) return '正在生成 PPT';
  if (sceneStatus.value === 'generating') return '正在补全页面';
  if (draft.value) return 'PPT 已生成';
  return workspacePhase.value;
});
const summarySnippet = computed(() => {
  if (!summary.value || summary.value === '暂无') return '生成前会在这里显示当前课程摘要。';
  return summary.value.split('\n').slice(0, 3).join(' · ');
});
const recentMessages = computed(() => messages.value.slice(-6));
const recognizedFields = computed(() => {
  const items = [
    { label: '主题', value: fields.value.subject },
    { label: '年级', value: fields.value.grade },
    { label: '时长', value: fields.value.duration },
    { label: '目标', value: fields.value.goals },
    {
      label: '知识点',
      value: Array.isArray(fields.value.keyPoints) ? fields.value.keyPoints.join('、') : fields.value.keyPoints
    }
  ];

  return items.filter((item) => `${item.value || ''}`.trim());
});

const handleFollowup = async () => {
  const text = followup.value.trim();
  if (!text || isBusy.value || isAutoGenerating.value) return;
  followup.value = '';
  await handleSend(text, { autoGenerate: false });
};

const goBack = async () => {
  await router.push({ name: 'workspace' });
};

watch(
  () => [route.query.autostart, intent.value?.ready, Boolean(draft.value), isBusy.value],
  async ([autostart, ready, hasDraft, busy]) => {
    if (autostart !== '1' || autostartHandled.value || !ready || hasDraft || busy) return;
    autostartHandled.value = true;
    await handleConfirm();
    await router.replace({ name: 'ppt-live' });
  },
  { immediate: true }
);
</script>

<style scoped>
.ppt-live-page {
  display: grid;
  grid-template-columns: 372px minmax(0, 1fr);
  gap: 20px;
  min-height: calc(100vh - 68px);
}

.ppt-live-sidebar,
.ppt-live-stage {
  display: grid;
  align-content: start;
  gap: 16px;
  border-radius: 14px;
}

.ppt-live-sidebar {
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 40px);
  overflow: hidden;
}

.ppt-live-intro {
  display: grid;
  gap: 8px;
}

.ppt-live-intro h1,
.ppt-live-stage-head h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
}

.ppt-live-intro p {
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

.ppt-live-section,
.ppt-live-status-card,
.ppt-live-fields-card,
.ppt-live-feed,
.ppt-live-empty {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid rgba(40, 49, 78, 0.08);
  background: rgba(255, 255, 255, 0.78);
}

.ppt-live-label {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.ppt-live-section textarea {
  min-height: 0;
  resize: none;
  font-size: 14px;
  line-height: 1.6;
}

.ppt-live-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.ppt-live-status-row,
.ppt-live-feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ppt-live-status-row span,
.ppt-live-status-grid span,
.ppt-live-field-item span,
.ppt-live-feed-head strong {
  color: var(--muted);
  font-size: 12px;
}

.ppt-live-status-row strong,
.ppt-live-status-grid strong,
.ppt-live-field-item strong,
.ppt-live-stage-meta strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}

.ppt-live-status-grid,
.ppt-live-fields-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ppt-live-status-grid div,
.ppt-live-field-item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(247, 247, 248, 0.92);
}

.ppt-live-status-card p,
.ppt-live-empty p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.6;
}

.ppt-live-feed {
  min-height: 0;
  overflow: hidden;
}

.ppt-live-feed-list {
  min-height: 0;
  max-height: 240px;
  overflow-y: auto;
  display: grid;
  gap: 10px;
}

.ppt-live-feed-item {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(247, 247, 248, 0.92);
}

.ppt-live-feed-item.user {
  background: rgba(161, 254, 239, 0.2);
}

.ppt-live-feed-item span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.ppt-live-feed-item p,
.ppt-live-empty strong {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}

.ppt-live-stage {
  min-height: calc(100vh - 40px);
}

.ppt-live-stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ppt-live-stage-meta {
  display: grid;
  gap: 4px;
  justify-items: end;
}

.ppt-live-stage-meta span {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 1180px) {
  .ppt-live-page {
    grid-template-columns: 1fr;
  }

  .ppt-live-sidebar {
    position: static;
    max-height: none;
  }

  .ppt-live-stage {
    min-height: auto;
  }
}

@media (max-width: 720px) {
  .ppt-live-status-grid,
  .ppt-live-fields-list,
  .ppt-live-actions {
    grid-template-columns: 1fr;
  }

  .ppt-live-stage-head,
  .ppt-live-feed-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

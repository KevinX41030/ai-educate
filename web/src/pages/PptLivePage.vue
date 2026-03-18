<template>
  <section class="ppt-live-page">
    <aside class="ppt-live-sidebar shell-card">
      <div class="ppt-live-intro">
        <span class="panel-kicker">PPT 直出页</span>
        <h1>直接生成 PPT</h1>
        <p>输入完整课程需求后，右侧会直接显示 PPT 页面生成结果。这个页面先用于看整体交互效果。</p>
      </div>

      <label class="ppt-live-section">
        <span class="ppt-live-label">课程需求</span>
        <textarea
          v-model="prompt"
          rows="8"
          placeholder="例如：帮我生成一份五年级《分数的意义》40 分钟数学课 PPT，需要生活导入、概念讲解、课堂练习、互动提问和结尾总结。"
          @keydown.meta.enter.prevent="handleStart"
          @keydown.ctrl.enter.prevent="handleStart"
        ></textarea>
      </label>

      <div class="ppt-live-actions">
        <button class="primary" type="button" :disabled="!canStart" @click="handleStart">
          {{ draft ? '重新生成 PPT' : '生成 PPT' }}
        </button>
        <button class="ghost" type="button" :disabled="!draft" @click="handleExport">
          导出 PPT
        </button>
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
        <span class="ppt-live-label">已识别课程信息</span>
        <div class="ppt-live-fields-list">
          <div v-for="item in recognizedFields" :key="item.label" class="ppt-live-field-item">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>

      <label class="ppt-live-section ppt-live-section--followup">
        <span class="ppt-live-label">继续补充</span>
        <textarea
          v-model="followup"
          rows="4"
          placeholder="继续补充学生特点、课堂风格、重点页要怎么讲，PPT 会继续调整。"
          @keydown.enter.exact.prevent="handleFollowup"
        ></textarea>
      </label>

      <button class="secondary" type="button" :disabled="!canFollowup" @click="handleFollowup">
        继续调整当前 PPT
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
          <span class="panel-kicker">实时生成</span>
          <h2>{{ stageTitle }}</h2>
        </div>
        <div class="ppt-live-stage-meta">
          <strong>{{ slideCount }} 页</strong>
          <span>{{ stageStatusText }}</span>
        </div>
      </div>

      <LivePreviewPanel :draft="draft" :scene="scene" :scene-status="sceneStatus" :fields="fields" />
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

const prompt = ref('');
const followup = ref('');
const lastAutoPrompt = ref('');

const {
  draft,
  fields,
  files,
  handleExport,
  handleSend,
  isAutoGenerating,
  isBusy,
  messages,
  scene,
  sceneStatus,
  startFromPrompt,
  summary,
  workspacePhase
} = useWorkspace();

const normalizeQueryPrompt = (value) => {
  if (Array.isArray(value)) return `${value[0] || ''}`;
  return `${value || ''}`;
};

const slideCount = computed(() => scene.value?.slides?.length || draft.value?.ppt?.length || 0);
const canStart = computed(() => prompt.value.trim().length > 0 && !isBusy.value && !isAutoGenerating.value);
const canFollowup = computed(
  () => followup.value.trim().length > 0 && messages.value.length > 0 && !isBusy.value && !isAutoGenerating.value
);
const stageTitle = computed(() => {
  if (fields.value.subject) return fields.value.subject;
  if (prompt.value.trim()) return prompt.value.trim().slice(0, 28);
  return 'PPT 页面生成中';
});
const stageStatusText = computed(() => {
  if (isAutoGenerating.value) return '正在生成 PPT';
  if (isBusy.value) return '正在整理需求';
  if (sceneStatus.value === 'generating') return '正在补全页面';
  if (slideCount.value) return 'PPT 已生成';
  return workspacePhase.value;
});
const summarySnippet = computed(() => {
  if (!summary.value || summary.value === '暂无') return '先输入完整课程需求，系统会先识别课程信息，再直接生成 PPT 页面。';
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

const handleStart = async () => {
  const text = prompt.value.trim();
  if (!text || isBusy.value || isAutoGenerating.value) return;
  await startFromPrompt(text);
  if (normalizeQueryPrompt(route.query.prompt)) {
    await router.replace({ name: 'ppt-live' });
  }
};

const handleFollowup = async () => {
  const text = followup.value.trim();
  if (!text || !messages.value.length || isBusy.value || isAutoGenerating.value) return;
  followup.value = '';
  await handleSend(text, { autoGenerate: true });
};

watch(
  () => route.query.prompt,
  (value) => {
    const nextPrompt = normalizeQueryPrompt(value).trim();
    if (!nextPrompt) return;
    prompt.value = nextPrompt;
    if (lastAutoPrompt.value === nextPrompt) return;
    lastAutoPrompt.value = nextPrompt;
    void handleStart();
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
.ppt-live-feed {
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
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.ppt-live-status-card {
  gap: 12px;
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

.ppt-live-status-card p {
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

.ppt-live-feed-item p {
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

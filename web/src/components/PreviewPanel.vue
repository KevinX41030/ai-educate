<template>
  <section class="preview-panel">
    <div class="preview-hero">
      <div class="preview-hero-copy">
        <span class="panel-kicker">Step 3 · 成果画布</span>
        <h2>{{ fields.subject || '课件预览' }}</h2>
        <p>{{ previewSubtitle }}</p>

        <div class="summary-chip-row">
          <div v-for="item in summaryChips" :key="item.label" class="summary-chip">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
        </div>
      </div>

      <div class="preview-hero-actions">
        <div class="hero-tools">
          <button class="secondary" type="button" :disabled="!draft" @click="handleRegenerateScene">重新排版</button>
          <button class="primary" type="button" @click="handleExport">{{ exportLabel }}</button>
        </div>
      </div>
    </div>

    <div class="confirm-banner" :class="confirmTone">
      <div class="confirm-copy">
        <strong>{{ confirmTitle }}</strong>
        <p>{{ confirmDescription }}</p>
        <div v-if="missingFields.length" class="missing-tags">
          <span v-for="label in missingFields" :key="label">{{ label }}</span>
        </div>
      </div>

      <button
        v-if="!intent?.confirmed"
        class="primary"
        type="button"
        :disabled="!canConfirm"
        @click="handleConfirm"
      >
        确认生成
      </button>
    </div>

    <div class="summary-snippet">
      <span>需求摘要</span>
      <p>{{ summaryExcerpt }}</p>
    </div>

    <div class="preview-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        :class="['preview-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="activeTab === 'slides'" class="tab-surface">
      <div v-if="!displaySlides.length" class="empty-state">
        <div class="empty-icon">✦</div>
        <strong>确认需求后，这里会自动生成课件页面</strong>
        <p>右侧预览区会保持固定，不需要在多个区域来回滚动查找结果。</p>
      </div>

      <template v-else>
        <div class="thumbnail-strip">
          <button
            v-for="(slide, index) in displaySlides"
            :key="slide.id || index"
            type="button"
            :class="['thumbnail-card', { active: selectedSlideIndex === index }]"
            @click="selectedSlideIndex = index"
          >
            <span class="thumbnail-index">{{ index + 1 }}</span>
            <strong>{{ slide.title }}</strong>
            <small>{{ slidePreviewText(slide) }}</small>
          </button>
        </div>

        <div class="stage-card">
          <div class="stage-head">
            <div>
              <span class="stage-kicker">第 {{ selectedSlideIndex + 1 }} 页</span>
              <h3>{{ selectedSlide?.title || '未命名页面' }}</h3>
            </div>
            <span class="scene-status">{{ sceneStatusText }}</span>
          </div>

          <div class="stage-surface">
            <SceneSlideCard v-if="selectedSceneSlide" :slide="selectedSceneSlide" :index="selectedSlideIndex" />

            <article v-else class="fallback-stage">
              <h4>{{ selectedFallbackSlide?.title }}</h4>
              <ul v-if="selectedFallbackSlide?.bullets?.length">
                <li v-for="(bullet, bulletIndex) in selectedFallbackSlide.bullets" :key="bulletIndex">{{ bullet }}</li>
              </ul>
              <p v-else class="muted">该页内容生成中，稍后会显示更完整的版式结构。</p>
            </article>
          </div>
        </div>
      </template>
    </div>

    <div v-else-if="activeTab === 'plan'" class="tab-surface tab-grid">
      <div class="info-card">
        <span>教学目标</span>
        <strong>{{ lessonPlan?.goals || '待生成' }}</strong>
      </div>
      <div class="info-card">
        <span>教学方法</span>
        <strong>{{ lessonPlan?.methods || '待生成' }}</strong>
      </div>
      <div class="info-card info-card-full">
        <span>教学过程</span>
        <strong>{{ lessonPlan?.process?.join('；') || '待生成' }}</strong>
      </div>
      <div class="info-card">
        <span>课堂活动</span>
        <strong>{{ lessonPlan?.activities || '待生成' }}</strong>
      </div>
      <div class="info-card">
        <span>课后作业</span>
        <strong>{{ lessonPlan?.homework || '待生成' }}</strong>
      </div>
    </div>

    <div v-else-if="activeTab === 'interaction'" class="tab-surface">
      <div class="interaction-card">
        <strong>{{ interactionIdea?.title || '待生成互动设计' }}</strong>
        <p>
          {{ interactionIdea?.description || '先在左侧补充课堂风格或互动偏好，系统会把互动环节同步到教案与页面预览中。' }}
        </p>
        <div class="missing-tags" v-if="interactionTokens.length">
          <span v-for="token in interactionTokens" :key="token">{{ token }}</span>
        </div>
        <small v-if="updatedAt">更新时间：{{ formatTime(updatedAt) }}</small>
      </div>
    </div>

    <div v-else class="tab-surface knowledge-list">
      <p v-if="!rag.length" class="muted">暂无知识库引用，后续生成时会自动把命中的参考内容带入页面与教案。</p>
      <div v-for="item in rag" :key="item.id" class="knowledge-card">
        <div class="knowledge-meta">{{ item.source }} · score {{ item.score }}</div>
        <p>{{ item.content }}</p>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import SceneSlideCard from './SceneSlideCard.vue';

const props = defineProps({
  summary: {
    type: String,
    default: ''
  },
  draft: {
    type: Object,
    default: null
  },
  scene: {
    type: Object,
    default: null
  },
  sceneStatus: {
    type: String,
    default: 'idle'
  },
  intent: {
    type: Object,
    default: null
  },
  rag: {
    type: Array,
    default: () => []
  },
  fields: {
    type: Object,
    default: () => ({})
  },
  files: {
    type: Array,
    default: () => []
  },
  onConfirm: {
    type: Function,
    default: null
  },
  onExport: {
    type: Function,
    default: null
  },
  exportLabel: {
    type: String,
    default: '导出PPT'
  },
  onRegenerateScene: {
    type: Function,
    default: null
  }
});

const FIELD_LABELS = {
  subject: '主题/章节',
  grade: '年级/学段',
  duration: '课堂时长',
  goals: '教学目标',
  keyPoints: '核心知识点',
  style: '教学风格',
  interactions: '互动设计'
};

const tabs = [
  { id: 'slides', label: '课件预览' },
  { id: 'plan', label: '教案草稿' },
  { id: 'interaction', label: '互动设计' },
  { id: 'rag', label: '知识引用' }
];

const activeTab = ref('slides');
const selectedSlideIndex = ref(0);

const toList = (value) => {
  if (Array.isArray(value)) return value.map((item) => `${item}`.trim()).filter(Boolean);
  return `${value || ''}`
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const sceneSlides = computed(() => props.scene?.slides ?? []);
const fallbackSlides = computed(() => (sceneSlides.value.length ? [] : (props.draft?.ppt ?? [])));
const displaySlides = computed(() => (sceneSlides.value.length ? sceneSlides.value : fallbackSlides.value));
const selectedSlide = computed(() => displaySlides.value[selectedSlideIndex.value] || null);
const selectedSceneSlide = computed(() => sceneSlides.value[selectedSlideIndex.value] || null);
const selectedFallbackSlide = computed(() => fallbackSlides.value[selectedSlideIndex.value] || null);
const lessonPlan = computed(() => props.draft?.lessonPlan || null);
const interactionIdea = computed(() => props.draft?.interactionIdea || null);
const updatedAt = computed(() => props.draft?.updatedAt || null);
const interactionTokens = computed(() => toList(props.fields?.interactions));
const missingFields = computed(() =>
  (props.intent?.missingFields || []).map((field) => FIELD_LABELS[field] || field)
);
const canConfirm = computed(() => props.intent && props.intent.ready && !props.intent.confirmed);
const previewSubtitle = computed(() => {
  if (props.fields?.goals) return props.fields.goals;
  return '左侧输入越清晰，右侧预览越接近最终可导出的课件成果。';
});
const summaryExcerpt = computed(() => {
  if (!props.summary || props.summary === '暂无') return '还没有生成结构化摘要，先在左侧填写基础信息并与 AI 对话。';
  const lines = props.summary.split('\n').slice(0, 3);
  return lines.join(' · ');
});
const summaryChips = computed(() => [
  { label: '年级', value: props.fields?.grade || '待补充' },
  { label: '课时', value: props.fields?.duration || '待补充' },
  { label: '资料', value: props.files?.length ? `${props.files.length} 份` : '未上传' },
  { label: '页数', value: displaySlides.value.length ? `${displaySlides.value.length} 页` : '未生成' }
]);
const confirmTone = computed(() => {
  if (props.intent?.confirmed) return 'success';
  if (missingFields.value.length) return 'warn';
  return 'info';
});
const confirmTitle = computed(() => {
  if (props.intent?.confirmed) return '需求已确认，课件可继续预览与导出';
  if (missingFields.value.length) return '还有少量信息待补全';
  return '信息已齐，可以确认生成课件';
});
const confirmDescription = computed(() => {
  if (props.intent?.confirmed) return '如果还想微调页面结构，可以先重新排版，再导出 PPT。';
  if (missingFields.value.length) return '建议先补全关键字段，让页面结构、互动安排和教案内容更加稳定。';
  return '点击确认后，系统会基于当前信息生成更完整的课件草稿。';
});
const sceneStatusText = computed(() => {
  if (props.sceneStatus === 'stale') return '当前是基础草稿，可点击“重新排版”生成增强版式';
  if (props.sceneStatus === 'generating') return '正在生成增强版式';
  if (props.sceneStatus === 'ready') return '增强版式已就绪';
  return '当前使用基础预览';
});

watch(
  () => displaySlides.value.length,
  (length) => {
    if (!length) {
      selectedSlideIndex.value = 0;
      return;
    }
    if (selectedSlideIndex.value >= length) {
      selectedSlideIndex.value = 0;
    }
  },
  { immediate: true }
);

watch(
  () => props.draft,
  (value) => {
    if (value) activeTab.value = 'slides';
  }
);

const slidePreviewText = (slide) => {
  if (slide?.blocks?.length) {
    const firstTextBlock = slide.blocks.find((block) => block.text) || slide.blocks.find((block) => block.items?.length);
    if (firstTextBlock?.text) return firstTextBlock.text.slice(0, 22);
    if (firstTextBlock?.items?.length) return firstTextBlock.items[0].slice(0, 22);
  }

  if (slide?.bullets?.length) return slide.bullets[0].slice(0, 22);
  return '等待内容填充';
};

const formatTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString();
};

const handleExport = () => {
  if (props.onExport) {
    props.onExport();
    return;
  }
  if (!props.draft) {
    window.alert('请先生成 PPT，再导出。');
    return;
  }
  window.alert('导出功能为占位，后续将生成 .pptx/.docx 文件。');
};

const handleRegenerateScene = () => {
  if (props.onRegenerateScene) props.onRegenerateScene();
};

const handleConfirm = () => {
  if (!props.onConfirm) return;
  props.onConfirm();
};
</script>

<style scoped>
.preview-panel {
  display: grid;
  gap: 18px;
}

.preview-hero {
  display: grid;
  gap: 16px;
  padding: 22px;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 255, 0.96));
  border: 1px solid var(--border);
}

.preview-hero-copy h2 {
  margin: 8px 0 8px;
  font-size: 28px;
  line-height: 1.2;
}

.preview-hero-copy p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.summary-chip-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.summary-chip {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border-radius: 18px;
  background: rgba(91, 108, 255, 0.06);
}

.summary-chip span {
  color: var(--muted);
  font-size: 12px;
}

.summary-chip strong {
  font-size: 16px;
}

.preview-hero-actions {
  display: grid;
  gap: 12px;
}

.hero-tools {
  display: flex;
  gap: 10px;
}

.hero-tools > * {
  flex: 1;
}

.confirm-banner {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 18px 20px;
  border-radius: 24px;
  border: 1px solid transparent;
}

.confirm-banner.info {
  background: rgba(91, 108, 255, 0.08);
  border-color: rgba(91, 108, 255, 0.18);
}

.confirm-banner.warn {
  background: rgba(255, 184, 77, 0.12);
  border-color: rgba(255, 184, 77, 0.22);
}

.confirm-banner.success {
  background: rgba(36, 200, 165, 0.12);
  border-color: rgba(36, 200, 165, 0.24);
}

.confirm-copy {
  display: grid;
  gap: 6px;
}

.confirm-copy strong {
  font-size: 18px;
}

.confirm-copy p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.summary-snippet {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 20px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
}

.summary-snippet span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.summary-snippet p {
  margin: 0;
  line-height: 1.7;
}

.preview-tabs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.preview-tab {
  padding: 11px 16px;
  border-radius: 999px;
  background: rgba(91, 108, 255, 0.07);
  color: var(--muted);
  box-shadow: none;
}

.preview-tab.active {
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #ffffff;
}

.tab-surface {
  display: grid;
  gap: 16px;
}

.thumbnail-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(160px, 1fr);
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.thumbnail-card {
  display: grid;
  gap: 8px;
  min-width: 160px;
  padding: 14px;
  text-align: left;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--border);
  box-shadow: none;
}

.thumbnail-card.active {
  border-color: rgba(91, 108, 255, 0.28);
  background: rgba(91, 108, 255, 0.08);
}

.thumbnail-index {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(91, 108, 255, 0.12);
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 800;
}

.thumbnail-card small {
  color: var(--muted);
  line-height: 1.5;
}

.stage-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 255, 0.96));
  border: 1px solid var(--border);
}

.stage-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.stage-kicker {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(91, 108, 255, 0.1);
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 800;
}

.stage-head h3 {
  margin: 10px 0 0;
  font-size: 22px;
}

.scene-status {
  color: var(--muted);
  font-size: 12px;
  text-align: right;
  line-height: 1.6;
}

.stage-surface {
  min-height: 280px;
}

.fallback-stage {
  display: grid;
  gap: 14px;
  min-height: 260px;
  padding: 20px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid var(--border);
}

.fallback-stage h4 {
  margin: 0;
  font-size: 20px;
}

.fallback-stage ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 10px;
  line-height: 1.7;
}

.tab-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.info-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid var(--border);
}

.info-card span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.info-card strong {
  line-height: 1.6;
}

.info-card-full {
  grid-column: span 2;
}

.interaction-card,
.knowledge-card,
.empty-state {
  display: grid;
  gap: 12px;
  padding: 20px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid var(--border);
}

.interaction-card strong,
.empty-state strong {
  font-size: 20px;
}

.interaction-card p,
.knowledge-card p,
.empty-state p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.interaction-card small {
  color: var(--muted);
}

.empty-state {
  justify-items: start;
  min-height: 240px;
}

.empty-icon {
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(91, 108, 255, 0.14), rgba(124, 77, 255, 0.16));
  color: var(--primary-strong);
  font-size: 28px;
}

.knowledge-list {
  gap: 12px;
}

.knowledge-meta {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 720px) {
  .preview-hero,
  .confirm-banner,
  .stage-head {
    gap: 14px;
  }

  .confirm-banner,
  .stage-head,
  .hero-tools {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-chip-row,
  .tab-grid {
    grid-template-columns: 1fr;
  }

  .info-card-full {
    grid-column: auto;
  }

  .thumbnail-strip {
    grid-auto-columns: 180px;
  }
}
</style>

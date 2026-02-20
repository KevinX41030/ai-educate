<template>
  <section class="panel preview">
    <div class="panel-title">
      <h2>课件预览</h2>
      <button class="secondary" @click="handleExport">导出占位</button>
    </div>

    <div class="preview-block">
      <h3>需求摘要</h3>
      <pre class="summary">{{ summary || '暂无' }}</pre>
    </div>

    <div class="preview-block">
      <h3>需求确认</h3>
      <div class="confirm-box">
        <p v-if="intent && intent.confirmed" class="confirm-status success">已确认，可生成课件。</p>
        <template v-else>
          <p v-if="missingFields.length" class="confirm-status warn">
            待补充：{{ missingFields.join('、') }}
          </p>
          <p v-else class="confirm-status">信息已齐全，请确认生成初稿。</p>
          <button class="primary" :disabled="!canConfirm" @click="handleConfirm">确认生成</button>
        </template>
      </div>
    </div>

    <div class="preview-block">
      <h3>PPT 结构草稿</h3>
      <div class="cards">
        <p v-if="!slides.length" class="muted">等待生成课件初稿。</p>
        <div v-for="(slide, index) in slides" :key="slide.id" class="card">
          <h4>{{ index + 1 }}. {{ slide.title }}</h4>
          <ul v-if="slide.bullets && slide.bullets.length">
            <li v-for="(bullet, bIndex) in slide.bullets" :key="bIndex">{{ bullet }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="preview-block">
      <h3>教案草稿</h3>
      <div class="plan">
        <p v-if="!lessonPlan" class="muted">暂无教案草稿。</p>
        <template v-else>
          <span>教学目标：{{ lessonPlan.goals }}</span>
          <span>教学过程：{{ lessonPlan.process?.join('；') }}</span>
          <span>教学方法：{{ lessonPlan.methods }}</span>
          <span>课堂活动：{{ lessonPlan.activities }}</span>
          <span>课后作业：{{ lessonPlan.homework }}</span>
        </template>
      </div>
    </div>

    <div class="preview-block">
      <h3>互动设计</h3>
      <div class="interaction">
        <p v-if="!interactionIdea" class="muted">暂无互动设计。</p>
        <template v-else>
          <strong>{{ interactionIdea.title }}</strong>
          <p>{{ interactionIdea.description }}</p>
          <small>更新时间：{{ formatTime(updatedAt) }}</small>
        </template>
      </div>
    </div>

    <div class="preview-block">
      <h3>知识库引用</h3>
      <div class="rag-box">
        <p v-if="!rag.length" class="muted">暂无知识库引用。</p>
        <div v-for="item in rag" :key="item.id" class="rag-item">
          <div class="rag-meta">{{ item.source }} · score {{ item.score }}</div>
          <p>{{ item.content }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  summary: {
    type: String,
    default: ''
  },
  draft: {
    type: Object,
    default: null
  },
  intent: {
    type: Object,
    default: null
  },
  rag: {
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
  }
});

const slides = computed(() => props.draft?.ppt ?? []);
const lessonPlan = computed(() => props.draft?.lessonPlan || null);
const interactionIdea = computed(() => props.draft?.interactionIdea || null);
const updatedAt = computed(() => props.draft?.updatedAt || null);
const FIELD_LABELS = {
  subject: '主题/章节',
  grade: '年级/学段',
  duration: '课堂时长',
  goals: '教学目标',
  keyPoints: '核心知识点',
  style: '教学风格',
  interactions: '互动设计'
};

const missingFields = computed(() =>
  (props.intent?.missingFields || []).map((field) => FIELD_LABELS[field] || field)
);
const canConfirm = computed(() => props.intent && props.intent.ready && !props.intent.confirmed);

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
    window.alert('请先生成课件初稿，再导出。');
    return;
  }
  window.alert('导出功能为占位，后续将生成 .pptx/.docx 文件。');
};

const handleConfirm = () => {
  if (!props.onConfirm) return;
  props.onConfirm();
};
</script>

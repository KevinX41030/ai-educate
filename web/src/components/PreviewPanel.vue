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
  }
});

const slides = computed(() => props.draft?.ppt ?? []);
const lessonPlan = computed(() => props.draft?.lessonPlan || null);
const interactionIdea = computed(() => props.draft?.interactionIdea || null);
const updatedAt = computed(() => props.draft?.updatedAt || null);

const formatTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString();
};

const handleExport = () => {
  if (!props.draft) {
    window.alert('请先生成课件初稿，再导出。');
    return;
  }
  window.alert('导出功能为占位，后续将生成 .pptx/.docx 文件。');
};
</script>

<template>
  <section class="live-preview-panel">
    <div class="live-preview-head">
      <div>
        <span class="panel-kicker">实时预览</span>
        <h2>{{ fields.subject || 'PPT 页面生成中' }}</h2>
        <p>{{ statusDescription }}</p>
      </div>
      <div class="live-preview-meta">
        <span class="live-preview-status" :class="statusTone">{{ statusLabel }}</span>
        <strong>{{ displaySlides.length ? `${displaySlides.length} 页` : '未生成' }}</strong>
      </div>
    </div>

    <div v-if="!displaySlides.length" class="live-preview-empty">
      <div class="preview-skeleton preview-skeleton-cover"></div>
      <div class="preview-skeleton preview-skeleton-line"></div>
      <div class="preview-skeleton preview-skeleton-line short"></div>
      <p>点击左侧生成 PPT 后，这里会先出现页面结构，再持续同步完整页面内容。</p>
    </div>

    <template v-else>
      <div class="live-preview-strip">
        <button
          v-for="(slide, index) in displaySlides"
          :key="slide.id || index"
          type="button"
          :class="['preview-thumbnail', { active: selectedSlideIndex === index }]"
          @click="selectedSlideIndex = index"
        >
          <span>{{ index + 1 }}</span>
          <strong>{{ slide.title }}</strong>
          <small>{{ slideSummary(slide) }}</small>
        </button>
      </div>

      <div class="live-preview-stage">
        <div class="live-preview-stage-head">
          <div>
            <span>第 {{ selectedSlideIndex + 1 }} 页</span>
            <strong>{{ selectedSlide?.title || '未命名页面' }}</strong>
          </div>
          <em>{{ previewStatusLabel }}</em>
        </div>

        <ClassroomSlideCard
          v-if="selectedClassroomScene"
          :scene="selectedClassroomScene"
          :index="selectedSlideIndex"
        />

        <SceneSlideCard v-else-if="selectedSceneSlide" :slide="selectedSceneSlide" :index="selectedSlideIndex" />

        <article v-else class="live-preview-fallback">
          <h3>{{ selectedFallbackSlide?.title }}</h3>
          <ul v-if="selectedFallbackSlide?.bullets?.length">
            <li v-for="(bullet, bulletIndex) in selectedFallbackSlide.bullets" :key="bulletIndex">{{ bullet }}</li>
          </ul>
          <p v-else>当前页面内容仍在生成中，稍后会自动补全。</p>
        </article>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import ClassroomSlideCard from './classroom/ClassroomSlideCard.vue';
import SceneSlideCard from './SceneSlideCard.vue';

const props = defineProps({
  classroom: {
    type: Object,
    default: null
  },
  draft: {
    type: Object,
    default: null
  },
  scene: {
    type: Object,
    default: null
  },
  previewStatus: {
    type: String,
    default: 'idle'
  },
  fields: {
    type: Object,
    default: () => ({})
  }
});

const selectedSlideIndex = ref(0);

const classroomScenes = computed(() => props.classroom?.scenes ?? []);
const sceneSlides = computed(() => props.scene?.slides ?? []);
const fallbackSlides = computed(() => (sceneSlides.value.length ? [] : props.draft?.ppt ?? []));
const displaySlides = computed(() => {
  if (classroomScenes.value.length) return classroomScenes.value;
  return sceneSlides.value.length ? sceneSlides.value : fallbackSlides.value;
});
const selectedSlide = computed(() => displaySlides.value[selectedSlideIndex.value] || null);
const selectedClassroomScene = computed(() => classroomScenes.value[selectedSlideIndex.value] || null);
const selectedSceneSlide = computed(() => sceneSlides.value[selectedSlideIndex.value] || null);
const selectedFallbackSlide = computed(() => fallbackSlides.value[selectedSlideIndex.value] || null);

const statusLabel = computed(() => {
  if (classroomScenes.value.length) return '已生成';
  if (props.previewStatus === 'generating') return '生成中';
  if (props.previewStatus === 'ready') return '已完成';
  if (displaySlides.value.length) return '已生成';
  return '等待开始';
});

const statusTone = computed(() => {
  if (classroomScenes.value.length) return 'success';
  if (props.previewStatus === 'generating') return 'active';
  if (props.previewStatus === 'ready') return 'success';
  return 'idle';
});

const statusDescription = computed(() => {
  if (classroomScenes.value.length) return '当前展示的是导出同源的课件结果，预览与导出使用同一份结构。';
  if (props.previewStatus === 'generating') return '正在补全页面布局与内容结构。';
  if (props.previewStatus === 'ready') return '当前页面已经同步到最新结果，可以继续补充需求。';
  if (displaySlides.value.length) return 'PPT 已经生成，当前展示的是最新页面结果。';
  return '当前还没有页面内容，先从左侧发起一次 PPT 生成。';
});

const previewStatusLabel = computed(() => {
  if (classroomScenes.value.length) return '预览已就绪';
  if (props.previewStatus === 'generating') return '页面生成中';
  if (props.previewStatus === 'ready') return '页面已完成';
  if (displaySlides.value.length) return '已生成页面';
  return '等待内容';
});

watch(
  () => displaySlides.value.length,
  (length) => {
    if (!length) {
      selectedSlideIndex.value = 0;
      return;
    }
    if (selectedSlideIndex.value >= length) {
      selectedSlideIndex.value = length - 1;
    }
  },
  { immediate: true }
);

const slideSummary = (slide) => {
  if (slide?.content?.canvas?.elements?.length) {
    const textElement = slide.content.canvas.elements.find((element) => element.type === 'text' && element.content);
    if (textElement?.content) {
      return `${textElement.content}`.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 22);
    }
    return slide?.slideMeta?.layout || 'classroom';
  }
  if (slide?.blocks?.length) {
    const textBlock = slide.blocks.find((block) => block.text) || slide.blocks.find((block) => block.items?.length);
    if (textBlock?.text) return textBlock.text.slice(0, 22);
    if (textBlock?.items?.length) return textBlock.items[0].slice(0, 22);
  }
  if (slide?.bullets?.length) return slide.bullets[0].slice(0, 22);
  return '等待内容补全';
};
</script>

<style scoped>
.live-preview-panel {
  display: grid;
  gap: 18px;
}

.live-preview-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.live-preview-head h2 {
  margin: 8px 0;
  font-size: 28px;
  line-height: 1.18;
}

.live-preview-head p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.live-preview-meta {
  display: grid;
  gap: 8px;
  justify-items: end;
}

.live-preview-status {
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.live-preview-status.active {
  background: rgba(101, 138, 228, 0.12);
  color: var(--primary);
}

.live-preview-status.success {
  background: rgba(161, 254, 239, 0.42);
  color: var(--primary-strong);
}

.live-preview-empty,
.live-preview-stage {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(40, 49, 78, 0.08);
}

.live-preview-empty p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.preview-skeleton {
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(235, 236, 239, 0.9), rgba(244, 245, 247, 1), rgba(235, 236, 239, 0.9));
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}

.preview-skeleton-cover {
  height: 220px;
}

.preview-skeleton-line {
  height: 16px;
}

.preview-skeleton-line.short {
  width: 62%;
}

.live-preview-strip {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(164px, 1fr);
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
}

.preview-thumbnail {
  display: grid;
  gap: 8px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid rgba(40, 49, 78, 0.08);
  background: rgba(255, 255, 255, 0.86);
  text-align: left;
  box-shadow: none;
}

.preview-thumbnail.active {
  border-color: rgba(101, 138, 228, 0.26);
  background: rgba(161, 254, 239, 0.18);
}

.preview-thumbnail span,
.preview-thumbnail small {
  color: var(--muted);
}

.preview-thumbnail strong,
.live-preview-stage-head strong,
.live-preview-fallback h3 {
  line-height: 1.5;
}

.live-preview-stage-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.live-preview-stage-head span,
.live-preview-stage-head em {
  color: var(--muted);
  font-size: 12px;
  font-style: normal;
}

.live-preview-stage-head strong {
  display: block;
  margin-top: 6px;
  font-size: 24px;
}

.live-preview-fallback {
  display: grid;
  gap: 14px;
}

.live-preview-fallback h3,
.live-preview-fallback p,
.live-preview-fallback ul {
  margin: 0;
}

.live-preview-fallback ul {
  padding-left: 20px;
  display: grid;
  gap: 10px;
  line-height: 1.7;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

@media (max-width: 720px) {
  .live-preview-head,
  .live-preview-stage-head {
    flex-direction: column;
  }

  .live-preview-meta {
    justify-items: start;
  }
}
</style>

<template>
  <section class="live-preview-panel">
    <div class="live-preview-head">
      <div>
        <span class="panel-kicker">实时预览</span>
        <h2>{{ fields.subject || 'PPT 实时生成中' }}</h2>
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
      <p>输入需求后，这里会先出现课件骨架，再自动增强成更完整的版式预览。</p>
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
          <em>{{ sceneStatusLabel }}</em>
        </div>

        <SceneSlideCard v-if="selectedSceneSlide" :slide="selectedSceneSlide" :index="selectedSlideIndex" />

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
import SceneSlideCard from './SceneSlideCard.vue';

const props = defineProps({
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
  fields: {
    type: Object,
    default: () => ({})
  }
});

const selectedSlideIndex = ref(0);

const sceneSlides = computed(() => props.scene?.slides ?? []);
const fallbackSlides = computed(() => (sceneSlides.value.length ? [] : props.draft?.ppt ?? []));
const displaySlides = computed(() => (sceneSlides.value.length ? sceneSlides.value : fallbackSlides.value));
const selectedSlide = computed(() => displaySlides.value[selectedSlideIndex.value] || null);
const selectedSceneSlide = computed(() => sceneSlides.value[selectedSlideIndex.value] || null);
const selectedFallbackSlide = computed(() => fallbackSlides.value[selectedSlideIndex.value] || null);

const statusLabel = computed(() => {
  if (props.sceneStatus === 'generating') return '正在更新';
  if (props.sceneStatus === 'ready') return '已同步';
  if (displaySlides.value.length) return '已生成骨架';
  return '等待开始';
});

const statusTone = computed(() => {
  if (props.sceneStatus === 'generating') return 'active';
  if (props.sceneStatus === 'ready') return 'success';
  return 'idle';
});

const statusDescription = computed(() => {
  if (props.sceneStatus === 'generating') return '正在把基础大纲转换成更完整的页面版式。';
  if (props.sceneStatus === 'ready') return '右侧已经是当前最新的页面内容，可以继续聊天修改。';
  if (displaySlides.value.length) return '已经生成基础页面，AI 还会继续根据对话补全内容。';
  return '当前还没有页面内容，先在中间输入完整课程需求。';
});

const sceneStatusLabel = computed(() => {
  if (props.sceneStatus === 'generating') return '增强版式生成中';
  if (props.sceneStatus === 'ready') return '增强版式已就绪';
  if (displaySlides.value.length) return '基础预览';
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
  background: rgba(37, 99, 235, 0.12);
  color: var(--primary-strong);
}

.live-preview-status.success {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.live-preview-empty,
.live-preview-stage {
  display: grid;
  gap: 14px;
  padding: 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.live-preview-empty p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.preview-skeleton {
  border-radius: 16px;
  background: linear-gradient(90deg, rgba(226, 232, 240, 0.8), rgba(241, 245, 249, 1), rgba(226, 232, 240, 0.8));
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
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.74);
  text-align: left;
  box-shadow: none;
}

.preview-thumbnail.active {
  border-color: rgba(37, 99, 235, 0.24);
  background: rgba(239, 246, 255, 0.9);
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

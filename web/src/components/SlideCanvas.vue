<template>
  <section class="slide-canvas">
    <!-- Header bar -->
    <div class="sc-header">
      <div class="sc-header-left">
        <span class="sc-status-badge" :class="statusTone">{{ statusLabel }}</span>
        <h2>{{ fields.subject || 'PPT 预览' }}</h2>
      </div>
      <div class="sc-header-right">
        <span class="sc-page-count">{{ totalSlides }} 页</span>
        <button class="sc-btn-export" type="button" :disabled="!totalSlides || !canExport" @click="$emit('export')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4.5 7L8 10.5 11.5 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          导出 PPT
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!totalSlides" class="sc-empty">
      <div class="sc-empty-skeleton"></div>
      <div class="sc-empty-skeleton sc-empty-skeleton-sm"></div>
      <div class="sc-empty-skeleton sc-empty-skeleton-xs"></div>
      <p>点击左侧「生成 PPT」后，幻灯片会逐页呈现在这里。</p>
    </div>

    <!-- Slide list -->
    <div v-else-if="classroomScenes.length" class="sc-slide-list">
      <ClassroomSlideCard
        v-for="(sceneItem, index) in classroomScenes"
        :key="sceneItem.id || index"
        :scene="sceneItem"
        :index="index"
        :citation-labels="sceneItem.citationLabels || []"
      />
    </div>

    <div v-else class="sc-slide-list">
      <template v-for="(slide, index) in displaySlides" :key="slide.id || index">
        <SlideCard
          :slide="slide"
          :slide-index="index"
          :total-slides="displaySlides.length"
          :design-preset="designPreset"
          :theme="theme"
          @update-block="onUpdateBlock"
          @menu="onSlideMenu"
          @ai-enhance="$emit('ai-enhance-slide', index)"
        />

        <SlideDivider
          v-if="index < displaySlides.length - 1"
          @add-slide="$emit('add-slide', { after: index, type: 'blank' })"
        />
      </template>

      <!-- Add slide at the end -->
      <div class="sc-add-tail">
        <button class="sc-add-tail-btn" type="button" @click="$emit('add-slide', { after: displaySlides.length - 1, type: 'blank' })">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          新增页面
        </button>
      </div>
    </div>

    <!-- Context menu -->
    <div v-if="contextMenu.visible" class="sc-context-menu" :style="contextMenu.style" @click.stop>
      <button @click="resetSlide(contextMenu.index)">重置此页</button>
      <button @click="duplicateSlide(contextMenu.index)">复制此页</button>
      <button @click="deleteSlide(contextMenu.index)" class="sc-danger">删除此页</button>
      <button @click="contextMenu.visible = false">取消</button>
    </div>
    <div v-if="contextMenu.visible" class="sc-context-overlay" @click="contextMenu.visible = false"></div>
  </section>
</template>

<script setup>
import { computed, reactive } from 'vue';
import ClassroomSlideCard from './classroom/ClassroomSlideCard.vue';
import SlideCard from './SlideCard.vue';
import SlideDivider from './SlideDivider.vue';

const props = defineProps({
  classroom: { type: Object, default: null },
  draft: { type: Object, default: null },
  scene: { type: Object, default: null },
  previewStatus: { type: String, default: 'idle' },
  canExport: { type: Boolean, default: true },
  fields: { type: Object, default: () => ({}) },
  rag: { type: Array, default: () => [] }
});

const emit = defineEmits([
  'update-block', 'add-slide', 'delete-slide', 'duplicate-slide',
  'regenerate-slide', 'ai-enhance-slide', 'export'
]);

const contextMenu = reactive({ visible: false, index: -1, style: {} });

const classroomScenes = computed(() => {
  const scenes = Array.isArray(props.classroom?.scenes) ? props.classroom.scenes : [];
  return scenes.map((sceneItem) => {
    const citations = Array.isArray(sceneItem?.citations) ? sceneItem.citations : [];
    return {
      ...sceneItem,
      citationLabels: citations.map((sourceId) => citationSourceMap.value.get(sourceId) || sourceId)
    };
  });
});
const sceneSlides = computed(() => props.scene?.slides ?? []);
const draftSlides = computed(() => props.draft?.ppt ?? []);
const fallbackSlides = computed(() => sceneSlides.value.length ? [] : draftSlides.value);
const citationSourceMap = computed(() => new Map(
  (props.rag || []).map((item) => [item.sourceId, item.source || item.sourceId])
));
const displaySlides = computed(() => {
  const slides = sceneSlides.value.length ? sceneSlides.value : fallbackSlides.value;
  return slides.map((slide, index) => {
    const draftSlide = draftSlides.value[index] || {};
    const citations = Array.isArray(slide?.citations) && slide.citations.length
      ? slide.citations
      : (Array.isArray(draftSlide?.citations) ? draftSlide.citations : []);

    return {
      ...slide,
      citations,
      citationLabels: citations.map((sourceId) => citationSourceMap.value.get(sourceId) || sourceId)
    };
  });
});
const totalSlides = computed(() => classroomScenes.value.length || displaySlides.value.length);

const designPreset = computed(() => props.scene?.designPreset || props.draft?.designPreset || 'corporate');
const theme = computed(() => {
  const raw = props.scene?.theme || props.draft?.theme || {};
  return {
    primary: raw.primary || '#1F3B73',
    accent: raw.accent || '#4C8BF5',
    background: raw.background || '#F8FAFC',
    text: raw.text || '#0F172A',
    font: raw.font || 'Microsoft YaHei'
  };
});

const statusLabel = computed(() => {
  if (props.previewStatus === 'drafting') return '逐页生成中';
  if (props.previewStatus === 'generating') return '生成中';
  if (props.previewStatus === 'ready') return '已完成';
  if (classroomScenes.value.length || displaySlides.value.length) return '已生成';
  return '等待开始';
});

const statusTone = computed(() => {
  if (props.previewStatus === 'drafting') return 'active';
  if (props.previewStatus === 'generating') return 'active';
  if (props.previewStatus === 'ready') return 'success';
  if (classroomScenes.value.length) return 'success';
  return 'idle';
});

const onUpdateBlock = (data) => {
  emit('update-block', data);
};

const onSlideMenu = ({ slideIndex, anchorRect } = {}) => {
  const index = Number(slideIndex);
  if (Number.isNaN(index) || index < 0) return;

  const menuWidth = 180;
  const menuHeight = 178;
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const fallbackLeft = Math.max(16, (viewportWidth - menuWidth) / 2);
  const fallbackTop = Math.max(16, (viewportHeight - menuHeight) / 2);

  let left = fallbackLeft;
  let top = fallbackTop;

  if (anchorRect && typeof anchorRect === 'object') {
    left = Math.min(
      Math.max(12, (anchorRect.left || 0)),
      Math.max(12, viewportWidth - menuWidth - 12)
    );
    top = Math.min(
      Math.max(12, (anchorRect.bottom || 0) + 8),
      Math.max(12, viewportHeight - menuHeight - 12)
    );
  }

  contextMenu.visible = true;
  contextMenu.index = index;
  contextMenu.style = {
    top: `${top}px`,
    left: `${left}px`
  };
};

const duplicateSlide = (index) => {
  contextMenu.visible = false;
  emit('duplicate-slide', index);
};

const resetSlide = (index) => {
  contextMenu.visible = false;
  emit('regenerate-slide', index);
};

const deleteSlide = (index) => {
  contextMenu.visible = false;
  emit('delete-slide', index);
};
</script>

<style scoped>
.slide-canvas {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-height: 100%;
}

/* Header */
.sc-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(40, 49, 78, 0.06);
}

.sc-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sc-header-left h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.sc-header-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.sc-page-count {
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.sc-status-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.sc-status-badge.idle {
  background: rgba(148, 163, 184, 0.14);
  color: #64748b;
}

.sc-status-badge.active {
  background: rgba(101, 138, 228, 0.14);
  color: #658AE4;
}

.sc-status-badge.success {
  background: rgba(34, 197, 94, 0.14);
  color: #16a34a;
}

.sc-btn-export {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  border-radius: 12px;
  background: linear-gradient(135deg, #658AE4 0%, #4F6BD9 50%, #7C5CE7 100%);
  color: white;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(101, 138, 228, 0.35);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  letter-spacing: 0.02em;
}

.sc-btn-export::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.sc-btn-export:hover::before {
  left: 100%;
}

.sc-btn-export:hover {
  background: linear-gradient(135deg, #5279d8 0%, #4562cc 50%, #6B4FD4 100%);
  box-shadow: 0 4px 20px rgba(101, 138, 228, 0.5);
  transform: translateY(-1px);
}

.sc-btn-export:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(101, 138, 228, 0.3);
}

.sc-btn-export:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.sc-btn-export:disabled::before {
  display: none;
}

.sc-btn-export svg {
  flex-shrink: 0;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
}

/* Empty state */
.sc-empty {
  display: grid;
  gap: 12px;
  padding: 60px 40px;
  justify-items: center;
}

.sc-empty p {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
}

.sc-empty-skeleton {
  width: 100%;
  max-width: 700px;
  height: 280px;
  border-radius: 12px;
  background: linear-gradient(90deg, rgba(235, 236, 239, 0.9), rgba(244, 245, 247, 1), rgba(235, 236, 239, 0.9));
  background-size: 200% 100%;
  animation: shimmer 1.6s linear infinite;
}

.sc-empty-skeleton-sm {
  height: 16px;
  max-width: 500px;
}

.sc-empty-skeleton-xs {
  height: 16px;
  max-width: 350px;
}

@keyframes shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

/* Slide list */
.sc-slide-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 28px 24px 60px;
  max-width: 920px;
  width: 100%;
  margin: 0 auto;
}

/* Add tail */
.sc-add-tail {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.sc-add-tail-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  background: transparent;
  color: #94a3b8;
  border: 2px dashed rgba(148, 163, 184, 0.3);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.sc-add-tail-btn:hover {
  border-color: rgba(101, 138, 228, 0.4);
  color: #658AE4;
  background: rgba(101, 138, 228, 0.04);
  transform: none;
}

/* Context menu */
.sc-context-overlay {
  position: fixed;
  inset: 0;
  z-index: 98;
}

.sc-context-menu {
  position: fixed;
  z-index: 99;
  display: grid;
  gap: 2px;
  padding: 6px;
  min-width: 160px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(16px);
}

.sc-context-menu button {
  display: block;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #334155;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.sc-context-menu button:hover {
  background: rgba(101, 138, 228, 0.08);
  transform: none;
}

.sc-danger {
  color: #ef4444 !important;
}

.sc-danger:hover {
  background: rgba(239, 68, 68, 0.08) !important;
}

@media (max-width: 720px) {
  .sc-slide-list {
    padding: 16px 12px 40px;
  }

  .sc-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
}
</style>

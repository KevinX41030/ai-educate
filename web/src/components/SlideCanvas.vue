<template>
  <section class="slide-canvas">
    <!-- Header bar -->
    <div class="sc-header">
      <div class="sc-header-left">
        <span class="sc-status-badge" :class="statusTone">{{ statusLabel }}</span>
        <h2>{{ fields.subject || 'PPT 预览' }}</h2>
      </div>
      <div class="sc-header-right">
        <span class="sc-page-count">{{ displaySlides.length }} 页</span>
        <button class="sc-btn-export" type="button" :disabled="!displaySlides.length" @click="$emit('export')">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4.5 7L8 10.5 11.5 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 12.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          导出 PPT
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!displaySlides.length" class="sc-empty">
      <div class="sc-empty-skeleton"></div>
      <div class="sc-empty-skeleton sc-empty-skeleton-sm"></div>
      <div class="sc-empty-skeleton sc-empty-skeleton-xs"></div>
      <p>点击左侧「生成 PPT」后，幻灯片会逐页呈现在这里。</p>
    </div>

    <!-- Slide list -->
    <div v-else class="sc-slide-list">
      <template v-for="(slide, index) in displaySlides" :key="slide.id || index">
        <SlideCard
          :slide="slide"
          :slide-index="index"
          :total-slides="displaySlides.length"
          :design-preset="designPreset"
          :theme="theme"
          @update-block="onUpdateBlock"
          @menu="onSlideMenu(index)"
          @regenerate="$emit('regenerate-slide', index)"
          @ai-enhance="$emit('ai-enhance-slide', index)"
        />

        <SlideDivider
          v-if="index < displaySlides.length - 1"
          @add-blank="$emit('add-slide', { after: index, type: 'blank' })"
          @add-ai="$emit('add-slide', { after: index, type: 'ai' })"
          @change-layout="$emit('change-layout', index)"
        />
      </template>

      <!-- Add slide at the end -->
      <div class="sc-add-tail">
        <button class="sc-add-tail-btn" type="button" @click="$emit('add-slide', { after: displaySlides.length - 1, type: 'blank' })">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          添加新页面
        </button>
      </div>
    </div>

    <!-- Context menu -->
    <div v-if="contextMenu.visible" class="sc-context-menu" :style="contextMenu.style" @click.stop>
      <button @click="duplicateSlide(contextMenu.index)">复制此页</button>
      <button @click="deleteSlide(contextMenu.index)" class="sc-danger">删除此页</button>
      <button @click="contextMenu.visible = false">取消</button>
    </div>
    <div v-if="contextMenu.visible" class="sc-context-overlay" @click="contextMenu.visible = false"></div>
  </section>
</template>

<script setup>
import { computed, reactive } from 'vue';
import SlideCard from './SlideCard.vue';
import SlideDivider from './SlideDivider.vue';

const props = defineProps({
  draft: { type: Object, default: null },
  scene: { type: Object, default: null },
  sceneStatus: { type: String, default: 'idle' },
  fields: { type: Object, default: () => ({}) }
});

const emit = defineEmits([
  'update-block', 'add-slide', 'delete-slide', 'duplicate-slide',
  'regenerate-slide', 'ai-enhance-slide', 'change-layout', 'export'
]);

const contextMenu = reactive({ visible: false, index: -1, style: {} });

const sceneSlides = computed(() => props.scene?.slides ?? []);
const fallbackSlides = computed(() => sceneSlides.value.length ? [] : (props.draft?.ppt ?? []));
const displaySlides = computed(() => sceneSlides.value.length ? sceneSlides.value : fallbackSlides.value);

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
  if (props.sceneStatus === 'generating') return '生成中';
  if (props.sceneStatus === 'ready') return '已完成';
  if (displaySlides.value.length) return '已生成';
  return '等待开始';
});

const statusTone = computed(() => {
  if (props.sceneStatus === 'generating') return 'active';
  if (props.sceneStatus === 'ready') return 'success';
  return 'idle';
});

const onUpdateBlock = (data) => {
  emit('update-block', data);
};

const onSlideMenu = (index) => {
  contextMenu.visible = true;
  contextMenu.index = index;
  contextMenu.style = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
};

const duplicateSlide = (index) => {
  contextMenu.visible = false;
  emit('duplicate-slide', index);
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
  gap: 6px;
  padding: 8px 16px;
  border-radius: 10px;
  background: #658AE4;
  color: white;
  font-size: 13px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}

.sc-btn-export:hover {
  background: #4a72d4;
  transform: none;
}

.sc-btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sc-btn-export svg {
  flex-shrink: 0;
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

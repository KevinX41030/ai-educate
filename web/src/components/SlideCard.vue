<template>
  <div
    class="slide-card"
    :class="[`preset-${designPreset}`, `role-${slide.role}`, `variant-${slide.variant || slide.role}`]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <SlideToolbar
      :visible="isHovered"
      @menu="$emit('menu', slideIndex)"
      @regenerate="$emit('regenerate', slideIndex)"
      @ai-enhance="$emit('ai-enhance', slideIndex)"
    />

    <!-- Decorative elements per preset -->
    <div class="sc-decor">
      <!-- Corporate: top bar + right accent panel for cover -->
      <template v-if="designPreset === 'corporate'">
        <div class="sc-topbar" :style="{ background: theme.primary }"></div>
        <div v-if="slide.role === 'cover'" class="sc-accent-panel" :style="{ background: theme.accent }">
          <div class="sc-circle sc-circle-lg"></div>
          <div class="sc-circle sc-circle-sm" :style="{ background: theme.primary }"></div>
        </div>
      </template>

      <!-- Editorial: top line + accent stripe -->
      <template v-else-if="designPreset === 'editorial'">
        <div class="sc-editorial-line" :style="{ borderColor: theme.primary }"></div>
        <div class="sc-editorial-stripe" :style="{ background: theme.accent }"></div>
        <div v-if="slide.role === 'cover'" class="sc-editorial-sidebar" :style="{ background: theme.accent }"></div>
      </template>

      <!-- Classroom: floating circles -->
      <template v-else-if="designPreset === 'classroom'">
        <div class="sc-float-circle sc-fc-1" :style="{ background: theme.accent, opacity: 0.3 }"></div>
        <div class="sc-float-circle sc-fc-2" :style="{ background: theme.primary, opacity: 0.2 }"></div>
        <div class="sc-float-circle sc-fc-3" :style="{ background: theme.accent, opacity: 0.25 }"></div>
      </template>
    </div>

    <!-- Slide content: blocks rendered as editable -->
    <div class="sc-content" :class="{ 'sc-cover-layout': slide.role === 'cover' }">
      <EditableBlock
        v-for="block in sortedBlocks"
        :key="block.id"
        :block="block"
        :slide-index="slideIndex"
        @update="(data) => $emit('update-block', data)"
      />
    </div>

    <!-- Footer -->
    <div class="sc-footer">
      <span>AI-Educate</span>
      <span>{{ slideIndex + 1 }} / {{ totalSlides }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import EditableBlock from './EditableBlock.vue';
import SlideToolbar from './SlideToolbar.vue';

const props = defineProps({
  slide: { type: Object, required: true },
  slideIndex: { type: Number, default: 0 },
  totalSlides: { type: Number, default: 1 },
  designPreset: { type: String, default: 'corporate' },
  theme: {
    type: Object,
    default: () => ({
      primary: '#1F3B73',
      accent: '#4C8BF5',
      background: '#F8FAFC',
      text: '#0F172A',
      font: 'Microsoft YaHei'
    })
  }
});

defineEmits(['update-block', 'menu', 'regenerate', 'ai-enhance']);

const isHovered = ref(false);

const BLOCK_ORDER = {
  title: 1, subtitle: 2, bullets: 3,
  factCards: 4, steps: 5, columns: 6,
  taskCards: 7, summaryCards: 8,
  callout: 9, question: 10
};

const sortedBlocks = computed(() => {
  const blocks = props.slide?.blocks || [];
  return [...blocks].sort((a, b) => (BLOCK_ORDER[a.type] || 99) - (BLOCK_ORDER[b.type] || 99));
});
</script>

<style scoped>
.slide-card {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  background: #F8FAFC;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.25s ease;
}

.slide-card:hover {
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(101, 138, 228, 0.15);
}

/* Decorative layer */
.sc-decor {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

/* Corporate decorations */
.sc-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2.5%;
}

.sc-accent-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 27%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12%;
  gap: 4%;
}

.sc-circle {
  border-radius: 50%;
}

.sc-circle-lg {
  width: 55%;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.2);
}

.sc-circle-sm {
  width: 30%;
  aspect-ratio: 1;
  opacity: 0.4;
}

/* Editorial decorations */
.sc-editorial-line {
  position: absolute;
  top: 5.5%;
  left: 7%;
  right: 7%;
  border-top: 1.5px solid;
}

.sc-editorial-stripe {
  position: absolute;
  top: 7%;
  left: 7%;
  width: 7%;
  height: 1%;
}

.sc-editorial-sidebar {
  position: absolute;
  left: 5.5%;
  top: 10%;
  width: 0.7%;
  height: 65%;
}

/* Classroom decorations */
.sc-float-circle {
  position: absolute;
  border-radius: 50%;
}

.sc-fc-1 {
  top: 8%;
  right: 3%;
  width: 10%;
  aspect-ratio: 1;
}

.sc-fc-2 {
  top: 16%;
  right: 0;
  width: 6%;
  aspect-ratio: 1;
}

.sc-fc-3 {
  bottom: 5%;
  left: 3%;
  width: 8%;
  aspect-ratio: 1;
}

/* Content area */
.sc-content {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6% 7% 4%;
  overflow: hidden;
}

.sc-cover-layout {
  padding-right: 32%;
  justify-content: center;
}

.preset-editorial .sc-content {
  padding-top: 10%;
}

/* Variant-specific backgrounds */
.preset-corporate {
  background: #F8FAFC;
}

.preset-editorial {
  background: #FFFBF5;
}

.preset-classroom {
  background: #F0FDFA;
}

/* Footer */
.sc-footer {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  padding: 0 7% 3%;
  font-size: 10px;
  color: #94a3b8;
}

/* Role-specific accent colors for blocks (cascaded) */
.role-cover :deep(.eb-title) {
  font-size: 32px;
}

.role-toc :deep(.eb-list) {
  gap: 10px;
}

.role-toc :deep(.eb-item-text) {
  font-size: 15px;
  font-weight: 600;
}

.role-summary :deep(.eb-card-grid) {
  grid-template-columns: repeat(3, 1fr);
}
</style>

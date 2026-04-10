<template>
  <article class="classroom-card">
    <div class="classroom-card-head">
      <div>
        <span class="classroom-page">第 {{ index + 1 }} 页</span>
        <h3>{{ scene.title || `第 ${index + 1} 页` }}</h3>
      </div>
      <div class="classroom-meta">
        <span v-if="layoutLabel">{{ layoutLabel }}</span>
        <span>{{ elementCount }} 个元素</span>
      </div>
    </div>

    <div class="classroom-stage">
      <svg
        class="classroom-svg"
        :viewBox="`0 0 ${viewportWidth} ${viewportHeight}`"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect
          x="0"
          y="0"
          :width="viewportWidth"
          :height="viewportHeight"
          :fill="canvasTheme.backgroundColor || '#ffffff'"
          rx="14"
        />

        <template v-for="element in elements" :key="element.id">
          <CanvasElementText v-if="element.type === 'text'" :element="element" />
          <CanvasElementShape v-else-if="element.type === 'shape'" :element="element" />
          <CanvasElementLine v-else-if="element.type === 'line'" :element="element" />
          <CanvasElementTable v-else-if="element.type === 'table'" :element="element" />
          <CanvasElementLatex v-else-if="element.type === 'latex'" :element="element" />
          <CanvasElementImage v-else-if="element.type === 'image'" :element="element" />
        </template>
      </svg>
    </div>

    <div v-if="citationLabels.length" class="classroom-sources">
      <span v-for="label in citationLabels" :key="label">{{ label }}</span>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import CanvasElementImage from './CanvasElementImage.vue';
import CanvasElementLatex from './CanvasElementLatex.vue';
import CanvasElementLine from './CanvasElementLine.vue';
import CanvasElementShape from './CanvasElementShape.vue';
import CanvasElementTable from './CanvasElementTable.vue';
import CanvasElementText from './CanvasElementText.vue';

const props = defineProps({
  scene: {
    type: Object,
    required: true
  },
  index: {
    type: Number,
    default: 0
  },
  citationLabels: {
    type: Array,
    default: () => []
  }
});

const canvas = computed(() => props.scene?.content?.canvas || {});
const elements = computed(() => Array.isArray(canvas.value?.elements) ? canvas.value.elements : []);
const canvasTheme = computed(() => canvas.value?.theme || {});
const viewportWidth = computed(() => Number(canvas.value?.viewportSize || 1000));
const viewportHeight = computed(() => viewportWidth.value * Number(canvas.value?.viewportRatio || 0.5625));
const elementCount = computed(() => elements.value.length);
const layoutLabel = computed(() => {
  const layout = props.scene?.slideMeta?.layout || '';
  if (!layout) return '';
  const map = {
    cover: '封面布局',
    toc: '导航布局',
    cards: '卡片布局',
    table: '表格布局',
    summary: '总结布局'
  };
  return map[layout] || layout;
});
</script>

<style scoped>
.classroom-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border-bottom: 1px solid rgba(40, 49, 78, 0.08);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(248, 250, 252, 0.94));
}

.classroom-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.classroom-card-head h3 {
  margin: 4px 0 0;
  font-size: 20px;
  line-height: 1.3;
}

.classroom-page {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(76, 139, 245, 0.12);
  color: #325da8;
  font-size: 12px;
  font-weight: 700;
}

.classroom-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.classroom-stage {
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(40, 49, 78, 0.08);
  background: #edf3f9;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
}

.classroom-svg {
  display: block;
  width: 100%;
  height: auto;
}

.classroom-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.classroom-sources span {
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}
</style>

<template>
  <g :transform="groupTransform">
    <foreignObject
      :x="element.left"
      :y="element.top"
      :width="element.width"
      :height="element.height"
    >
      <div xmlns="http://www.w3.org/1999/xhtml" class="latex-root" :style="rootStyle">
        <div v-if="element.html" class="latex-html" v-html="element.html"></div>
        <div v-else class="latex-fallback">{{ element.latex }}</div>
      </div>
    </foreignObject>
  </g>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  element: {
    type: Object,
    required: true
  }
});

const groupTransform = computed(() => {
  const rotate = Number(props.element?.rotate || 0);
  if (!rotate) return '';
  const cx = Number(props.element.left || 0) + Number(props.element.width || 0) / 2;
  const cy = Number(props.element.top || 0) + Number(props.element.height || 0) / 2;
  return `rotate(${rotate} ${cx} ${cy})`;
});

const rootStyle = computed(() => ({
  width: '100%',
  height: '100%',
  color: props.element?.color || '#111827',
  textAlign: props.element?.align || 'left'
}));
</script>

<style scoped>
.latex-root {
  display: flex;
  align-items: center;
  overflow: hidden;
  font-family: 'Microsoft YaHei', sans-serif;
}

.latex-html,
.latex-fallback {
  width: 100%;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.25;
}

.latex-html :deep(.katex-display) {
  margin: 0;
}
</style>

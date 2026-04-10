<template>
  <g :transform="groupTransform">
    <foreignObject
      :x="element.left"
      :y="element.top"
      :width="element.width"
      :height="element.height"
    >
      <div xmlns="http://www.w3.org/1999/xhtml" class="canvas-html-root" :style="rootStyle">
        <div class="canvas-rich-text" v-html="element.content"></div>
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
  overflow: 'hidden',
  color: props.element?.defaultColor || '#111827',
  fontFamily: props.element?.defaultFontName || 'Microsoft YaHei'
}));
</script>

<style scoped>
.canvas-html-root {
  box-sizing: border-box;
}

.canvas-rich-text {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.canvas-rich-text :deep(p),
.canvas-rich-text :deep(div) {
  margin: 0 0 8px 0;
}

.canvas-rich-text :deep(strong) {
  font-weight: 700;
}
</style>

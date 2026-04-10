<template>
  <g :transform="translateTransform">
    <g :transform="rotateTransform">
      <g :transform="scaleTransform">
        <path :d="element.path" :fill="element.fill || '#E5E7EB'" />
      </g>
    </g>
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

const viewBox = computed(() => {
  const raw = Array.isArray(props.element?.viewBox) ? props.element.viewBox : [1, 1];
  return [
    Number(raw[0] || 1) || 1,
    Number(raw[1] || 1) || 1
  ];
});

const translateTransform = computed(() => `translate(${Number(props.element.left || 0)} ${Number(props.element.top || 0)})`);
const rotateTransform = computed(() => {
  const rotate = Number(props.element?.rotate || 0);
  if (!rotate) return '';
  return `rotate(${rotate} ${Number(props.element.width || 0) / 2} ${Number(props.element.height || 0) / 2})`;
});
const scaleTransform = computed(() => {
  const [vbWidth, vbHeight] = viewBox.value;
  return `scale(${Number(props.element.width || 0) / vbWidth} ${Number(props.element.height || 0) / vbHeight})`;
});
</script>

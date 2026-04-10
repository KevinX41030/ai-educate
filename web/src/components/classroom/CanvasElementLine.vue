<template>
  <g>
    <defs>
      <marker
        :id="markerId"
        markerWidth="10"
        markerHeight="10"
        refX="8"
        refY="3"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,6 L9,3 z" :fill="element.color || '#94A3B8'" />
      </marker>
    </defs>

    <g :transform="groupTransform">
      <line
        :x1="start[0]"
        :y1="start[1]"
        :x2="end[0]"
        :y2="end[1]"
        :stroke="element.color || '#94A3B8'"
        :stroke-width="element.width || 2"
        :stroke-dasharray="dashArray"
        :marker-end="hasArrow ? `url(#${markerId})` : undefined"
        stroke-linecap="round"
      />
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

const markerId = computed(() => `line-arrow-${props.element.id || Math.random().toString(36).slice(2, 8)}`);
const start = computed(() => Array.isArray(props.element?.start) ? props.element.start : [0, 0]);
const end = computed(() => Array.isArray(props.element?.end) ? props.element.end : [0, 0]);
const hasArrow = computed(() => Array.isArray(props.element?.points) && props.element.points[1] === 'arrow');
const dashArray = computed(() => {
  if (props.element?.style === 'dashed') return '10 8';
  if (props.element?.style === 'dotted') return '2 8';
  return undefined;
});
const groupTransform = computed(() => {
  const left = Number(props.element?.left || 0);
  const top = Number(props.element?.top || 0);
  const rotate = Number(props.element?.rotate || 0);
  return rotate
    ? `translate(${left} ${top}) rotate(${rotate})`
    : `translate(${left} ${top})`;
});
</script>

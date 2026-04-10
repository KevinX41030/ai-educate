<template>
  <image
    v-if="element.src"
    :href="element.src"
    :x="element.left"
    :y="element.top"
    :width="element.width"
    :height="element.height"
    preserveAspectRatio="xMidYMid slice"
  />
</template>

<script setup>
defineProps({
  element: {
    type: Object,
    required: true
  }
});
</script>

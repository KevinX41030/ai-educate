<template>
  <div class="app-shell">
    <main class="shell-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import { useWorkspace } from './composables/useWorkspace';

const { initWorkspace } = useWorkspace();

onMounted(() => {
  initWorkspace();
});
</script>

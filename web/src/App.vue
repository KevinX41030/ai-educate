<template>
  <div class="app-shell" :class="{ 'app-shell--workspace': isWorkspaceRoute }">
    <main class="shell-main">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useWorkspace } from './composables/useWorkspace';

const route = useRoute();
const { initWorkspace } = useWorkspace();

const isWorkspaceRoute = computed(() => route.name === 'workspace');

onMounted(() => {
  initWorkspace();
});
</script>

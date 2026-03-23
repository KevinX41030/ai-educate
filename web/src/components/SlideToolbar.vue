<template>
  <div class="slide-toolbar" v-show="visible">
    <button class="st-btn" title="更多操作" @click.stop="$emit('menu')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="3" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="13" r="1.2" fill="currentColor"/></svg>
    </button>
    <button class="st-btn" title="重新排版" @click.stop="$emit('regenerate')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 8a5.5 5.5 0 11-1.3-3.56" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.5 2.5v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button class="st-btn st-ai" title="AI 修改此页" @click.stop="$emit('ai-enhance')">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor"/><path d="M12 10l.75 1.75L14.5 12.5l-1.75.75L12 15l-.75-1.75-1.75-.75 1.75-.75L12 10z" fill="currentColor" opacity=".6"/></svg>
    </button>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false }
});

defineEmits(['menu', 'regenerate', 'ai-enhance']);
</script>

<style scoped>
.slide-toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(8px);
}

.st-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, color 0.15s;
}

.st-btn:hover {
  background: rgba(101, 138, 228, 0.1);
  color: #658AE4;
  transform: none;
}

.st-ai {
  color: #658AE4;
}
</style>

<template>
  <div class="slide-divider">
    <div class="sd-line"></div>
    <div class="sd-actions">
      <button class="sd-btn" title="添加空白页" @click="$emit('add-blank')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
      <button class="sd-btn" title="AI 生成新页" @click="$emit('add-ai')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11 6.5 7.5 3 6l3.5-1.5L8 1z" fill="currentColor"/><path d="M12 10l.75 1.75L14.5 12.5l-1.75.75L12 15l-.75-1.75-1.75-.75 1.75-.75L12 10z" fill="currentColor" opacity=".6"/></svg>
      </button>
      <button class="sd-btn" title="更换布局" @click="$emit('change-layout')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="9" width="12" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>
      </button>
    </div>
    <div class="sd-line"></div>
  </div>
</template>

<script setup>
defineEmits(['add-blank', 'add-ai', 'change-layout']);
</script>

<style scoped>
.slide-divider {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px 0;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.slide-divider:hover {
  opacity: 1;
}

.sd-line {
  flex: 1;
  height: 1px;
  background: rgba(101, 138, 228, 0.2);
}

.sd-actions {
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.sd-btn {
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

.sd-btn:hover {
  background: rgba(101, 138, 228, 0.1);
  color: #658AE4;
  transform: none;
}
</style>

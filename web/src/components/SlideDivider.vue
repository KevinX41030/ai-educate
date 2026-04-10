<template>
  <div class="slide-divider">
    <div class="sd-line"></div>
    <div class="sd-actions">
      <button class="sd-btn" title="在这里新增一页" @click="$emit('add-slide')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <span>新增页面</span>
      </button>
    </div>
    <div class="sd-line"></div>
  </div>
</template>

<script setup>
defineEmits(['add-slide']);
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
  padding: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
}

.sd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 110px;
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
  transition: background 0.15s, color 0.15s;
}

.sd-btn:hover {
  background: rgba(101, 138, 228, 0.1);
  color: #658AE4;
  transform: none;
}
</style>

<template>
  <div
    class="editable-block"
    :class="[`block-type-${block.type}`, { editing: isEditing, hovered: isHovered }]"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
    @click.stop="startEdit"
  >
    <!-- title -->
    <template v-if="block.type === 'title'">
      <div
        class="eb-title"
        :contenteditable="isEditing"
        :data-placeholder="'输入标题'"
        @blur="onTextBlur($event, 'text')"
        @keydown.enter.prevent="finishEdit"
        ref="editRef"
      >{{ block.text }}</div>
    </template>

    <!-- subtitle -->
    <template v-else-if="block.type === 'subtitle'">
      <div
        class="eb-subtitle"
        :contenteditable="isEditing"
        :data-placeholder="'输入副标题'"
        @blur="onTextBlur($event, 'text')"
        @keydown.enter.prevent="finishEdit"
        ref="editRef"
      >{{ block.text }}</div>
    </template>

    <!-- bullets / summaryCards -->
    <template v-else-if="block.type === 'bullets' || block.type === 'summaryCards'">
      <div class="eb-block-label" v-if="block.title">{{ block.title }}</div>
      <ul class="eb-list">
        <li
          v-for="(item, i) in editableItems"
          :key="i"
          class="eb-list-item"
        >
          <span class="eb-bullet">•</span>
          <div
            class="eb-item-text"
            :contenteditable="isEditing"
            :data-placeholder="'输入内容'"
            @blur="onItemBlur($event, i)"
            @keydown.enter.prevent="insertItemAfter(i)"
            @keydown.backspace="onItemBackspace($event, i)"
          >{{ item }}</div>
        </li>
      </ul>
    </template>

    <!-- factCards / taskCards -->
    <template v-else-if="block.type === 'factCards' || block.type === 'taskCards'">
      <div class="eb-block-label" v-if="block.title">{{ block.title }}</div>
      <div class="eb-card-grid">
        <div
          v-for="(item, i) in editableItems"
          :key="i"
          class="eb-mini-card"
        >
          <span v-if="block.type === 'taskCards'" class="eb-card-badge">任务 {{ i + 1 }}</span>
          <div
            class="eb-card-text"
            :contenteditable="isEditing"
            :data-placeholder="'输入内容'"
            @blur="onItemBlur($event, i)"
          >{{ item }}</div>
        </div>
      </div>
    </template>

    <!-- steps -->
    <template v-else-if="block.type === 'steps'">
      <div class="eb-block-label" v-if="block.title">{{ block.title }}</div>
      <ol class="eb-steps">
        <li v-for="(item, i) in editableItems" :key="i" class="eb-step">
          <span class="eb-step-num">{{ i + 1 }}</span>
          <div
            class="eb-step-text"
            :contenteditable="isEditing"
            :data-placeholder="'输入步骤'"
            @blur="onItemBlur($event, i)"
            @keydown.enter.prevent="insertItemAfter(i)"
          >{{ item }}</div>
        </li>
      </ol>
    </template>

    <!-- columns -->
    <template v-else-if="block.type === 'columns'">
      <div class="eb-block-label" v-if="block.title">{{ block.title }}</div>
      <div class="eb-columns">
        <div v-for="(item, i) in editableItems" :key="i" class="eb-column-card">
          <div
            class="eb-column-text"
            :contenteditable="isEditing"
            :data-placeholder="'输入内容'"
            @blur="onItemBlur($event, i)"
          >{{ item }}</div>
        </div>
      </div>
    </template>

    <!-- callout / question / fallback -->
    <template v-else>
      <div class="eb-block-label">{{ block.title || fallbackLabel }}</div>
      <div
        class="eb-body-text"
        :contenteditable="isEditing"
        :data-placeholder="'输入内容'"
        @blur="onTextBlur($event, 'text')"
        ref="editRef"
      >{{ block.text }}</div>
    </template>

    <div v-if="isHovered && !isEditing" class="eb-edit-hint">点击编辑</div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';

const props = defineProps({
  block: { type: Object, required: true },
  slideIndex: { type: Number, default: 0 }
});

const emit = defineEmits(['update']);

const isEditing = ref(false);
const isHovered = ref(false);
const editRef = ref(null);

const editableItems = computed(() =>
  Array.isArray(props.block.items) ? [...props.block.items] : []
);

const fallbackLabel = computed(() => {
  if (props.block.type === 'callout') return '提示';
  if (props.block.type === 'question') return '互动';
  return '内容';
});

const startEdit = async () => {
  isEditing.value = true;
  await nextTick();
  if (editRef.value) {
    editRef.value.focus();
    // place cursor at end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editRef.value);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
};

const finishEdit = () => {
  isEditing.value = false;
};

const onTextBlur = (event, field) => {
  const newValue = event.target.textContent.trim();
  if (newValue !== (props.block[field] || '')) {
    emit('update', {
      blockId: props.block.id,
      field,
      value: newValue,
      slideIndex: props.slideIndex
    });
  }
  isEditing.value = false;
};

const onItemBlur = (event, index) => {
  const newValue = event.target.textContent.trim();
  const items = [...editableItems.value];
  if (newValue !== items[index]) {
    items[index] = newValue;
    // Remove empty items (except if it's the only one)
    const filtered = items.filter((item, i) => item || items.length === 1);
    emit('update', {
      blockId: props.block.id,
      field: 'items',
      value: filtered.length ? filtered : [''],
      slideIndex: props.slideIndex
    });
  }
};

const insertItemAfter = (index) => {
  const items = [...editableItems.value];
  items.splice(index + 1, 0, '');
  emit('update', {
    blockId: props.block.id,
    field: 'items',
    value: items,
    slideIndex: props.slideIndex
  });
};

const onItemBackspace = (event, index) => {
  const text = event.target.textContent;
  if (text === '' && editableItems.value.length > 1) {
    event.preventDefault();
    const items = [...editableItems.value];
    items.splice(index, 1);
    emit('update', {
      blockId: props.block.id,
      field: 'items',
      value: items,
      slideIndex: props.slideIndex
    });
  }
};
</script>

<style scoped>
.editable-block {
  position: relative;
  padding: 10px 14px;
  border-radius: 8px;
  border: 2px solid transparent;
  transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  cursor: text;
}

.editable-block.hovered:not(.editing) {
  background: rgba(101, 138, 228, 0.05);
  border-color: rgba(101, 138, 228, 0.15);
}

.editable-block.editing {
  background: rgba(255, 255, 255, 0.95);
  border-color: rgba(101, 138, 228, 0.45);
  box-shadow: 0 0 0 3px rgba(101, 138, 228, 0.08);
}

.eb-edit-hint {
  position: absolute;
  top: 6px;
  right: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(101, 138, 228, 0.12);
  color: #658AE4;
  font-size: 11px;
  font-weight: 600;
  pointer-events: none;
  opacity: 0.8;
}

/* Title */
.eb-title {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.25;
  outline: none;
  min-height: 1.25em;
}

.eb-subtitle {
  font-size: 16px;
  color: #66718d;
  line-height: 1.6;
  outline: none;
  min-height: 1.2em;
}

/* Block label */
.eb-block-label {
  font-size: 12px;
  font-weight: 700;
  color: #658AE4;
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

/* Bullet list */
.eb-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 6px;
}

.eb-list-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.eb-bullet {
  color: #658AE4;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 2px;
}

.eb-item-text {
  outline: none;
  line-height: 1.65;
  flex: 1;
  min-height: 1.2em;
}

/* Card grid */
.eb-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.eb-mini-card {
  padding: 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(40, 49, 78, 0.08);
  display: grid;
  gap: 6px;
}

.eb-card-badge {
  font-size: 11px;
  font-weight: 700;
  color: #658AE4;
}

.eb-card-text {
  outline: none;
  font-size: 13px;
  line-height: 1.6;
  min-height: 1.2em;
}

/* Steps */
.eb-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.eb-step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  align-items: start;
}

.eb-step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #658AE4;
  color: white;
  font-size: 12px;
  font-weight: 800;
}

.eb-step-text {
  outline: none;
  line-height: 1.65;
  padding-top: 3px;
  min-height: 1.2em;
}

/* Columns */
.eb-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.eb-column-card {
  padding: 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(40, 49, 78, 0.08);
}

.eb-column-text {
  outline: none;
  font-size: 13px;
  line-height: 1.6;
  min-height: 1.2em;
}

/* Body text (callout/question) */
.eb-body-text {
  outline: none;
  line-height: 1.65;
  min-height: 1.2em;
}

/* Placeholder for empty contenteditable */
[contenteditable]:empty::before {
  content: attr(data-placeholder);
  color: #98a2b3;
  pointer-events: none;
}

/* Cover title special sizing */
.block-type-title .eb-title {
  font-size: 32px;
}
</style>

<template>
  <section class="workspace-chat-panel">
    <div ref="messageListRef" class="workspace-message-list">
      <div
        v-for="(message, index) in messages"
        :key="`${message.role}-${index}`"
        class="workspace-message-row"
        :class="message.role"
      >
        <div class="workspace-message-avatar">{{ message.role === 'assistant' ? 'AI' : '我' }}</div>
        <div class="workspace-message-bubble">
          <p>{{ message.text }}</p>
        </div>
      </div>
    </div>

    <div
      class="workspace-upload-card"
      :class="{ dragging: isDragging }"
      @click="triggerFilePicker"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent="handleDrop"
    >
      <input ref="fileInputRef" class="sr-only" type="file" multiple @change="handleFileInputChange" />
      <strong>{{ uploading ? '资料上传中…' : '拖拽资料到这里，或点击上传文档' }}</strong>
      <p>支持 PDF / Word / PPT / 图片，上传后会自动加入本次备课上下文。</p>
    </div>

    <div class="workspace-composer-card">
      <textarea
        v-model="input"
        rows="5"
        placeholder="继续告诉 AI 你希望怎样调整内容、增加互动、修改风格或补充信息。"
        @keydown.enter.exact.prevent="submit"
      ></textarea>

      <div class="workspace-composer-footer">
        <span class="workspace-composer-hint">按 Enter 发送，Shift + Enter 换行</span>
        <button class="primary" type="button" :disabled="busy || !canSubmit" @click="submit">
          {{ busy ? '发送中…' : '发送给 AI' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  busy: {
    type: Boolean,
    default: false
  },
  onSend: {
    type: Function,
    required: true
  },
  onUpload: {
    type: Function,
    required: true
  }
});

const input = ref('');
const fileInputRef = ref(null);
const messageListRef = ref(null);
const uploading = ref(false);
const isDragging = ref(false);

const canSubmit = computed(() => input.value.trim().length > 0);

const scrollToBottom = async () => {
  await nextTick();
  if (!messageListRef.value) return;
  messageListRef.value.scrollTo({
    top: messageListRef.value.scrollHeight,
    behavior: 'smooth'
  });
};

watch(
  () => props.messages.length,
  () => {
    void scrollToBottom();
  },
  { immediate: true }
);

const submit = async () => {
  const text = input.value.trim();
  if (!text || props.busy) return;
  input.value = '';
  await props.onSend(text, { autoGenerate: true });
};

const triggerFilePicker = () => {
  fileInputRef.value?.click();
};

const uploadSelectedFiles = async (selectedFiles) => {
  if (!selectedFiles?.length) return;
  uploading.value = true;
  try {
    await props.onUpload(selectedFiles);
  } finally {
    uploading.value = false;
    if (fileInputRef.value) fileInputRef.value.value = '';
  }
};

const handleFileInputChange = async () => {
  const selectedFiles = Array.from(fileInputRef.value?.files || []);
  await uploadSelectedFiles(selectedFiles);
};

const handleDragOver = () => {
  isDragging.value = true;
};

const handleDragLeave = () => {
  isDragging.value = false;
};

const handleDrop = async (event) => {
  isDragging.value = false;
  const droppedFiles = Array.from(event.dataTransfer?.files || []);
  await uploadSelectedFiles(droppedFiles);
};
</script>

<style scoped>
.workspace-chat-panel {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  gap: 14px;
  min-height: calc(100vh - 84px);
}

.workspace-message-list {
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 12px;
  padding-right: 6px;
  align-content: start;
}

.workspace-message-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
}

.workspace-message-row.user {
  grid-template-columns: minmax(0, 1fr) 36px;
}

.workspace-message-avatar {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(101, 138, 228, 0.16);
  color: var(--primary-strong);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.workspace-message-bubble {
  display: grid;
  max-width: min(84%, 860px);
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.workspace-message-row.assistant .workspace-message-bubble {
  justify-self: start;
}

.workspace-message-row.user .workspace-message-bubble {
  order: 1;
  justify-self: end;
  background: rgba(161, 254, 239, 0.42);
}

.workspace-message-row.user .workspace-message-avatar {
  order: 2;
  background: var(--primary-strong);
  color: #ffffff;
}

.workspace-message-row.user .workspace-message-bubble p {
  text-align: right;
}

.workspace-message-bubble p {
  margin: 0;
  white-space: pre-wrap;
  color: #172033;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 1.38;
}

.workspace-upload-card,
.workspace-composer-card {
  display: grid;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.workspace-composer-card {
  grid-template-rows: minmax(0, auto) auto;
  gap: 0;
  padding: 0;
  overflow: hidden;
}

.workspace-upload-card {
  gap: 8px;
  padding: 14px;
}

.workspace-upload-card {
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.workspace-upload-card.dragging {
  transform: translateY(-1px);
  border-color: rgba(101, 138, 228, 0.3);
  background: rgba(161, 254, 239, 0.22);
}

.workspace-upload-card p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.55;
}

.workspace-upload-card strong {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.workspace-composer-card textarea {
  min-height: 120px;
  max-height: 180px;
  display: block;
  padding: 16px 16px 12px;
  border: none;
  box-shadow: none;
  background: transparent;
  font-size: 14px;
  line-height: 1.55;
  resize: none;
  overflow-y: auto;
}

.workspace-composer-card textarea:focus {
  box-shadow: none;
}

.workspace-composer-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(148, 163, 184, 0.12);
}

.workspace-composer-hint {
  color: var(--muted);
  font-size: 11px;
}

.workspace-composer-footer .primary {
  min-width: 112px;
}

@media (max-width: 720px) {
  .workspace-chat-panel {
    min-height: auto;
  }

  .workspace-composer-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-message-list {
    max-height: 46vh;
  }

  .workspace-message-bubble {
    max-width: 100%;
  }
}
</style>

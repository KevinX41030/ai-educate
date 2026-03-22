<template>
  <section class="workspace-chat-panel">
    <div ref="messageListRef" class="workspace-message-list">
      <div
        v-for="(message, index) in messages"
        :key="message.id || `${message.role}-${index}`"
        class="workspace-message-row"
        :class="message.role"
      >
        <div class="workspace-message-bubble">
          <p>{{ message.text }}</p>
        </div>
      </div>

      <div v-if="busy" class="workspace-message-row assistant workspace-message-row--loading">
        <div class="workspace-message-bubble workspace-message-bubble--loading" aria-label="AI 正在回复">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <div v-if="showGenerateCta" class="workspace-generate-cta">
      <div class="workspace-generate-cta__content">
        <strong>{{ ctaTitle }}</strong>
        <p>{{ ctaReason }}</p>
      </div>
      <button class="primary" type="button" :disabled="busy" @click="handleGenerate">
        {{ busy ? '生成中…' : ctaLabel }}
      </button>
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
  canGenerate: {
    type: Boolean,
    default: false
  },
  ctaLabel: {
    type: String,
    default: '立即生成 PPT'
  },
  ctaReason: {
    type: String,
    default: '课程信息已经足够完整，可以直接开始生成。'
  },
  hasDraft: {
    type: Boolean,
    default: false
  },
  onSend: {
    type: Function,
    required: true
  },
  onGenerate: {
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
const showGenerateCta = computed(() => props.canGenerate && !props.hasDraft);
const ctaTitle = computed(() => {
  if (props.ctaLabel && props.ctaLabel !== '立即生成 PPT') {
    return props.ctaLabel;
  }
  return 'AI 判断当前信息已经足够，可以直接生成 PPT';
});

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

watch(
  () => props.busy,
  () => {
    void scrollToBottom();
  }
);

const submit = async () => {
  const text = input.value.trim();
  if (!text || props.busy) return;
  input.value = '';
  await props.onSend(text, { autoGenerate: true });
};

const handleGenerate = async () => {
  if (props.busy || !showGenerateCta.value) return;
  await props.onGenerate();
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
  width: min(980px, 100%);
  max-width: 980px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
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
  display: flex;
}

.workspace-message-row.user {
  justify-content: flex-end;
}

.workspace-message-bubble {
  display: grid;
  max-width: min(86%, 900px);
  padding: 10px 12px;
  border-radius: 10px;
  background: transparent;
  border: none;
}

.workspace-message-row.assistant .workspace-message-bubble {
  justify-self: start;
}

.workspace-message-row.user .workspace-message-bubble {
  background: rgba(161, 254, 239, 0.24);
}

.workspace-message-row.user .workspace-message-bubble p {
  text-align: left;
}

.workspace-message-bubble p {
  margin: 0;
  white-space: pre-wrap;
  color: #172033;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.5;
}

.workspace-message-bubble--loading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
}

.workspace-message-bubble--loading span {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(40, 49, 78, 0.4);
  animation: workspaceTyping 1s ease-in-out infinite;
}

.workspace-message-bubble--loading span:nth-child(2) {
  animation-delay: 0.16s;
}

.workspace-message-bubble--loading span:nth-child(3) {
  animation-delay: 0.32s;
}

.workspace-upload-card,
.workspace-generate-cta,
.workspace-composer-card {
  display: grid;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.workspace-generate-cta {
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(90, 79, 255, 0.08), rgba(72, 187, 255, 0.14));
  border-color: rgba(90, 79, 255, 0.18);
}

.workspace-generate-cta__content {
  display: grid;
  gap: 4px;
}

.workspace-generate-cta__content strong {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: #172033;
}

.workspace-generate-cta__content p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
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
  font-size: 14px;
  line-height: 1.55;
}

.workspace-upload-card strong {
  font-size: 15px;
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
  font-size: 15px;
  line-height: 1.6;
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
  font-size: 12px;
}

.workspace-composer-footer .primary {
  min-width: 112px;
}

@keyframes workspaceTyping {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
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

  .workspace-generate-cta {
    grid-template-columns: 1fr;
  }
}
</style>

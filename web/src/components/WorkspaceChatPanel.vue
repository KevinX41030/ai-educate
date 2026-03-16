<template>
  <section class="workspace-chat-panel">
    <div class="workspace-chat-head">
      <div>
        <span class="panel-kicker">AI 对话</span>
        <h2>边聊边完善你的课件</h2>
        <p>继续补充学生特点、课堂限制、互动想法或资料要求，右侧预览会持续更新。</p>
      </div>
      <span class="chat-phase-chip" :class="phaseTone">{{ phase }}</span>
    </div>

    <div class="workspace-suggestion-row">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.label"
        type="button"
        class="workspace-suggestion-chip"
        :disabled="busy"
        @click="sendSuggestion(suggestion.prompt)"
      >
        {{ suggestion.label }}
      </button>
    </div>

    <div ref="messageListRef" class="workspace-message-list">
      <div
        v-for="(message, index) in messages"
        :key="`${message.role}-${index}`"
        class="workspace-message-row"
        :class="message.role"
      >
        <div class="workspace-message-avatar">{{ message.role === 'assistant' ? 'AI' : '我' }}</div>
        <div class="workspace-message-bubble">
          <span class="workspace-message-role">{{ message.role === 'assistant' ? '智能助手' : '我的补充' }}</span>
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
  phase: {
    type: String,
    default: '等待输入课程需求'
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

const suggestions = [
  { label: '补充教学目标', prompt: '请帮我把这节课的教学目标写得更清晰、更可衡量。' },
  { label: '增加课堂互动', prompt: '请给我补充两个适合这节课的课堂互动设计。' },
  { label: '优化 PPT 结构', prompt: '请优化这份课件的页面结构，让逻辑更清楚。' }
];

const input = ref('');
const fileInputRef = ref(null);
const messageListRef = ref(null);
const uploading = ref(false);
const isDragging = ref(false);

const canSubmit = computed(() => input.value.trim().length > 0);
const phaseTone = computed(() => {
  if (/生成|优化/.test(props.phase)) return 'active';
  if (/已生成/.test(props.phase)) return 'success';
  return 'idle';
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

const submit = async () => {
  const text = input.value.trim();
  if (!text || props.busy) return;
  input.value = '';
  await props.onSend(text, { autoGenerate: true });
};

const sendSuggestion = async (prompt) => {
  if (props.busy) return;
  await props.onSend(prompt, { autoGenerate: true });
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
  gap: 18px;
}

.workspace-chat-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.workspace-chat-head h2 {
  margin: 8px 0;
  font-size: 30px;
  line-height: 1.16;
}

.workspace-chat-head p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.chat-phase-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.chat-phase-chip.active {
  background: rgba(37, 99, 235, 0.12);
  color: var(--primary-strong);
}

.chat-phase-chip.success {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.workspace-suggestion-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.workspace-suggestion-chip {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.08);
  border: 1px solid rgba(37, 99, 235, 0.12);
  color: var(--primary-strong);
  box-shadow: none;
}

.workspace-message-list {
  min-height: 420px;
  max-height: 58vh;
  overflow-y: auto;
  display: grid;
  gap: 14px;
  padding-right: 6px;
}

.workspace-message-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.workspace-message-avatar {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.14), rgba(20, 184, 166, 0.12));
  color: var(--primary-strong);
  font-size: 13px;
  font-weight: 800;
}

.workspace-message-bubble {
  display: grid;
  gap: 8px;
  padding: 18px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.06);
}

.workspace-message-row.user .workspace-message-bubble {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.1), rgba(20, 184, 166, 0.08));
}

.workspace-message-role {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.workspace-message-bubble p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.75;
}

.workspace-upload-card,
.workspace-composer-card {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.workspace-upload-card {
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.workspace-upload-card.dragging {
  transform: translateY(-1px);
  border-color: rgba(37, 99, 235, 0.28);
  background: rgba(239, 246, 255, 0.92);
}

.workspace-upload-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.7;
}

.workspace-composer-card textarea {
  min-height: 140px;
  padding: 0;
  border: none;
  box-shadow: none;
  background: transparent;
}

.workspace-composer-card textarea:focus {
  box-shadow: none;
}

.workspace-composer-footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.workspace-composer-hint {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 720px) {
  .workspace-chat-head,
  .workspace-composer-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .workspace-message-list {
    min-height: 320px;
    max-height: 46vh;
  }
}
</style>

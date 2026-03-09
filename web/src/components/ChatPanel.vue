<template>
  <section class="assistant-panel">
    <div class="assistant-head">
      <div>
        <span class="panel-kicker">Step 2 · AI 共创</span>
        <h2>把零散想法交给 AI 助手整理</h2>
        <p>可以继续补充重点难点、课堂氛围、学生特点，也可以把参考资料直接拖进来。</p>
      </div>

      <button class="ghost" type="button" @click="handleClear">清空对话</button>
    </div>

    <div class="suggestion-row">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.label"
        type="button"
        class="suggestion-chip"
        @click="sendSuggestion(suggestion.prompt)"
      >
        {{ suggestion.label }}
      </button>
    </div>

    <div class="assistant-shell">
      <div ref="chatListRef" class="chat-list modern-chat-list">
        <div
          v-for="(message, index) in messages"
          :key="`${index}-${message.role}`"
          class="message-row"
          :class="message.role"
        >
          <div class="message-avatar">{{ message.role === 'assistant' ? 'AI' : '我' }}</div>
          <div class="message-bubble">
            <span class="message-role">{{ message.role === 'assistant' ? '智能助手' : '我的需求' }}</span>
            <p>{{ message.text }}</p>
          </div>
        </div>
      </div>

      <div
        class="upload-dropzone"
        :class="{ dragging: isDragging }"
        @click="triggerFilePicker"
        @dragover.prevent="handleDragOver"
        @dragleave.prevent="handleDragLeave"
        @drop.prevent="handleDrop"
      >
        <input ref="fileInput" class="sr-only" type="file" multiple @change="handleFileInputChange" />
        <div class="dropzone-icon">+</div>
        <div>
          <strong>{{ uploading ? '资料上传中...' : '拖拽资料到这里，或点击选择文件' }}</strong>
          <p>支持 PDF / Word / PPT / 图片 / 视频，上传后会自动进入当前课件创作上下文。</p>
        </div>
      </div>

      <div v-if="files.length" class="uploaded-files">
        <div v-for="file in files" :key="file.id" class="file-card">
          <span class="file-badge">{{ extensionOf(file.name) }}</span>
          <div>
            <strong>{{ file.name }}</strong>
            <small>{{ formatSize(file.size) }}</small>
          </div>
        </div>
      </div>

      <div class="composer-card">
        <textarea
          v-model="input"
          rows="4"
          placeholder="请输入补充要求、课堂特点、资料说明或希望调整的方向"
          @keydown.enter.exact.prevent="handleSend"
        ></textarea>

        <div class="composer-footer">
          <span class="composer-hint">按 Enter 发送，Shift + Enter 换行</span>
          <div class="composer-actions">
            <button class="ghost" type="button" :disabled="voiceDisabled" @click="startVoice">
              {{ voiceLabel }}
            </button>
            <button class="primary" type="button" @click="handleSend">发送给 AI</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue';

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  files: {
    type: Array,
    default: () => []
  },
  onSend: {
    type: Function,
    required: true
  },
  onClear: {
    type: Function,
    required: true
  },
  onUpload: {
    type: Function,
    required: true
  }
});

const suggestions = [
  { label: '梳理教学目标', prompt: '请基于当前信息梳理并优化本节课的教学目标。' },
  { label: '补充互动设计', prompt: '请结合当前需求补充适合的互动设计与安排位置。' },
  { label: '优化内容结构', prompt: '请帮我优化当前内容结构，让课件层次更清晰。' },
  { label: '生成课件大纲', prompt: '请基于当前需求生成一版课件大纲。' }
];

const input = ref('');
const fileInput = ref(null);
const chatListRef = ref(null);
const uploading = ref(false);
const isDragging = ref(false);
const voiceLabel = ref('语音输入');
const voiceDisabled = ref(false);
let recognizer = null;

const scrollToBottom = async () => {
  await nextTick();
  if (!chatListRef.value) return;
  chatListRef.value.scrollTo({
    top: chatListRef.value.scrollHeight,
    behavior: 'smooth'
  });
};

watch(
  () => props.messages.length,
  () => {
    scrollToBottom();
  },
  { immediate: true }
);

const handleSend = async () => {
  const trimmed = input.value.trim();
  if (!trimmed) return;
  await props.onSend(trimmed);
  input.value = '';
};

const sendSuggestion = async (prompt) => {
  await props.onSend(prompt);
};

const handleClear = () => {
  props.onClear();
};

const uploadSelectedFiles = async (selectedFiles) => {
  if (!selectedFiles?.length) return;
  uploading.value = true;
  try {
    await props.onUpload(selectedFiles);
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
};

const triggerFilePicker = () => {
  fileInput.value?.click();
};

const handleFileInputChange = async () => {
  const selected = Array.from(fileInput.value?.files || []);
  await uploadSelectedFiles(selected);
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

const startVoice = () => {
  if (!recognizer) return;
  recognizer.start();
  voiceLabel.value = '聆听中...';
};

const extensionOf = (name = '') => {
  const extension = name.split('.').pop();
  return extension ? extension.toUpperCase() : 'FILE';
};

const formatSize = (size = 0) => {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

onMounted(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceLabel.value = '浏览器不支持语音';
    voiceDisabled.value = true;
    return;
  }

  recognizer = new SpeechRecognition();
  recognizer.lang = 'zh-CN';
  recognizer.continuous = false;
  recognizer.interimResults = false;

  recognizer.addEventListener('result', (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = `${input.value}\n${transcript}`.trim();
  });

  recognizer.addEventListener('end', () => {
    voiceLabel.value = '语音输入';
  });
});
</script>

<style scoped>
.assistant-panel {
  display: grid;
  gap: 18px;
}

.assistant-head {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: flex-start;
}

.assistant-head h2 {
  margin: 8px 0 8px;
  font-size: 28px;
  line-height: 1.2;
}

.assistant-head p {
  margin: 0;
  max-width: 640px;
  color: var(--muted);
  line-height: 1.7;
}

.suggestion-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.suggestion-chip {
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(91, 108, 255, 0.08);
  border: 1px solid rgba(91, 108, 255, 0.16);
  color: var(--primary-strong);
  box-shadow: none;
}

.assistant-shell {
  display: grid;
  gap: 16px;
}

.modern-chat-list {
  max-height: 360px;
  padding-right: 6px;
}

.message-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.message-row.user {
  justify-self: end;
}

.message-avatar {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(91, 108, 255, 0.14), rgba(124, 77, 255, 0.18));
  color: var(--primary-strong);
  font-weight: 800;
}

.message-bubble {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 22px;
  background: #ffffff;
  border: 1px solid rgba(91, 108, 255, 0.12);
  box-shadow: 0 12px 24px rgba(30, 41, 59, 0.06);
}

.message-row.user .message-bubble {
  background: linear-gradient(135deg, rgba(91, 108, 255, 0.14), rgba(124, 77, 255, 0.14));
}

.message-role {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.message-bubble p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.7;
}

.upload-dropzone {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  padding: 20px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(250, 251, 255, 0.96), rgba(245, 247, 255, 0.9));
  border: 1.5px dashed rgba(91, 108, 255, 0.26);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.upload-dropzone.dragging {
  transform: translateY(-1px);
  border-color: rgba(91, 108, 255, 0.44);
  background: rgba(91, 108, 255, 0.08);
}

.dropzone-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(91, 108, 255, 0.12), rgba(124, 77, 255, 0.16));
  color: var(--primary-strong);
  font-size: 34px;
  font-weight: 500;
}

.upload-dropzone strong {
  font-size: 16px;
}

.upload-dropzone p {
  margin: 6px 0 0;
  color: var(--muted);
  line-height: 1.6;
}

.uploaded-files {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.file-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--surface-soft);
  border: 1px solid var(--border);
}

.file-badge {
  min-width: 52px;
  padding: 8px 10px;
  border-radius: 999px;
  background: rgba(36, 200, 165, 0.14);
  color: #11856d;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.file-card strong,
.file-card small {
  display: block;
}

.file-card small {
  margin-top: 4px;
  color: var(--muted);
}

.composer-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 24px;
  background: #ffffff;
  border: 1px solid var(--border);
}

.composer-footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.composer-hint {
  color: var(--muted);
  font-size: 12px;
}

.composer-actions {
  display: flex;
  gap: 10px;
}

@media (max-width: 720px) {
  .assistant-head,
  .composer-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .upload-dropzone {
    grid-template-columns: 1fr;
  }

  .composer-actions {
    width: 100%;
  }

  .composer-actions > * {
    flex: 1;
  }
}
</style>

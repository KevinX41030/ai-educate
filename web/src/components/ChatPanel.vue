<template>
  <section class="panel chat">
    <div class="panel-title">
      <h2>教学意图对话</h2>
      <div class="tools">
        <button class="ghost" :disabled="voiceDisabled" @click="startVoice">
          {{ voiceLabel }}
        </button>
        <button class="ghost" @click="handleClear">清空对话</button>
      </div>
    </div>

    <div class="chat-list">
      <div
        v-for="(message, index) in messages"
        :key="`${index}-${message.role}`"
        class="message"
        :class="message.role"
      >
        {{ message.text }}
      </div>
    </div>

    <div class="input-row">
      <textarea
        v-model="input"
        rows="3"
        placeholder="描述你的教学需求，或按建议格式填写..."
        @keydown.enter.exact.prevent="handleSend"
      ></textarea>
      <button class="primary" @click="handleSend">发送</button>
    </div>

    <div class="upload-block">
      <div>
        <h3>参考资料上传</h3>
        <p>支持 PDF / Word / PPT / 图片 / 视频（暂仅保存，解析待接入）。</p>
      </div>
      <div class="upload-row">
        <input ref="fileInput" type="file" multiple />
        <button class="secondary" :disabled="uploading" @click="handleUpload">
          {{ uploading ? '上传中...' : '上传' }}
        </button>
      </div>
      <ul class="file-list">
        <li v-for="file in files" :key="file.id">
          {{ file.name }} ({{ Math.round(file.size / 1024) }} KB)
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';

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

const input = ref('');
const fileInput = ref(null);
const uploading = ref(false);
const voiceLabel = ref('语音输入');
const voiceDisabled = ref(false);
let recognizer = null;

const handleSend = async () => {
  const trimmed = input.value.trim();
  if (!trimmed) return;
  await props.onSend(trimmed);
  input.value = '';
};

const handleClear = () => {
  props.onClear();
};

const handleUpload = async () => {
  const files = fileInput.value?.files;
  if (!files || files.length === 0) return;
  uploading.value = true;
  await props.onUpload(Array.from(files));
  uploading.value = false;
  if (fileInput.value) fileInput.value.value = '';
};

const startVoice = () => {
  if (!recognizer) return;
  recognizer.start();
  voiceLabel.value = '聆听中...';
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

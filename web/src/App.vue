<template>
  <div class="app">
    <HeroHeader :status="status" />
    <main class="grid">
      <ChatPanel
        :messages="messages"
        :files="files"
        :on-send="handleSend"
        :on-clear="handleClear"
        :on-upload="handleUpload"
      />
      <PreviewPanel
        :summary="summary"
        :draft="draft"
        :intent="intent"
        :on-confirm="handleConfirm"
      />
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import HeroHeader from './components/HeroHeader.vue';
import ChatPanel from './components/ChatPanel.vue';
import PreviewPanel from './components/PreviewPanel.vue';
import { getStatus, sendMessage, uploadFiles } from './services/api';

const status = ref('准备就绪');
const sessionId = ref(localStorage.getItem('sessionId') || '');
const messages = ref([]);
const files = ref([]);
const summary = ref('暂无');
const draft = ref(null);
const intent = ref(null);

const buildSummary = (state) => {
  if (!state) return '暂无';
  const fields = state.fields || {};
  const keyPoints = Array.isArray(fields.keyPoints) ? fields.keyPoints.join('、') : '';
  return [
    `主题/章节：${fields.subject || '未填写'}`,
    `年级/学段：${fields.grade || '未填写'}`,
    `课堂时长：${fields.duration || '未填写'}`,
    `教学目标：${fields.goals || '未填写'}`,
    `核心知识点：${keyPoints || '未填写'}`,
    `教学风格：${fields.style || '未填写'}`,
    `互动设计：${fields.interactions || '未填写'}`
  ].join('\n');
};

const syncSession = (id) => {
  if (!id) return;
  sessionId.value = id;
  localStorage.setItem('sessionId', id);
};

const appendMessage = (role, text) => {
  messages.value.push({ role, text });
};

const handleSend = async (text) => {
  appendMessage('user', text);
  try {
    const data = await sendMessage({ sessionId: sessionId.value, text });
    syncSession(data.sessionId);
    if (data.reply) appendMessage('assistant', data.reply);
    if (data.state) summary.value = buildSummary(data.state);
    if (data.intent) intent.value = data.intent;
    if (data.draft) draft.value = data.draft;
  } catch (error) {
    appendMessage('assistant', '请求失败，请检查服务是否运行。');
  }
};

const handleUpload = async (selectedFiles) => {
  try {
    const data = await uploadFiles({ sessionId: sessionId.value, files: selectedFiles });
    syncSession(data.sessionId);
    if (data.files?.length) files.value.push(...data.files);
    appendMessage('assistant', data.message || '文件上传完成。');
  } catch (error) {
    appendMessage('assistant', '上传失败，请稍后重试。');
  }
};

const handleClear = () => {
  messages.value = [];
  summary.value = '暂无';
  draft.value = null;
  files.value = [];
  intent.value = null;
  sessionId.value = '';
  localStorage.removeItem('sessionId');
  appendMessage('assistant', '对话已清空，可以重新描述需求。');
};

const handleConfirm = async () => {
  await handleSend('确认');
};

onMounted(async () => {
  appendMessage('assistant', '你好！请描述你的教学目标和需求，我会逐步澄清并生成课件初稿。');
  try {
    const data = await getStatus();
    if (data.ok) {
      status.value = data.llmConfigured ? '运行中 · 模型已连接' : '运行中 · 未配置模型';
    } else {
      status.value = '不可用';
    }
  } catch (error) {
    status.value = '离线';
  }
});
</script>

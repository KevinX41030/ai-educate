<template>
  <div class="app">
    <HeroHeader :status="status" />
    <main class="layout toc-layout">
      <aside class="toc">
        <div class="toc-card">
          <div class="toc-title">目录导航</div>
          <a href="#section-intent">教学需求</a>
          <a href="#section-chat">多轮对话</a>
          <a href="#section-preview">课件预览</a>
          <a href="#section-summary">需求摘要</a>
          <a href="#section-confirm">需求确认</a>
          <a href="#section-slides">PPT 结构</a>
          <a href="#section-plan">教案草稿</a>
          <a href="#section-interaction">互动设计</a>
          <a href="#section-rag">知识库引用</a>
        </div>
        <div class="toc-card" v-if="draft && draft.ppt && draft.ppt.length">
          <div class="toc-title">PPT 目录</div>
          <a v-for="(slide, index) in draft.ppt" :key="slide.id" :href="`#slide-${index + 1}`">
            {{ index + 1 }}. {{ slide.title }}
          </a>
        </div>
      </aside>
      <div class="content">
        <div class="content-head">
          <div>
            <h2>生成工作区</h2>
            <p>按章节式浏览教学需求、对话与课件产出。</p>
          </div>
          <div class="workspace-actions">
            <button class="ghost" @click="handleClear">重置会话</button>
            <button class="primary" @click="handleExport">导出课件</button>
          </div>
        </div>
        <div class="content-surface">
          <section id="section-intent" class="doc-section">
            <IntentPanel
              :fields="fields"
              :intent="intent"
              :on-submit="handleFormSubmit"
              :on-reset="handleClear"
            />
          </section>
          <section id="section-chat" class="doc-section">
            <ChatPanel
              :messages="messages"
              :files="files"
              :on-send="handleSend"
              :on-clear="handleClear"
              :on-upload="handleUpload"
            />
          </section>
          <section id="section-preview" class="doc-section">
            <PreviewPanel
              :summary="summary"
              :draft="draft"
              :intent="intent"
              :rag="rag"
              :on-confirm="handleConfirm"
              :on-export="handleExport"
            />
          </section>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import HeroHeader from './components/HeroHeader.vue';
import IntentPanel from './components/IntentPanel.vue';
import ChatPanel from './components/ChatPanel.vue';
import PreviewPanel from './components/PreviewPanel.vue';
import { getStatus, sendMessage, uploadFiles, exportPptx } from './services/api';

const status = ref('准备就绪');
const sessionId = ref(localStorage.getItem('sessionId') || '');
const messages = ref([]);
const files = ref([]);
const summary = ref('暂无');
const draft = ref(null);
const intent = ref(null);
const rag = ref([]);
const fields = ref({
  subject: '',
  grade: '',
  duration: '',
  goals: '',
  keyPoints: [],
  style: '',
  interactions: ''
});

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
    if (data.rag) rag.value = data.rag;
    if (data.state?.fields) fields.value = data.state.fields;
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
  rag.value = [];
  fields.value = {
    subject: '',
    grade: '',
    duration: '',
    goals: '',
    keyPoints: [],
    style: '',
    interactions: ''
  };
  sessionId.value = '';
  localStorage.removeItem('sessionId');
  appendMessage('assistant', '对话已清空，可以重新描述需求。');
};

const handleFormSubmit = async (text) => {
  await handleSend(text);
};

const handleConfirm = async () => {
  await handleSend('确认');
};

const handleExport = async () => {
  if (!draft.value) {
    appendMessage('assistant', '请先生成课件初稿，再导出。');
    return;
  }
  try {
    const response = await exportPptx({ sessionId: sessionId.value, draft: draft.value, useAi: true });
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const fileName = match ? match[1] : `lesson-${Date.now()}.pptx`;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    appendMessage('assistant', 'PPTX 已生成并下载。');
  } catch (error) {
    appendMessage('assistant', '导出失败，请稍后重试。');
  }
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

import { computed, ref } from 'vue';
import {
  exportPptx,
  getSessionSnapshot,
  getStatus,
  regeneratePptScene,
  sendMessage,
  uploadFiles
} from '../services/api';

const REQUIRED_FIELDS = ['subject', 'grade', 'duration', 'goals', 'keyPoints'];

const FIELD_LABELS = {
  subject: '主题/章节',
  grade: '年级/学段',
  duration: '课堂时长',
  goals: '教学目标',
  keyPoints: '核心知识点',
  style: '教学风格',
  interactions: '互动设计'
};

const emptyFields = () => ({
  subject: '',
  grade: '',
  duration: '',
  goals: '',
  keyPoints: [],
  style: '',
  interactions: ''
});

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => `${item}`.trim()).filter(Boolean);
  }

  return `${value || ''}`
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeFields = (rawFields = {}) => ({
  ...emptyFields(),
  ...rawFields,
  keyPoints: normalizeList(rawFields.keyPoints)
});

const buildMissingFields = (currentFields) =>
  REQUIRED_FIELDS.filter((field) => {
    if (field === 'keyPoints') return normalizeList(currentFields.keyPoints).length === 0;
    return !currentFields[field];
  });

const buildIntentPayload = (state = {}) => {
  const nextFields = normalizeFields(state.fields);
  return {
    fields: nextFields,
    missingFields: buildMissingFields(nextFields),
    ready: Boolean(state.ready),
    confirmed: Boolean(state.confirmed),
    sceneStatus: state.sceneStatus || 'idle'
  };
};

const buildSummary = (source) => {
  const currentFields = normalizeFields(source?.fields || source || {});
  const keyPoints = normalizeList(currentFields.keyPoints);

  return [
    `主题/章节：${currentFields.subject || '未填写'}`,
    `年级/学段：${currentFields.grade || '未填写'}`,
    `课堂时长：${currentFields.duration || '未填写'}`,
    `教学目标：${currentFields.goals || '未填写'}`,
    `核心知识点：${keyPoints.join('、') || '未填写'}`,
    `教学风格：${currentFields.style || '未填写'}`,
    `互动设计：${currentFields.interactions || '未填写'}`
  ].join('\n');
};

const status = ref('准备就绪');
const sessionId = ref(localStorage.getItem('sessionId') || '');
const messages = ref([]);
const files = ref([]);
const summary = ref('暂无');
const draft = ref(null);
const scene = ref(null);
const sceneStatus = ref('idle');
const intent = ref(buildIntentPayload({ fields: emptyFields() }));
const rag = ref([]);
const fields = ref(emptyFields());
const initialized = ref(false);
const isBusy = ref(false);
const isAutoGenerating = ref(false);
const isEnhancingScene = ref(false);
const isStreamingReply = ref(false);
const sceneRefreshKey = ref('');
let streamToken = 0;

const wait = (delay) => new Promise((resolve) => window.setTimeout(resolve, delay));

const createMessage = (role, text = '') => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text
});

const cancelStreaming = () => {
  streamToken += 1;
  isStreamingReply.value = false;
};

const syncSession = (id) => {
  if (!id) return;
  sessionId.value = id;
  localStorage.setItem('sessionId', id);
};

const appendMessage = (role, text = '') => {
  const message = createMessage(role, text);
  messages.value.push(message);
  return message;
};

const streamAssistantMessage = async (text) => {
  const content = `${text || ''}`;
  if (!content) return;

  const token = ++streamToken;
  const message = appendMessage('assistant', '');
  const chars = Array.from(content);
  const chunkSize = chars.length > 280 ? 8 : chars.length > 160 ? 6 : chars.length > 80 ? 4 : 2;

  isStreamingReply.value = true;

  try {
    for (let cursor = 0; cursor < chars.length; cursor += chunkSize) {
      if (token !== streamToken) return;

      const nextChunk = chars.slice(cursor, cursor + chunkSize).join('');
      message.text += nextChunk;

      const lastChar = nextChunk.at(-1) || '';
      const delay = /[，。！？；：,.!?;:\n]/.test(lastChar) ? 70 : chars.length > 280 ? 10 : 18;
      await wait(delay);
    }
  } finally {
    if (token === streamToken) {
      isStreamingReply.value = false;
    }
  }
};

const ensureWelcomeMessage = () => {
  if (messages.value.length) return;
  appendMessage('assistant', '直接描述课程需求，我会一边和你对话，一边在右侧生成课件预览。');
};

const resetWorkspaceState = () => {
  cancelStreaming();
  summary.value = '暂无';
  draft.value = null;
  scene.value = null;
  sceneStatus.value = 'idle';
  files.value = [];
  intent.value = buildIntentPayload({ fields: emptyFields() });
  rag.value = [];
  fields.value = emptyFields();
  sessionId.value = '';
  sceneRefreshKey.value = '';
  isAutoGenerating.value = false;
  localStorage.removeItem('sessionId');
};

const applyStatePayload = (state = {}, explicitIntent = null) => {
  fields.value = normalizeFields(state.fields);
  summary.value = buildSummary(fields.value);
  draft.value = state.draft || null;
  scene.value = state.scene || null;
  sceneStatus.value = state.sceneStatus || 'idle';
  files.value = Array.isArray(state.uploadedFiles) ? state.uploadedFiles : files.value;
  rag.value = Array.isArray(state.rag) ? state.rag : [];
  intent.value = explicitIntent || buildIntentPayload(state);
};

const maybeEnhanceScene = async () => {
  const draftUpdatedAt = draft.value?.updatedAt;
  if (!draft.value || sceneStatus.value !== 'stale' || isEnhancingScene.value) return;
  if (draftUpdatedAt && sceneRefreshKey.value === draftUpdatedAt) return;

  isEnhancingScene.value = true;
  sceneStatus.value = 'generating';
  sceneRefreshKey.value = draftUpdatedAt || `${Date.now()}`;

  try {
    const data = await regeneratePptScene({ sessionId: sessionId.value, draft: draft.value, force: true });
    syncSession(data.sessionId);
    if (data.scene) scene.value = data.scene;
    sceneStatus.value = 'ready';
  } catch (error) {
    sceneStatus.value = scene.value ? 'stale' : 'idle';
    sceneRefreshKey.value = '';
  } finally {
    isEnhancingScene.value = false;
  }
};

const applyChatPayload = async (data) => {
  syncSession(data.sessionId);

  if (data.state) {
    applyStatePayload(data.state, data.intent || null);
  } else if (data.intent) {
    intent.value = data.intent;
  }

  if (data.draft) draft.value = data.draft;
  if (data.scene) scene.value = data.scene;
  if (data.sceneStatus) sceneStatus.value = data.sceneStatus;
  if (Array.isArray(data.rag)) rag.value = data.rag;
  if (data.reply) await streamAssistantMessage(data.reply);

  if (draft.value && sceneStatus.value === 'stale') {
    void maybeEnhanceScene();
  }
};

const sendInternal = async (text, options = {}) => {
  const trimmed = `${text || ''}`.trim();
  const { appendUser = true, autoGenerate = true } = options;

  if (!trimmed || isBusy.value) return null;

  if (appendUser) appendMessage('user', trimmed);
  isBusy.value = true;

  try {
    const data = await sendMessage({ sessionId: sessionId.value, text: trimmed });
    isBusy.value = false;
    await applyChatPayload(data);

    if (autoGenerate && data.intent?.ready && !data.intent?.confirmed && !data.draft) {
      isAutoGenerating.value = true;
      appendMessage('assistant', '信息已经齐全，正在为你生成课件初稿…');

      const confirmData = await sendMessage({ sessionId: sessionId.value, text: '确认' });
      isAutoGenerating.value = false;
      await applyChatPayload(confirmData);
    }

    return data;
  } catch (error) {
    appendMessage('assistant', '请求失败，请检查服务是否运行。');
    return null;
  } finally {
    isBusy.value = false;
    isAutoGenerating.value = false;
  }
};

const normalizedKeyPoints = computed(() => normalizeList(fields.value.keyPoints));
const missingFieldLabels = computed(() =>
  (intent.value?.missingFields || []).map((field) => FIELD_LABELS[field] || field)
);
const exportLabel = computed(() => '导出PPT');
const lessonTitle = computed(() => fields.value.subject || '未命名课件');
const keyPointPreview = computed(() => normalizedKeyPoints.value.slice(0, 3).join('、') || '待填写');
const outlineSlides = computed(() => {
  if (scene.value?.slides?.length) return scene.value.slides;
  return draft.value?.ppt ?? [];
});
const workspacePhase = computed(() => {
  if (isAutoGenerating.value) return 'AI 正在生成初稿';
  if (isBusy.value) return 'AI 正在整理需求';
  if (sceneStatus.value === 'generating') return 'AI 正在优化版式';
  if (draft.value) return '课件已生成，可继续修改';
  return '等待输入课程需求';
});

const initWorkspace = async () => {
  if (initialized.value) return;
  initialized.value = true;

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

  if (!sessionId.value) {
    ensureWelcomeMessage();
    return;
  }

  try {
    const snapshot = await getSessionSnapshot(sessionId.value);
    if (Array.isArray(snapshot.messages) && snapshot.messages.length) {
      messages.value = snapshot.messages.map((message) => createMessage(message.role, message.text));
    }
    applyStatePayload(snapshot.state || {}, snapshot.intent || null);
    if (!messages.value.length) ensureWelcomeMessage();
  } catch (error) {
    resetWorkspaceState();
    ensureWelcomeMessage();
  }
};

const startFromPrompt = async (text) => {
  messages.value = [];
  resetWorkspaceState();
  return sendInternal(text, { appendUser: true, autoGenerate: true });
};

const handleFieldChange = (key, value) => {
  const nextFields = normalizeFields({
    ...fields.value,
    [key]: value
  });

  fields.value = nextFields;
  summary.value = buildSummary(nextFields);

  const nextMissingFields = buildMissingFields(nextFields);
  intent.value = {
    ...intent.value,
    fields: nextFields,
    missingFields: nextMissingFields,
    ready: nextMissingFields.length === 0,
    confirmed: nextMissingFields.length === 0 ? Boolean(intent.value?.confirmed) : false,
    sceneStatus: sceneStatus.value
  };
};

const handleSend = async (text, options = {}) => sendInternal(text, options);

const handleUpload = async (selectedFiles) => {
  try {
    const data = await uploadFiles({ sessionId: sessionId.value, files: selectedFiles });
    syncSession(data.sessionId);
    if (data.files?.length) files.value = [...files.value, ...data.files];
    appendMessage('assistant', data.message || '文件上传完成。');
  } catch (error) {
    appendMessage('assistant', '上传失败，请稍后重试。');
  }
};

const handleClear = () => {
  messages.value = [];
  resetWorkspaceState();
  ensureWelcomeMessage();
};

const handleFormSubmit = async (text) => handleSend(text, { autoGenerate: true });

const handleConfirm = async () => {
  await sendInternal('确认', { appendUser: true, autoGenerate: false });
};

const handleRegenerateScene = async () => {
  if (!draft.value || isEnhancingScene.value) {
    if (!draft.value) appendMessage('assistant', '请先生成课件初稿，再重新排版。');
    return;
  }

  sceneRefreshKey.value = '';
  sceneStatus.value = 'stale';
  await maybeEnhanceScene();
  if (sceneStatus.value === 'ready') {
    appendMessage('assistant', '已刷新右侧预览版式。');
  }
};

const handleExport = async () => {
  if (!draft.value) {
    appendMessage('assistant', '请先生成课件初稿，再导出。');
    return;
  }

  try {
    const response = await exportPptx({
      sessionId: sessionId.value,
      draft: draft.value,
      useAi: true,
      regenerateScene: false
    });
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

export function useWorkspace() {
  return {
    status,
    sessionId,
    messages,
    files,
    summary,
    draft,
    scene,
    sceneStatus,
    intent,
    rag,
    fields,
    outlineSlides,
    normalizedKeyPoints,
    missingFieldLabels,
    exportLabel,
    lessonTitle,
    keyPointPreview,
    workspacePhase,
    isBusy,
    isAutoGenerating,
    isEnhancingScene,
    isStreamingReply,
    initWorkspace,
    startFromPrompt,
    handleFieldChange,
    handleSend,
    handleUpload,
    handleClear,
    handleFormSubmit,
    handleConfirm,
    handleRegenerateScene,
    handleExport
  };
}

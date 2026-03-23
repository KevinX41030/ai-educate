import { computed, ref } from 'vue';
import {
  exportPptx,
  getSessionSnapshot,
  getStatus,
  streamGeneratePpt,
  streamMessage,
  streamRegeneratePptScene,
  updateSessionFields,
  uploadFiles
} from '../services/api';
import { createSceneFromDraft, mergeDraftWithScene } from '../utils/pptScene';

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
  const missingFields = buildMissingFields(nextFields);
  const ready = Boolean(state.ready) || missingFields.length === 0;
  const nextAction = state.nextAction || (ready ? 'ready_to_generate' : 'ask_more');
  const showGenerateCTA = typeof state.showGenerateCTA === 'boolean'
    ? state.showGenerateCTA
    : nextAction === 'ready_to_generate';
  return {
    fields: nextFields,
    missingFields,
    ready,
    confirmed: Boolean(state.confirmed),
    sceneStatus: state.sceneStatus || 'idle',
    nextAction,
    showGenerateCTA,
    ctaLabel: state.ctaLabel || '立即生成 PPT',
    ctaReason: state.ctaReason || (ready ? '课程信息已经足够完整，可以直接开始生成。' : '')
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
const streamingDraft = ref(null);
const streamingScene = ref(null);
const streamingSceneStatus = ref('idle');
const intent = ref(buildIntentPayload({ fields: emptyFields() }));
const rag = ref([]);
const fields = ref(emptyFields());
const initialized = ref(false);
const isBusy = ref(false);
const isAutoGenerating = ref(false);
const isEnhancingScene = ref(false);
const sceneRefreshKey = ref('');

const clearStreamingPreview = () => {
  streamingDraft.value = null;
  streamingScene.value = null;
  streamingSceneStatus.value = 'idle';
};

const applyStreamingPreview = (data = {}) => {
  if (!data?.draft) return;
  streamingDraft.value = data.draft;
  streamingScene.value = data.scene || createSceneFromDraft(data.draft);
  streamingSceneStatus.value = data.sceneStatus || 'drafting';
};

const displayDraft = computed(() => streamingDraft.value || draft.value);
const displayScene = computed(() => streamingScene.value || scene.value);
const displaySceneStatus = computed(() => (streamingDraft.value ? streamingSceneStatus.value : sceneStatus.value));

const ensureLocalScene = () => {
  if (scene.value?.slides?.length) return scene.value;
  if (!draft.value) return null;
  const fallbackScene = createSceneFromDraft(draft.value);
  if (fallbackScene) {
    scene.value = fallbackScene;
  }
  return scene.value;
};

const createMessage = (role, text = '') => ({
  id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  role,
  text
});

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

const updateMessageText = (messageId, text = '') => {
  const message = messages.value.find((item) => item.id === messageId);
  if (message) {
    message.text = text;
  }
  return message;
};

const ensureWelcomeMessage = () => {
  if (messages.value.length) return;
  appendMessage('assistant', '直接描述课程需求，我会帮你生成 PPT，并同步更新页面预览。');
};

const resetWorkspaceState = () => {
  summary.value = '暂无';
  draft.value = null;
  scene.value = null;
  sceneStatus.value = 'idle';
  clearStreamingPreview();
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
  clearStreamingPreview();
  fields.value = normalizeFields(state.fields);
  summary.value = buildSummary(fields.value);
  draft.value = state.draft || null;
  scene.value = state.scene || null;
  if (!scene.value && draft.value) {
    scene.value = createSceneFromDraft(draft.value);
  }
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
    let finalData = null;
    await streamRegeneratePptScene({
      sessionId: sessionId.value,
      draft: draft.value,
      scene: ensureLocalScene(),
      force: true,
      onEvent: ({ event, data }) => {
        if (event === 'result') {
          finalData = data;
        }
      }
    });

    const data = finalData;
    if (!data) throw new Error('scene_regenerate_failed');
    syncSession(data.sessionId);
    if (data.draft) draft.value = data.draft;
    if (data.scene) scene.value = data.scene;
    sceneStatus.value = 'ready';
  } catch (error) {
    sceneStatus.value = scene.value ? 'stale' : 'idle';
    sceneRefreshKey.value = '';
  } finally {
    isEnhancingScene.value = false;
  }
};

const applyChatPayload = (data, options = {}) => {
  const { assistantMessageId = '' } = options;
  clearStreamingPreview();
  syncSession(data.sessionId);

  if (data.state) {
    applyStatePayload(data.state, data.intent || null);
  } else if (data.intent) {
    intent.value = data.intent;
  }

  if (data.draft) draft.value = data.draft;
  if (data.scene) scene.value = data.scene;
  if (!scene.value && draft.value) {
    scene.value = createSceneFromDraft(draft.value);
  }
  if (data.sceneStatus) sceneStatus.value = data.sceneStatus;
  if (Array.isArray(data.rag)) rag.value = data.rag;
  if (data.reply) {
    if (assistantMessageId) {
      updateMessageText(assistantMessageId, data.reply);
    } else {
      appendMessage('assistant', data.reply);
    }
  }

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
  let assistantMessage = null;

  try {
    const syncedScene = draft.value ? ensureLocalScene() : null;
    assistantMessage = appendMessage('assistant', '正在理解你的课程需求…');
    let finalData = null;
    let streamedReply = '';
    let hasReplyDelta = false;

    await streamMessage({
      sessionId: sessionId.value,
      text: trimmed,
      draft: draft.value,
      scene: syncedScene,
      onEvent: ({ event, data }) => {
        if (event === 'ping' || event === 'model_delta') {
          return;
        }
        if (event === 'status') {
          if (!hasReplyDelta) {
            updateMessageText(assistantMessage.id, data?.text || '正在理解你的课程需求…');
          }
          return;
        }
        if (event === 'reply_delta') {
          hasReplyDelta = true;
          streamedReply += data?.delta || '';
          updateMessageText(assistantMessage.id, streamedReply || '正在理解你的课程需求…');
          return;
        }
        if (event === 'error') {
          if (!hasReplyDelta) {
            updateMessageText(assistantMessage.id, data?.fallbackReply || data?.message || '请求失败，请检查服务是否运行。');
          }
          return;
        }
        if (event === 'result') {
          finalData = data;
          applyChatPayload(data, { assistantMessageId: assistantMessage.id });
        }
      }
    });

    return finalData;
  } catch (error) {
    if (assistantMessage) {
      updateMessageText(assistantMessage.id, '请求失败，请检查服务是否运行。');
    } else {
      appendMessage('assistant', '请求失败，请检查服务是否运行。');
    }
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
const canGeneratePpt = computed(() => {
  if (typeof intent.value?.showGenerateCTA === 'boolean') {
    return intent.value.showGenerateCTA;
  }
  return Boolean(intent.value?.ready);
});
const generateCtaLabel = computed(() => intent.value?.ctaLabel || '立即生成 PPT');
const generateCtaReason = computed(() => intent.value?.ctaReason || '课程信息已经足够完整，可以直接开始生成。');
const lessonTitle = computed(() => fields.value.subject || '未命名课件');
const keyPointPreview = computed(() => normalizedKeyPoints.value.slice(0, 3).join('、') || '待填写');
const outlineSlides = computed(() => {
  if (displayScene.value?.slides?.length) return displayScene.value.slides;
  return displayDraft.value?.ppt ?? [];
});
const workspacePhase = computed(() => {
  if (isAutoGenerating.value && displayDraft.value?.ppt?.length) return 'AI 正在逐页生成';
  if (isAutoGenerating.value) return 'AI 正在生成 PPT';
  if (isBusy.value) return 'AI 正在整理需求';
  if (displaySceneStatus.value === 'drafting') return 'AI 正在逐页生成';
  if (sceneStatus.value === 'generating') return 'AI 正在优化版式';
  if (draft.value) return 'PPT 已生成，可继续修改';
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
  intent.value = buildIntentPayload({
    ...intent.value,
    fields: nextFields,
    missingFields: nextMissingFields,
    ready: nextMissingFields.length === 0,
    confirmed: nextMissingFields.length === 0 ? Boolean(intent.value?.confirmed) : false,
    sceneStatus: sceneStatus.value
  });
};

const syncFields = async () => {
  const normalizedFields = normalizeFields(fields.value);
  fields.value = normalizedFields;
  summary.value = buildSummary(normalizedFields);

  const data = await updateSessionFields({
    sessionId: sessionId.value,
    fields: normalizedFields
  });

  syncSession(data.sessionId);
  applyStatePayload(data.state || {}, data.intent || null);
  return data;
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
  if (isBusy.value || isAutoGenerating.value) return null;

  isAutoGenerating.value = true;
  clearStreamingPreview();
  let assistantMessage = null;
  let previewStarted = false;

  try {
    assistantMessage = appendMessage('assistant', '正在生成 PPT…');
    let finalData = null;

    await streamGeneratePpt({
      sessionId: sessionId.value,
      fields: fields.value,
      draft: draft.value,
      scene: draft.value ? ensureLocalScene() : null,
      onEvent: ({ event, data }) => {
        if (event === 'status') {
          if (!previewStarted) {
            updateMessageText(assistantMessage.id, data?.text || '正在生成 PPT…');
          }
          return;
        }
        if (event === 'draft_preview') {
          previewStarted = true;
          applyStreamingPreview(data);
          updateMessageText(assistantMessage.id, data?.text || `正在逐页生成预览，已完成 ${data?.slideCount || 0} 页…`);
          return;
        }
        if (event === 'error') {
          clearStreamingPreview();
          updateMessageText(assistantMessage.id, data?.message || '生成失败，请稍后重试。');
          return;
        }
        if (event === 'result') {
          finalData = data;
          clearStreamingPreview();
          applyChatPayload(data, { assistantMessageId: assistantMessage.id });
        }
      }
    });

    return finalData;
  } catch (error) {
    clearStreamingPreview();
    if (assistantMessage) {
      updateMessageText(assistantMessage.id, '生成失败，请稍后重试。');
    } else {
      appendMessage('assistant', '生成失败，请稍后重试。');
    }
    return null;
  } finally {
    isAutoGenerating.value = false;
  }
};

const handleRegenerateScene = async () => {
  if (!draft.value || isEnhancingScene.value) {
    if (!draft.value) appendMessage('assistant', '请先生成 PPT，再重新排版。');
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
    appendMessage('assistant', '请先生成 PPT，再导出。');
    return;
  }

  try {
    const response = await exportPptx({
      sessionId: sessionId.value,
      draft: draft.value,
      scene: ensureLocalScene(),
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
    displayDraft,
    displayScene,
    displaySceneStatus,
    intent,
    rag,
    fields,
    outlineSlides,
    normalizedKeyPoints,
    missingFieldLabels,
    exportLabel,
    canGeneratePpt,
    generateCtaLabel,
    generateCtaReason,
    lessonTitle,
    keyPointPreview,
    workspacePhase,
    isBusy,
    isAutoGenerating,
    isEnhancingScene,
    initWorkspace,
    startFromPrompt,
    syncFields,
    handleFieldChange,
    handleSend,
    handleUpload,
    handleClear,
    handleFormSubmit,
    handleConfirm,
    handleRegenerateScene,
    handleExport,
    ensureLocalScene,
    mergeDraftWithScene
  };
}

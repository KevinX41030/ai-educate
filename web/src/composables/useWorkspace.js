import { computed, ref } from 'vue';
import { getStatus, sendMessage, uploadFiles, exportPptx, regeneratePptScene } from '../services/api';

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

const status = ref('准备就绪');
const sessionId = ref(localStorage.getItem('sessionId') || '');
const messages = ref([]);
const files = ref([]);
const summary = ref('暂无');
const draft = ref(null);
const scene = ref(null);
const sceneStatus = ref('idle');
const exportMode = ref('editable');
const intent = ref(null);
const rag = ref([]);
const fields = ref(emptyFields());
const initialized = ref(false);

const buildSummary = (state) => {
  if (!state) return '暂无';
  const currentFields = state.fields || {};
  const keyPoints = Array.isArray(currentFields.keyPoints) ? currentFields.keyPoints.join('、') : '';
  return [
    `主题/章节：${currentFields.subject || '未填写'}`,
    `年级/学段：${currentFields.grade || '未填写'}`,
    `课堂时长：${currentFields.duration || '未填写'}`,
    `教学目标：${currentFields.goals || '未填写'}`,
    `核心知识点：${keyPoints || '未填写'}`,
    `教学风格：${currentFields.style || '未填写'}`,
    `互动设计：${currentFields.interactions || '未填写'}`
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

const resetWorkspaceState = () => {
  summary.value = '暂无';
  draft.value = null;
  scene.value = null;
  sceneStatus.value = 'idle';
  files.value = [];
  intent.value = null;
  rag.value = [];
  exportMode.value = 'editable';
  fields.value = emptyFields();
  sessionId.value = '';
  localStorage.removeItem('sessionId');
};

const outlineSlides = computed(() => {
  if (scene.value?.slides?.length) return scene.value.slides;
  return draft.value?.ppt ?? [];
});

const normalizedKeyPoints = computed(() => normalizeList(fields.value.keyPoints));
const missingFieldLabels = computed(() =>
  (intent.value?.missingFields || []).map((field) => FIELD_LABELS[field] || field)
);
const hasUserMessages = computed(() => messages.value.some((message) => message.role === 'user'));
const exportLabel = computed(() => exportMode.value === 'hybrid' ? '导出混合版' : '导出可编辑版');
const lessonTitle = computed(() => fields.value.subject || '未命名课件');
const keyPointPreview = computed(() => normalizedKeyPoints.value.slice(0, 3).join('、') || '待填写');

const stepItems = computed(() => {
  const items = [
    {
      id: 'basics',
      index: '01',
      label: '基础信息',
      description: '主题、年级、课时',
      done: Boolean(fields.value.subject && fields.value.grade && fields.value.duration),
      path: '/create'
    },
    {
      id: 'goals',
      index: '02',
      label: '目标与重点',
      description: '教学目标、知识点',
      done: Boolean(fields.value.goals && normalizedKeyPoints.value.length),
      path: '/create'
    },
    {
      id: 'copilot',
      index: '03',
      label: 'AI 共创',
      description: '对话补全、资料上传',
      done: Boolean(hasUserMessages.value || files.value.length),
      path: '/copilot'
    },
    {
      id: 'confirm',
      index: '04',
      label: '确认生成',
      description: '检查缺失项并生成',
      done: Boolean(intent.value?.ready || intent.value?.confirmed),
      path: '/preview'
    },
    {
      id: 'preview',
      index: '05',
      label: '预览导出',
      description: '查看页面并导出',
      done: Boolean(draft.value),
      path: '/preview'
    }
  ];

  return items.map((item) => ({
    ...item,
    stateLabel: item.done ? '已完成' : '待处理'
  }));
});

const completedStepCount = computed(() => stepItems.value.filter((step) => step.done).length);
const progressPercent = computed(() => (completedStepCount.value / stepItems.value.length) * 100);
const progressText = computed(() => `${completedStepCount.value}/${stepItems.value.length} 步已完成`);
const activeStep = computed(() => stepItems.value.find((step) => !step.done) || stepItems.value[stepItems.value.length - 1]);
const activeStepLabel = computed(() => activeStep.value?.label || '预览导出');

const initWorkspace = async () => {
  if (initialized.value) return;
  initialized.value = true;

  if (!messages.value.length) {
    appendMessage('assistant', '欢迎使用。请先填写课程信息，或在共创页继续补充教学要求，我会基于你的输入生成课件内容。');
  }

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
};

const handleExportModeChange = (mode) => {
  exportMode.value = mode;
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
    scene.value = data.scene || null;
    sceneStatus.value = data.sceneStatus || data.state?.sceneStatus || 'idle';
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
  resetWorkspaceState();
  appendMessage('assistant', '对话已清空，可以重新描述需求。');
};

const handleFormSubmit = async (text) => {
  await handleSend(text);
};

const handleConfirm = async () => {
  await handleSend('确认');
};

const handleRegenerateScene = async () => {
  if (!draft.value) {
    appendMessage('assistant', '请先生成课件初稿，再重新排版。');
    return;
  }

  sceneStatus.value = 'generating';
  try {
    const data = await regeneratePptScene({ sessionId: sessionId.value, draft: draft.value });
    syncSession(data.sessionId);
    scene.value = data.scene || null;
    sceneStatus.value = 'ready';
    appendMessage('assistant', data.source === 'llm' ? '已完成场景重排，预览已更新。' : '已按当前草稿刷新场景预览。');
  } catch (error) {
    sceneStatus.value = scene.value ? 'stale' : 'idle';
    appendMessage('assistant', '重新排版失败，请稍后重试。');
  }
};

const handleExport = async () => {
  if (!draft.value) {
    appendMessage('assistant', '请先生成课件初稿，再导出。');
    return;
  }
  try {
    const regenerateScene = exportMode.value === 'hybrid' && sceneStatus.value !== 'ready';
    const response = await exportPptx({
      sessionId: sessionId.value,
      draft: draft.value,
      useAi: true,
      mode: exportMode.value,
      regenerateScene
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
    appendMessage('assistant', `${exportMode.value === 'hybrid' ? '混合版' : '可编辑版'} PPTX 已生成并下载。`);
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
    exportMode,
    intent,
    rag,
    fields,
    outlineSlides,
    normalizedKeyPoints,
    missingFieldLabels,
    exportLabel,
    stepItems,
    progressPercent,
    progressText,
    activeStep,
    activeStepLabel,
    lessonTitle,
    keyPointPreview,
    initWorkspace,
    handleExportModeChange,
    handleSend,
    handleUpload,
    handleClear,
    handleFormSubmit,
    handleConfirm,
    handleRegenerateScene,
    handleExport
  };
}

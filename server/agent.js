const { nanoid } = require('nanoid');
const { extractIntentWithLLM, generateDraftWithLLM, isLLMConfigured } = require('./llm');
const { searchKnowledge } = require('./rag');
const { buildPptSceneFromDraft } = require('./ppt/scene');
const { inferDesignPreset, mergeThemeWithPreset, getDesignPresetHints } = require('./ppt/design');

const REQUIRED_FIELDS = ["subject", "grade", "duration", "goals", "keyPoints"];

const FIELD_LABELS = {
  subject: "主题/章节",
  grade: "年级/学段",
  duration: "课堂时长",
  goals: "教学目标",
  keyPoints: "核心知识点",
  style: "教学风格",
  interactions: "互动设计"
};

const FIELD_QUESTIONS = {
  subject: "这节课的主题/章节是什么？",
  grade: "面向哪个年级/学段？",
  duration: "课堂时长是多少（如45分钟）？",
  goals: "教学目标是什么？",
  keyPoints: "核心知识点有哪些？（可用逗号分隔）",
  style: "是否有偏好的教学风格或呈现风格？（可选）",
  interactions: "是否需要互动设计/小游戏？（可选）"
};

const SMALL_TALK_RESPONSES = {
  greeting: "你好！我是教学智能体，可以帮你快速生成 PPT。",
  presence: "我在的，随时可以开始。",
  identity: "我是多模态教学智能体，负责理解教学需求并生成课件草稿。",
  thanks: "不客气！需要我继续帮你完善课程吗？",
  bye: "好的，随时需要我再找我。"
};

const VALID_NEXT_ACTIONS = new Set(['ask_more', 'ready_to_generate', 'edit_existing']);

const GENERATE_READY_REPLY_PATTERNS = [
  /直接(?:开始|进入)?生成/,
  /直接点(?:击)?生成/,
  /现在(?:就)?可以(?:直接)?生成/,
  /已经可以(?:直接)?生成/,
  /可以(?:先|直接)?生成/,
  /不补(?:充)?也可以(?:直接)?生成/,
  /不填也可以(?:直接)?生成/
];

const GENERATE_BLOCKING_REPLY_PATTERNS = [
  /还差(?:一个|一些|几个)?/,
  /还需要(?:再)?/,
  /还想再确认/,
  /只想再确认/,
  /先告诉我/,
  /一句话告诉我/,
  /你更希望/,
  /为了直接进入生成.*还差/
];

function createInitialAiDecision() {
  return {
    nextAction: 'ask_more',
    showGenerateCTA: false,
    ctaLabel: '',
    ctaReason: '',
    updatedAt: ''
  };
}

function createInitialBrief() {
  return {
    rawInputs: [],
    mergedPrompt: '',
    updatedAt: ''
  };
}

function createInitialState() {
  return {
    id: nanoid(),
    fields: {
      subject: "",
      grade: "",
      duration: "",
      goals: "",
      keyPoints: [],
      style: "",
      interactions: ""
    },
    uploadedFiles: [],
    brief: createInitialBrief(),
    aiDecision: createInitialAiDecision(),
    ready: false,
    confirmed: false,
    draft: null,
    scene: null,
    sceneStatus: 'idle',
    sceneSource: '',
    sceneUpdatedAt: '',
    sceneVersion: 0,
    lastEdit: "",
    rag: []
  };
}

function normalizeBriefText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildFieldsPrompt(state) {
  const { fields = {}, uploadedFiles = [] } = state || {};
  const parts = [
    fields.subject ? `主题：${fields.subject}` : '',
    fields.grade ? `年级：${fields.grade}` : '',
    fields.duration ? `时长：${fields.duration}` : '',
    fields.goals ? `教学目标：${fields.goals}` : '',
    Array.isArray(fields.keyPoints) && fields.keyPoints.length ? `核心知识点：${fields.keyPoints.join('；')}` : '',
    fields.style ? `教学风格：${fields.style}` : '',
    fields.interactions ? `互动设计：${fields.interactions}` : '',
    uploadedFiles.length ? `参考资料：${uploadedFiles.map((file) => file.name).join('、')}` : ''
  ].filter(Boolean);

  return parts.join('\n');
}

function ensureBrief(state) {
  if (!state.brief) state.brief = createInitialBrief();
  const rawInputs = Array.isArray(state.brief.rawInputs) ? state.brief.rawInputs : [];
  const userTranscript = rawInputs.length
    ? rawInputs.map((item) => item.text).join('\n\n')
    : '';
  const fieldsPrompt = buildFieldsPrompt(state);
  state.brief.rawInputs = rawInputs;
  state.brief.mergedPrompt = [userTranscript, fieldsPrompt].filter(Boolean).join('\n\n');
  state.brief.updatedAt = new Date().toISOString();
  return state.brief;
}

function appendToBrief(state, text, source = 'user') {
  const normalized = normalizeBriefText(text);
  if (!normalized) return ensureBrief(state);
  if (getSmallTalkIntent(normalized) || isConfirm(normalized)) return ensureBrief(state);

  if (!state.brief) state.brief = createInitialBrief();
  if (!Array.isArray(state.brief.rawInputs)) state.brief.rawInputs = [];
  const last = state.brief.rawInputs[state.brief.rawInputs.length - 1];
  if (last?.text !== normalized) {
    state.brief.rawInputs.push({
      id: nanoid(),
      source,
      text: normalized,
      ts: Date.now()
    });
    state.brief.rawInputs = state.brief.rawInputs.slice(-20);
  }

  return ensureBrief(state);
}

function syncSceneFromDraft(state) {
  if (!state?.draft) {
    state.scene = null;
    state.sceneStatus = 'idle';
    state.sceneSource = '';
    state.sceneUpdatedAt = '';
    return;
  }

  const scene = buildPptSceneFromDraft(state.draft);
  state.scene = scene;
  state.sceneSource = 'draft';
  state.sceneStatus = isLLMConfigured() ? 'stale' : 'ready';
  state.sceneUpdatedAt = scene?.updatedAt || new Date().toISOString();
  state.sceneVersion = (state.sceneVersion || 0) + 1;
}

function normalizeKeyPoints(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(/[，,;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValuePairs(text) {
  const pairs = [];
  const regex = /([^\n:：=]{1,8})\s*[:：=]\s*([^\n]+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    pairs.push({ key: match[1].trim(), value: match[2].trim() });
  }
  return pairs;
}

function mapKeyToField(key) {
  const mapping = {
    "主题": "subject",
    "课程主题": "subject",
    "课程内容": "subject",
    "课程": "subject",
    "课题": "subject",
    "章节": "subject",
    "单元": "subject",
    "课文": "subject",
    "科目": "subject",
    "授课对象": "grade",
    "年级": "grade",
    "学段": "grade",
    "对象": "grade",
    "时长": "duration",
    "课时": "duration",
    "目标": "goals",
    "教学目标": "goals",
    "知识点": "keyPoints",
    "要点": "keyPoints",
    "重点": "keyPoints",
    "难点": "keyPoints",
    "风格": "style",
    "形式": "style",
    "呈现": "style",
    "互动": "interactions",
    "活动设计": "interactions",
    "活动": "interactions"
  };
  return mapping[key] || "";
}

function detectGrade(text) {
  const gradePatterns = [
    /(小学|初中|高中|大学|研究生|本科|硕士|博士)/,
    /(初一|初二|初三|高一|高二|高三)/,
    /([一二三四五六七八九]年级)/,
    /(K\d{1,2})/i
  ];
  for (const pattern of gradePatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return "";
}

function detectDuration(text) {
  const minMatch = text.match(/(\d{1,3})\s*(分钟|min)/);
  if (minMatch) return `${minMatch[1]}分钟`;
  const hourMatch = text.match(/(\d{1,2}(?:\.\d)?)\s*(小时|h)/i);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    if (!Number.isNaN(hours)) {
      const minutes = Math.round(hours * 60);
      return `${minutes}分钟`;
    }
  }
  return "";
}

function detectSubject(text) {
  const patterns = [
    /(主题|课程|课题|章节|单元|课文)\s*(是|为|：|:)?\s*([^。\n;；]+)/,
    /(关于|讲|讲授|讲解|教授)\s*([^。\n;；，,]{2,30})/,
    /一节\s*([^。\n;；，,]{2,30})\s*课/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const candidate = (match[3] || match[2] || match[1] || "").trim();
      if (!candidate) continue;
      if (/(分钟|年级|小学|初中|高中|大学)/.test(candidate)) continue;
      return candidate;
    }
  }
  return "";
}

function detectGoals(text) {
  const goalMatch = text.match(/(教学目标|目标|目的|希望学生|要求学生|学习目标)\s*(是|为|：|:)?\s*([^。\n;；]+)/);
  if (goalMatch) return goalMatch[3].trim();
  return "";
}

function detectKeyPoints(text) {
  const kpMatch = text.match(/(知识点|要点|重点|难点|包含|包括|涉及|内容包括)\s*(是|为|：|:)?\s*([^。\n;；]+)/);
  if (kpMatch) return normalizeKeyPoints(kpMatch[3]);
  return [];
}

function detectStyle(text) {
  const styleMatch = text.match(/(教学风格|风格|呈现|形式|语气|课堂形式)\s*(是|为|：|:)?\s*([^。\n;；]+)/);
  if (styleMatch) return styleMatch[3].trim();
  return "";
}

function detectInteractions(text) {
  const interactionMatch = text.match(/(互动|活动|小游戏|讨论|实验|小组)\s*(是|为|：|:)?\s*([^。\n;；]+)?/);
  if (interactionMatch) {
    return interactionMatch[3] ? interactionMatch[3].trim() : interactionMatch[1];
  }
  return "";
}

function extractFieldsFromText(text, state) {
  const pairs = parseKeyValuePairs(text);
  for (const pair of pairs) {
    const field = mapKeyToField(pair.key);
    if (!field) continue;
    if (field === "keyPoints") {
      state.fields.keyPoints = normalizeKeyPoints(pair.value);
    } else {
      state.fields[field] = pair.value;
    }
  }

  if (!state.fields.duration) {
    const duration = detectDuration(text);
    if (duration) state.fields.duration = duration;
  }

  if (!state.fields.subject) {
    const subject = detectSubject(text);
    if (subject) state.fields.subject = subject;
  }

  if (!state.fields.grade) {
    const grade = detectGrade(text);
    if (grade) state.fields.grade = grade;
  }

  if (!state.fields.goals) {
    const goals = detectGoals(text);
    if (goals) state.fields.goals = goals;
  }

  if (state.fields.keyPoints.length === 0) {
    const keyPoints = detectKeyPoints(text);
    if (keyPoints.length) state.fields.keyPoints = keyPoints;
  }

  if (!state.fields.style) {
    const style = detectStyle(text);
    if (style) state.fields.style = style;
  }

  if (!state.fields.interactions) {
    const interactions = detectInteractions(text);
    if (interactions) state.fields.interactions = interactions;
  }
}

function mergeFields(state, fields) {
  if (!fields) return;
  const entries = Object.entries(fields);
  for (const [key, value] of entries) {
    if (value === null || value === undefined) continue;
    if (key === "keyPoints") {
      const normalized = normalizeKeyPoints(value);
      if (normalized.length) state.fields.keyPoints = normalized;
      continue;
    }
    if (typeof value === "string" && value.trim()) {
      state.fields[key] = value.trim();
    }
  }
  ensureBrief(state);
}

function buildSummary(state) {
  const { fields } = state;
  return [
    `主题/章节：${fields.subject || "未填写"}`,
    `年级/学段：${fields.grade || "未填写"}`,
    `课堂时长：${fields.duration || "未填写"}`,
    `教学目标：${fields.goals || "未填写"}`,
    `核心知识点：${fields.keyPoints.length ? fields.keyPoints.join("、") : "未填写"}`,
    `教学风格：${fields.style || "未填写"}`,
    `互动设计：${fields.interactions || "未填写"}`
  ].join("\n");
}

function joinNaturalList(items = []) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return '';
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]}和${filtered[1]}`;
  return `${filtered.slice(0, -1).join('、')}，以及${filtered[filtered.length - 1]}`;
}

function buildCollectedFieldSummary(state) {
  const { fields } = state;
  const parts = [];
  if (fields.subject) parts.push(`主题是“${fields.subject}”`);
  if (fields.grade) parts.push(`面向${fields.grade}`);
  if (fields.duration) parts.push(`课时大约${fields.duration}`);
  if (fields.goals) parts.push('教学目标我已经记下了');
  if (fields.keyPoints.length) parts.push(`核心知识点我已经抓到 ${fields.keyPoints.length} 个`);
  if (fields.style) parts.push(`风格会偏“${fields.style}”`);
  if (fields.interactions) parts.push('互动设计也已经纳入考虑');
  return joinNaturalList(parts);
}

function buildMissingFieldsReply(state) {
  const missingFields = getMissingFields(state);
  if (!missingFields.length) {
    return '核心信息已经齐了，现在就可以直接点“生成 PPT”。如果你愿意，我也可以继续帮你补课堂风格、互动形式或练习设计。';
  }

  const collectedSummary = buildCollectedFieldSummary(state);
  const focusFields = missingFields.slice(0, 2);
  const focusLabels = joinNaturalList(focusFields.map((field) => FIELD_LABELS[field] || field));
  const optionalLabels = [];
  if (!state.fields.style) optionalLabels.push(FIELD_LABELS.style);
  if (!state.fields.interactions) optionalLabels.push(FIELD_LABELS.interactions);

  const intro = collectedSummary
    ? `我先接住了你的关键信息：${collectedSummary}。`
    : '你可以直接把课程需求整段发给我，我会边聊边替你整理成可生成的课件需求。';

  const askLine = focusFields.length === 1
    ? `现在最关键还差 ${focusLabels}，你直接用一句话告诉我就行。`
    : `现在最关键还差 ${focusLabels}，你可以直接一句话补给我，我来继续往下整理。`;

  const hintLine = missingFields.includes('goals') && missingFields.includes('keyPoints')
    ? '比如你可以直接回：教学目标是……；核心知识点包括……。'
    : '不需要按表格填，直接自然说给我就可以。';

  const optionalLine = optionalLabels.length
    ? `如果你对${joinNaturalList(optionalLabels)}有偏好，也可以顺手带上；没有的话我会先按通用优质课思路起稿。`
    : '';

  return [intro, askLine, hintLine, optionalLine].filter(Boolean).join(' ');
}

function buildReadyReply(state) {
  const collectedSummary = buildCollectedFieldSummary(state);
  const intro = collectedSummary
    ? `我已经把这节课的需求整理得差不多了：${collectedSummary}。`
    : '我已经把这节课的核心需求整理好了。';

  const nextStep = (!state.fields.style || !state.fields.interactions)
    ? '现在就可以直接点“生成 PPT”。如果你还想补教学风格、互动形式或案例偏好，也可以继续说；不补我也能先出第一版。'
    : '现在就可以直接点“生成 PPT”；如果你还想加实验、案例或练习，我也能继续细化。';

  return `${intro} ${nextStep}`;
}

function buildRagQuery(state) {
  const { fields } = state;
  const parts = [
    fields.subject,
    fields.goals,
    Array.isArray(fields.keyPoints) ? fields.keyPoints.join(' ') : ''
  ];
  return parts.filter(Boolean).join(' ');
}

function getMissingFields(state) {
  return REQUIRED_FIELDS.filter((field) => {
    if (field === "keyPoints") return state.fields.keyPoints.length === 0;
    return !state.fields[field];
  });
}

function buildFallbackAiDecision(state) {
  if (state?.draft) {
    return {
      nextAction: 'edit_existing',
      showGenerateCTA: false,
      ctaLabel: '查看 PPT',
      ctaReason: '当前草稿已生成，可以继续调整或查看页面。'
    };
  }

  const missingFields = getMissingFields(state);
  if (missingFields.length === 0) {
    return {
      nextAction: 'ready_to_generate',
      showGenerateCTA: true,
      ctaLabel: '立即生成 PPT',
      ctaReason: '课程信息已经足够完整，可以直接开始生成。'
    };
  }

  return {
    nextAction: 'ask_more',
    showGenerateCTA: false,
    ctaLabel: '立即生成 PPT',
    ctaReason: ''
  };
}

function replySignalsReadyToGenerate(reply = '') {
  const normalized = String(reply || '').replace(/\s+/g, '');
  if (!normalized) return false;
  return GENERATE_READY_REPLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function replyLooksBlockingForGeneration(reply = '') {
  const normalized = String(reply || '').replace(/\s+/g, '');
  if (!normalized || replySignalsReadyToGenerate(normalized)) return false;
  return GENERATE_BLOCKING_REPLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function resolveAiDecision(state) {
  const fallback = buildFallbackAiDecision(state);
  const stored = state?.aiDecision && typeof state.aiDecision === 'object' ? state.aiDecision : {};
  const hasStoredDecision = typeof stored.updatedAt === 'string' && Boolean(stored.updatedAt);
  const nextAction = hasStoredDecision && VALID_NEXT_ACTIONS.has(stored.nextAction) ? stored.nextAction : fallback.nextAction;
  const showGenerateCTA = hasStoredDecision && typeof stored.showGenerateCTA === 'boolean'
    ? stored.showGenerateCTA
    : fallback.showGenerateCTA;
  return {
    nextAction,
    showGenerateCTA: nextAction === 'ready_to_generate' ? showGenerateCTA : false,
    ctaLabel: hasStoredDecision && typeof stored.ctaLabel === 'string' && stored.ctaLabel.trim()
      ? stored.ctaLabel.trim()
      : fallback.ctaLabel,
    ctaReason: hasStoredDecision && typeof stored.ctaReason === 'string' && stored.ctaReason.trim()
      ? stored.ctaReason.trim()
      : fallback.ctaReason,
    updatedAt: hasStoredDecision ? stored.updatedAt : ''
  };
}

function applyAiDecision(state, decision = null) {
  const fallback = buildFallbackAiDecision(state);
  const raw = decision && typeof decision === 'object' ? decision : {};
  const requestedNextAction = VALID_NEXT_ACTIONS.has(raw.nextAction) ? raw.nextAction : fallback.nextAction;
  const assistantReply = typeof raw.assistantReply === 'string' ? raw.assistantReply.trim() : '';
  const nextAction = requestedNextAction === 'ready_to_generate' && replyLooksBlockingForGeneration(assistantReply)
    ? 'ask_more'
    : requestedNextAction;

  state.aiDecision = {
    nextAction,
    showGenerateCTA: nextAction === 'ready_to_generate'
      ? (typeof raw.showGenerateCTA === 'boolean' ? raw.showGenerateCTA : fallback.showGenerateCTA)
      : false,
    ctaLabel: typeof raw.ctaLabel === 'string' && raw.ctaLabel.trim()
      ? raw.ctaLabel.trim()
      : fallback.ctaLabel,
    ctaReason: typeof raw.ctaReason === 'string' && raw.ctaReason.trim()
      ? raw.ctaReason.trim()
      : fallback.ctaReason,
    updatedAt: new Date().toISOString()
  };

  return state.aiDecision;
}

function canGenerateFromState(state) {
  const decision = resolveAiDecision(state);
  return decision.nextAction === 'ready_to_generate' || getMissingFields(state).length === 0;
}

function buildIntentPayload(state) {
  const decision = resolveAiDecision(state);
  return {
    fields: state.fields,
    missingFields: getMissingFields(state),
    ready: canGenerateFromState(state),
    confirmed: state.confirmed,
    sceneStatus: state.sceneStatus || 'idle',
    nextAction: decision.nextAction,
    showGenerateCTA: decision.showGenerateCTA,
    ctaLabel: decision.ctaLabel,
    ctaReason: decision.ctaReason
  };
}

function isConfirm(text) {
  return /(确认|可以|开始|生成|好的|没问题)/.test(text) && !/不(确认|需要|生成)/.test(text);
}

function isEdit(text) {
  return /(调整|修改|简化|增加|删除|替换)/.test(text);
}

function getSmallTalkIntent(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^(你好|您好|嗨|哈喽|hello|hi|hey)(呀|啊|~|！|!|。)?$/i.test(trimmed)) return "greeting";
  if (/^(在吗|在不在|有人吗|在线吗)$/i.test(trimmed)) return "presence";
  if (/^(你是谁|你是誰|你叫什么|介绍一下)$/i.test(trimmed)) return "identity";
  if (/^(谢谢|感谢|多谢|谢了|谢谢你)(！|!|。)?$/i.test(trimmed)) return "thanks";
  if (/^(再见|拜拜|bye|goodbye)(！|!|。)?$/i.test(trimmed)) return "bye";
  return null;
}

function buildSmallTalkReply(intent, state, missingField) {
  const base = SMALL_TALK_RESPONSES[intent] || "我在的，可以继续说明你的需求。";
  if (intent === 'greeting' || intent === 'presence' || intent === 'identity') {
    if (missingField) {
      return `${base}\n\n${buildMissingFieldsReply(state)}`;
    }
    if (!state.draft) {
      return `${base}\n\n${buildReadyReply(state)}`;
    }
  }
  if (missingField && intent !== "thanks" && intent !== "bye") {
    return `${base}\n\n${buildMissingFieldsReply(state)}`;
  }
  return base;
}

function generateDraft(state) {
  const { fields } = state;
  const keyPoints = normalizeKeyPoints(fields.keyPoints);
  const slides = [];
  const designPreset = inferDesignPreset({
    style: fields.style,
    subject: fields.subject,
    grade: fields.grade,
    interactions: fields.interactions
  });
  const theme = mergeThemeWithPreset({}, designPreset);
  const layoutHints = getDesignPresetHints(designPreset);

  slides.push({
    id: nanoid(),
    title: fields.subject || "封面",
    type: "cover",
    bullets: [fields.grade, fields.duration].filter(Boolean),
    notes: state.brief?.mergedPrompt || fields.goals || ''
  });

  slides.push({
    id: nanoid(),
    title: "目录",
    type: "toc",
    bullets: keyPoints.length ? keyPoints : ["导入", "讲解", "总结"]
  });

  keyPoints.forEach((point) => {
    slides.push({
      id: nanoid(),
      title: point,
      type: "content",
      bullets: [
        "核心概念与定义",
        "示例/案例",
        "常见误区与澄清"
      ],
      example: fields.interactions || `结合“${point}”设计生活化案例说明。`,
      question: `围绕“${point}”设计一个追问，检查学生是否真正理解。`,
      visual: `为“${point}”补充示意图/流程图/结构图。`,
      notes: fields.goals || '',
      teachingGoal: fields.goals || '',
      commonMistakes: ["只记结论，不理解条件与因果", "混淆条件、原料、产物"]
    });
  });

  slides.push({
    id: nanoid(),
    title: "总结与反思",
    type: "summary",
    bullets: ["回顾关键知识点", "课堂提问", "作业提示"]
  });

  const lessonPlan = {
    goals: fields.goals || "待补充",
    process: [
      "导入：引发兴趣与问题情境",
      "讲解：知识点拆解与示例",
      "练习：小组讨论/课堂问答",
      "总结：梳理与扩展"
    ],
    methods: fields.style || "讲授 + 互动",
    activities: fields.interactions || "互动问答 / 角色扮演",
    homework: "布置与知识点相关的练习题或应用任务"
  };

  const interactionIdea = {
    title: "快速抢答小游戏",
    description: "根据知识点设计 5 道选择题，学生分组抢答，实时统计得分。"
  };

  return {
    designPreset,
    brief: state.brief || null,
    ppt: slides,
    lessonPlan,
    interactionIdea,
    theme,
    layoutHints,
    updatedAt: new Date().toISOString()
  };
}

function normalizeDraft(raw) {
  if (!raw || !Array.isArray(raw.ppt) || raw.ppt.length === 0) return null;
  const ppt = raw.ppt.map((slide) => ({
    id: nanoid(),
    title: slide.title || "未命名",
    type: slide.type || "content",
    bullets: Array.isArray(slide.bullets) ? slide.bullets : [],
    example: typeof slide.example === 'string' ? slide.example : '',
    question: typeof slide.question === 'string' ? slide.question : '',
    visual: typeof slide.visual === 'string' ? slide.visual : '',
    notes: typeof slide.notes === 'string' ? slide.notes : '',
    teachingGoal: typeof slide.teachingGoal === 'string' ? slide.teachingGoal : '',
    speakerNotes: typeof slide.speakerNotes === 'string' ? slide.speakerNotes : '',
    commonMistakes: Array.isArray(slide.commonMistakes)
      ? slide.commonMistakes.map((item) => `${item}`.trim()).filter(Boolean)
      : []
  }));

  const lessonPlan = raw.lessonPlan || {};
  const interactionIdea = raw.interactionIdea || {};
  const designPreset = inferDesignPreset({
    designPreset: raw.designPreset,
    style: lessonPlan.methods,
    subject: ppt[0]?.title,
    interactions: [interactionIdea.title, interactionIdea.description].filter(Boolean).join(' ')
  });
  const theme = mergeThemeWithPreset(raw.theme || {}, designPreset);
  const layoutHints = Array.isArray(raw.layoutHints) && raw.layoutHints.length
    ? raw.layoutHints
    : getDesignPresetHints(designPreset);

  return {
    designPreset,
    brief: raw.brief && typeof raw.brief === 'object'
      ? {
          rawInputs: Array.isArray(raw.brief.rawInputs) ? raw.brief.rawInputs : [],
          mergedPrompt: typeof raw.brief.mergedPrompt === 'string' ? raw.brief.mergedPrompt : '',
          updatedAt: typeof raw.brief.updatedAt === 'string' ? raw.brief.updatedAt : ''
        }
      : null,
    ppt,
    lessonPlan: {
      goals: lessonPlan.goals || "",
      process: Array.isArray(lessonPlan.process) ? lessonPlan.process : [],
      methods: lessonPlan.methods || "",
      activities: lessonPlan.activities || "",
      homework: lessonPlan.homework || ""
    },
    interactionIdea: {
      title: interactionIdea.title || "",
      description: interactionIdea.description || ""
    },
    theme,
    layoutHints,
    updatedAt: new Date().toISOString()
  };
}

function applyEdit(draft, text) {
  if (!draft) return draft;
  const updated = { ...draft, ppt: [...draft.ppt] };

  if (/调整顺序/.test(text)) {
    const contentSlides = updated.ppt.filter((slide) => slide.type === "content");
    contentSlides.reverse();
    const nonContent = updated.ppt.filter((slide) => slide.type !== "content");
    updated.ppt = [nonContent[0], nonContent[1], ...contentSlides, nonContent[2]];
  }

  if (/增加.*案例/.test(text)) {
    updated.ppt.splice(updated.ppt.length - 1, 0, {
      id: nanoid(),
      title: "案例拓展",
      type: "content",
      bullets: ["案例背景", "分析过程", "启发总结"]
    });
  }

  if (/简化/.test(text)) {
    updated.ppt = updated.ppt.map((slide) => ({
      ...slide,
      bullets: slide.bullets ? slide.bullets.slice(0, 2) : slide.bullets
    }));
  }

  if (/增加.*互动/.test(text)) {
    updated.interactionIdea = {
      title: "互动投票",
      description: "用投票方式快速诊断学生理解程度，并即时讲解。"
    };
  }

  updated.updatedAt = new Date().toISOString();
  return updated;
}

function getNextQuestion(state) {
  for (const field of REQUIRED_FIELDS) {
    if (!state.fields[field] || (field === "keyPoints" && state.fields.keyPoints.length === 0)) {
      return FIELD_QUESTIONS[field];
    }
  }
  if (!state.fields.style) return FIELD_QUESTIONS.style;
  if (!state.fields.interactions) return FIELD_QUESTIONS.interactions;
  return "需求已齐全，可以开始生成 PPT。";
}

async function generatePresentation(state, options = {}) {
  ensureBrief(state);
  const missingFields = getMissingFields(state);
  if (!canGenerateFromState(state) && missingFields.length) {
    state.ready = false;
    applyAiDecision(state, null);
    return {
      error: 'missing_fields',
      missingFields,
      reply: buildMissingFieldsReply(state),
      state,
      draft: state.draft || null,
      scene: state.scene || null
    };
  }

  state.ready = true;

  if (!state.draft) {
    const ragQuery = buildRagQuery(state);
    state.rag = searchKnowledge(ragQuery, 4);
    const llmDraft = await generateDraftWithLLM({
      state,
      ragContext: state.rag,
      onTextDelta: options.onModelDelta
    });
    const normalized = normalizeDraft(llmDraft);
    state.draft = normalized || generateDraft(state);
    if (state.draft && !state.draft.brief) {
      state.draft.brief = state.brief || null;
    }
    applyAiDecision(state, { nextAction: 'edit_existing', showGenerateCTA: false });
    syncSceneFromDraft(state);
    state.confirmed = true;

    return {
      reply: `PPT 已开始生成并已同步预览。\n${buildSummary(state)}\n\n可继续修改内容，或直接导出 PPT。`,
      state,
      draft: state.draft,
      scene: state.scene
    };
  }

  if (!state.scene) {
    syncSceneFromDraft(state);
  }
  applyAiDecision(state, { nextAction: 'edit_existing', showGenerateCTA: false });
  state.confirmed = true;

  return {
    reply: "PPT 已生成，可继续修改或直接导出。",
    state,
    draft: state.draft,
    scene: state.scene
  };
}

async function handleMessage(state, text, messages = [], options = {}) {
  appendToBrief(state, text, 'user');
  extractFieldsFromText(text, state);
  let llmResult = null;
  try {
    const contextMessages = messages.length ? messages.slice(0, -1) : messages;
    llmResult = await extractIntentWithLLM({
      state,
      messages: contextMessages,
      text,
      onTextDelta: options.onModelDelta
    });
  } catch (error) {
    llmResult = null;
  }

  if (llmResult?.fields) {
    mergeFields(state, llmResult.fields);
  }

  applyAiDecision(state, llmResult);

  const assistantReply = typeof llmResult?.assistantReply === 'string'
    ? llmResult.assistantReply.trim()
    : '';

  const editInstruction = llmResult?.edit || text;
  if (state.draft && (llmResult?.intent === "edit" || isEdit(text))) {
    state.draft = applyEdit(state.draft, editInstruction);
    syncSceneFromDraft(state);
    state.lastEdit = editInstruction;
    return {
      reply: "已根据你的修改建议更新课件草稿。还需要调整哪些部分？",
      state,
      draft: state.draft,
      scene: state.scene
    };
  }

  const missingFields = getMissingFields(state);
  const missingField = missingFields[0];
  const canGenerate = canGenerateFromState(state);

  const smallTalkIntent = getSmallTalkIntent(text);
  if (smallTalkIntent) {
    return {
      reply: assistantReply || buildSmallTalkReply(smallTalkIntent, state, missingField),
      state,
      draft: state.draft || null,
      scene: state.scene || null
    };
  }

  if (missingField && !canGenerate) {
    state.ready = false;
    return {
      reply: assistantReply || buildMissingFieldsReply(state),
      state
    };
  }

  if (!state.ready) {
    state.ready = canGenerate;
    return {
      reply: assistantReply || buildReadyReply(state),
      state
    };
  }

  if (llmResult?.intent === "confirm" || isConfirm(text)) {
    return generatePresentation(state);
  }

  return {
    reply: assistantReply || (state.draft
      ? "已记录你的补充。需要我继续调整 PPT，还是再补充细节？"
      : "已记录你的补充。信息齐全后，可点击“生成 PPT”进入生成页。"),
    state
  };
}

module.exports = {
  createInitialState,
  handleMessage,
  generatePresentation,
  buildSummary,
  buildIntentPayload,
  getMissingFields,
  mergeFields
};

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
  greeting: "你好！我是教学智能体，可以帮你快速生成课件初稿。",
  presence: "我在的，随时可以开始。",
  identity: "我是多模态教学智能体，负责理解教学需求并生成课件草稿。",
  thanks: "不客气！需要我继续帮你完善课程吗？",
  bye: "好的，随时需要我再找我。"
};

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

function buildIntentPayload(state) {
  return {
    fields: state.fields,
    missingFields: getMissingFields(state),
    ready: state.ready,
    confirmed: state.confirmed,
    sceneStatus: state.sceneStatus || 'idle'
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
  if (missingField && intent !== "thanks" && intent !== "bye") {
    return `${base}\n\n${getNextQuestion(state)}`;
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
    bullets: [fields.grade, fields.duration].filter(Boolean)
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
      ]
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
    bullets: Array.isArray(slide.bullets) ? slide.bullets : []
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
  return "需求已齐全，可以开始生成初稿。确认后我将生成课件初稿。";
}

async function handleMessage(state, text, messages = []) {
  extractFieldsFromText(text, state);
  let llmResult = null;
  try {
    const contextMessages = messages.length ? messages.slice(0, -1) : messages;
    llmResult = await extractIntentWithLLM({ state, messages: contextMessages, text });
  } catch (error) {
    llmResult = null;
  }

  if (llmResult?.fields) {
    mergeFields(state, llmResult.fields);
  }

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

  const smallTalkIntent = getSmallTalkIntent(text);
  if (smallTalkIntent) {
    return {
      reply: buildSmallTalkReply(smallTalkIntent, state, missingField),
      state,
      draft: state.draft || null,
      scene: state.scene || null
    };
  }

  if (missingField) {
    state.ready = false;
    return {
      reply: getNextQuestion(state),
      state
    };
  }

  if (!state.ready) {
    state.ready = true;
    return {
      reply: `我已整理需求，请确认：\n${buildSummary(state)}\n\n回复“确认/生成”开始生成初稿。`,
      state
    };
  }

  if (llmResult?.intent === "confirm" || isConfirm(text)) {
    if (!state.draft) {
      const ragQuery = buildRagQuery(state);
      state.rag = searchKnowledge(ragQuery, 4);
      const llmDraft = await generateDraftWithLLM({ state, ragContext: state.rag });
      const normalized = normalizeDraft(llmDraft);
      state.draft = normalized || generateDraft(state);
      syncSceneFromDraft(state);
    }
    state.confirmed = true;
    return {
      reply: "初稿已生成，可在右侧预览。需要修改请直接描述。",
      state,
      draft: state.draft,
      scene: state.scene
    };
  }

  return {
    reply: "已记录你的补充。需要我继续生成初稿还是再补充细节？",
    state
  };
}

module.exports = {
  createInitialState,
  handleMessage,
  buildSummary,
  buildIntentPayload,
  getMissingFields
};

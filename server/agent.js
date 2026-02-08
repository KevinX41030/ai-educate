const { nanoid } = require('nanoid');
const { extractIntentWithLLM, generateDraftWithLLM } = require('./llm');

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
    lastEdit: ""
  };
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
    "课程": "subject",
    "课题": "subject",
    "章节": "subject",
    "科目": "subject",
    "年级": "grade",
    "学段": "grade",
    "时长": "duration",
    "课时": "duration",
    "目标": "goals",
    "教学目标": "goals",
    "知识点": "keyPoints",
    "要点": "keyPoints",
    "重点": "keyPoints",
    "难点": "keyPoints",
    "风格": "style",
    "呈现": "style",
    "互动": "interactions",
    "活动": "interactions"
  };
  return mapping[key] || "";
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
    const durationMatch = text.match(/(\d{1,3})\s*(分钟|min)/);
    if (durationMatch) {
      state.fields.duration = `${durationMatch[1]}分钟`;
    }
  }

  if (!state.fields.subject) {
    const subjectMatch = text.match(/(主题|课程|课题|章节)\s*是\s*([^。\n]+)/);
    if (subjectMatch) {
      state.fields.subject = subjectMatch[2].trim();
    }
  }

  if (!state.fields.grade) {
    const gradeMatch = text.match(/(\S+)(年级|高一|高二|高三|初一|初二|初三|小学|中学|高中)/);
    if (gradeMatch) {
      state.fields.grade = gradeMatch[0];
    }
  }

  if (!state.fields.goals) {
    const goalMatch = text.match(/目标\s*是\s*([^。\n]+)/);
    if (goalMatch) {
      state.fields.goals = goalMatch[1].trim();
    }
  }

  if (state.fields.keyPoints.length === 0) {
    const kpMatch = text.match(/(知识点|要点)\s*[:：=]?\s*([^。\n]+)/);
    if (kpMatch) {
      state.fields.keyPoints = normalizeKeyPoints(kpMatch[2]);
    }
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

function isConfirm(text) {
  return /(确认|可以|开始|生成|好的|没问题)/.test(text) && !/不(确认|需要|生成)/.test(text);
}

function isEdit(text) {
  return /(调整|修改|简化|增加|删除|替换)/.test(text);
}

function generateDraft(state) {
  const { fields } = state;
  const keyPoints = normalizeKeyPoints(fields.keyPoints);
  const slides = [];

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
    ppt: slides,
    lessonPlan,
    interactionIdea,
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

  return {
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
    state.lastEdit = editInstruction;
    return {
      reply: "已根据你的修改建议更新课件草稿。还需要调整哪些部分？",
      state,
      draft: state.draft
    };
  }

  const missingField = REQUIRED_FIELDS.find((field) => {
    if (field === "keyPoints") return state.fields.keyPoints.length === 0;
    return !state.fields[field];
  });

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
      const llmDraft = await generateDraftWithLLM({ state });
      const normalized = normalizeDraft(llmDraft);
      state.draft = normalized || generateDraft(state);
    }
    state.confirmed = true;
    return {
      reply: "初稿已生成，可在右侧预览。需要修改请直接描述。",
      state,
      draft: state.draft
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
  buildSummary
};

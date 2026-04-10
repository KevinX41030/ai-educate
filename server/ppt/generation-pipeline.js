const { nanoid } = require('nanoid');
const {
  isLLMConfigured,
  generatePptOutlineWithLLM,
  generateSlideFromOutlineWithLLM
} = require('../llm');
const { inferDesignPreset, mergeThemeWithPreset, getDesignPresetHints } = require('./design');
const { buildScenePayload, normalizeDraftSlide } = require('./presentation-state');
const { buildPptSceneFromDraft } = require('./scene');

const VALID_CONTENT_LAYOUTS = new Set(['concept', 'process', 'compare', 'case', 'practice', 'misconception']);

function normalizeList(value) {
  if (!value) return [];
  const items = Array.isArray(value) ? value : `${value}`.split(/[，,、;\n]/);
  return items.map((item) => `${item || ''}`.trim()).filter(Boolean);
}

function normalizeCitations(value) {
  return [...new Set(normalizeList(value))];
}

function inferContentLayout(rawSlide = {}, fallback = 'concept') {
  const explicit = `${rawSlide?.layout || ''}`.trim().toLowerCase();
  if (VALID_CONTENT_LAYOUTS.has(explicit)) return explicit;

  const text = [
    rawSlide?.title,
    ...(Array.isArray(rawSlide?.bullets) ? rawSlide.bullets : []),
    rawSlide?.question,
    rawSlide?.example,
    rawSlide?.notes
  ]
    .filter(Boolean)
    .join(' ');

  if (/(流程|步骤|过程|机制|路径|循环|顺序|链路|演变)/.test(text)) return 'process';
  if (
    (Array.isArray(rawSlide?.commonMistakes) && rawSlide.commonMistakes.length >= 2)
    || /(易错|误区|纠偏|陷阱)/.test(text)
  ) return 'misconception';
  if (/(案例|应用|实验|场景|实例|素材|拓展|综合|分析)/.test(text)) return 'case';
  if (/(练习|任务|讨论|互动|探究|思考|自测|抢答|活动|提问)/.test(text)) return 'practice';
  if (/(比较|对比|异同|区别|分类|优缺点|相同|不同|辨析)/.test(text)) return 'compare';
  return VALID_CONTENT_LAYOUTS.has(fallback) ? fallback : 'concept';
}

function normalizeLessonPlan(raw = {}, state = {}) {
  const fields = state.fields || {};
  const process = Array.isArray(raw.process) && raw.process.length
    ? raw.process.map((item) => `${item || ''}`.trim()).filter(Boolean)
    : [
        '导入：唤醒已有知识与学习任务',
        '建构：呈现核心概念与关键条件',
        '探究：结合现象、案例或实验推进理解',
        '练习：通过提问或任务检验理解',
        '总结：回顾要点并迁移应用'
      ];

  return {
    goals: typeof raw.goals === 'string' && raw.goals.trim() ? raw.goals.trim() : (fields.goals || ''),
    process,
    methods: typeof raw.methods === 'string' && raw.methods.trim() ? raw.methods.trim() : (fields.style || '讲授 + 互动'),
    activities: typeof raw.activities === 'string' && raw.activities.trim()
      ? raw.activities.trim()
      : (fields.interactions || '课堂问答 / 分组讨论'),
    homework: typeof raw.homework === 'string' && raw.homework.trim()
      ? raw.homework.trim()
      : '围绕本课核心知识点完成巩固练习或迁移应用任务'
  };
}

function normalizeInteractionIdea(raw = {}, state = {}) {
  const fields = state.fields || {};
  return {
    title: typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : (fields.interactions ? '课堂互动设计' : '课堂快速互动'),
    description: typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim()
      : (fields.interactions || '围绕知识点设置提问、讨论或即时练习。')
  };
}

function normalizeOutlineSlide(rawSlide, index, state = {}, fallback = {}) {
  const validTypes = new Set(['cover', 'toc', 'content', 'summary']);
  const fields = state.fields || {};
  const type = validTypes.has(rawSlide?.type) ? rawSlide.type : (fallback.type || 'content');
  const title = typeof rawSlide?.title === 'string' && rawSlide.title.trim()
    ? rawSlide.title.trim()
    : (fallback.title || `第 ${index + 1} 页`);
  const bullets = normalizeList(rawSlide?.bullets).length
    ? normalizeList(rawSlide?.bullets)
    : normalizeList(fallback.bullets);

  return {
    id: fallback.id || nanoid(),
    title,
    type,
    layout: type === 'content'
      ? inferContentLayout(rawSlide, inferContentLayout(fallback, 'concept'))
      : '',
    bullets,
    example: typeof rawSlide?.example === 'string' ? rawSlide.example : (fallback.example || ''),
    question: typeof rawSlide?.question === 'string' ? rawSlide.question : (fallback.question || ''),
    visual: typeof rawSlide?.visual === 'string' ? rawSlide.visual : (fallback.visual || ''),
    notes: typeof rawSlide?.notes === 'string' ? rawSlide.notes : (fallback.notes || ''),
    teachingGoal: typeof rawSlide?.teachingGoal === 'string'
      ? rawSlide.teachingGoal
      : (fallback.teachingGoal || fields.goals || ''),
    speakerNotes: typeof rawSlide?.speakerNotes === 'string' ? rawSlide.speakerNotes : (fallback.speakerNotes || ''),
    commonMistakes: normalizeList(rawSlide?.commonMistakes).length
      ? normalizeList(rawSlide?.commonMistakes)
      : normalizeList(fallback.commonMistakes),
    citations: normalizeCitations(
      normalizeList(rawSlide?.citations).length ? rawSlide.citations : fallback.citations
    )
  };
}

function buildFallbackOutlinePlan(state = {}) {
  const fields = state.fields || {};
  const keyPoints = normalizeList(fields.keyPoints);
  const points = keyPoints.length ? keyPoints : ['导入', '核心知识', '课堂练习'];
  const designPreset = inferDesignPreset({
    style: fields.style,
    subject: fields.subject,
    grade: fields.grade,
    interactions: fields.interactions
  });
  const theme = mergeThemeWithPreset({}, designPreset);
  const layoutHints = getDesignPresetHints(designPreset);
  const outlines = [];

  outlines.push({
    title: fields.subject || '课程封面',
    type: 'cover',
    bullets: [fields.grade, fields.duration].filter(Boolean),
    notes: state.brief?.mergedPrompt || fields.goals || '',
    teachingGoal: fields.goals || ''
  });

  outlines.push({
    title: '目录',
    type: 'toc',
    bullets: points,
    notes: '说明本课学习路径。'
  });

  points.forEach((point, pointIndex) => {
    const pointText = `${point}`.trim();
    const primaryLayout = inferContentLayout({
      title: pointText,
      bullets: [
        `${pointText}的核心定义与对象`,
        `${pointText}成立时必须满足的条件`,
        `${pointText}与前后知识点之间的关系`
      ]
    }, 'concept');
    const secondaryLayout = /(实验|案例|应用|场景|实例)/.test(pointText)
      ? 'case'
      : (pointIndex === points.length - 1 || fields.interactions ? 'practice' : 'misconception');

    outlines.push({
      title: pointText,
      type: 'content',
      layout: primaryLayout,
      bullets: [
        `${pointText}的核心概念与关键条件`,
        `${pointText}中的关键过程、结构或判断线索`,
        `${pointText}与前后知识点之间的关系`,
        `${pointText}在课堂中的理解抓手与观察点`
      ],
      notes: fields.goals || '',
      teachingGoal: fields.goals || '',
      citations: []
    });

    outlines.push({
      title: `${pointText}：应用与辨析`,
      type: 'content',
      layout: secondaryLayout,
      bullets: [
        `围绕“${pointText}”设计一个贴近课堂的应用场景`,
        `梳理学生学习“${pointText}”时最容易混淆的地方`,
        `通过提问或练习检验学生是否真正理解“${pointText}”`,
        `把“${pointText}”迁移到一个新的判断或解释任务中`
      ],
      question: `如果课堂上要快速检查“${pointText}”是否掌握，你会怎么追问？`,
      notes: pointIndex === points.length - 1 ? (fields.interactions || '') : '',
      teachingGoal: fields.goals || '',
      commonMistakes: ['只记结论，不理解条件', '会背术语，但不会迁移到情境中'],
      citations: []
    });
  });

  outlines.push({
    title: '总结与反思',
    type: 'summary',
    bullets: [
      '回顾本课核心概念与关键结论',
      '梳理应用场景与易错提醒',
      '布置迁移练习或课后任务'
    ],
    notes: '引导学生形成结构化回顾。'
  });

  return {
    designPreset,
    brief: state.brief || null,
    lessonPlan: normalizeLessonPlan({}, state),
    interactionIdea: normalizeInteractionIdea({}, state),
    theme,
    layoutHints,
    outlines: outlines.map((slide, index) => normalizeOutlineSlide(slide, index, state))
  };
}

function normalizeOutlinePlan(raw, state = {}) {
  const fallbackPlan = buildFallbackOutlinePlan(state);
  if (!raw || typeof raw !== 'object') return fallbackPlan;

  const outlineItems = Array.isArray(raw.outlines)
    ? raw.outlines
    : Array.isArray(raw.slides)
      ? raw.slides
      : Array.isArray(raw.ppt)
        ? raw.ppt
        : [];

  if (!outlineItems.length) return fallbackPlan;

  const designPreset = inferDesignPreset({
    designPreset: raw.designPreset,
    style: raw?.lessonPlan?.methods || state?.fields?.style,
    subject: state?.fields?.subject,
    grade: state?.fields?.grade,
    interactions: raw?.interactionIdea?.description || state?.fields?.interactions
  });
  const theme = mergeThemeWithPreset(raw.theme || {}, designPreset);
  const layoutHints = Array.isArray(raw.layoutHints) && raw.layoutHints.length
    ? raw.layoutHints.map((item) => `${item || ''}`.trim()).filter(Boolean)
    : getDesignPresetHints(designPreset);

  return {
    designPreset,
    brief: raw.brief && typeof raw.brief === 'object' ? raw.brief : (state.brief || null),
    lessonPlan: normalizeLessonPlan(raw.lessonPlan || {}, state),
    interactionIdea: normalizeInteractionIdea(raw.interactionIdea || {}, state),
    theme,
    layoutHints,
    outlines: outlineItems.map((slide, index) =>
      normalizeOutlineSlide(slide, index, state, fallbackPlan.outlines[index] || {})
    )
  };
}

function createDraftShell(plan, state = {}, existingDraft = null) {
  return {
    designPreset: plan.designPreset,
    brief: plan.brief || existingDraft?.brief || state.brief || null,
    ppt: Array.isArray(existingDraft?.ppt) ? [...existingDraft.ppt] : [],
    lessonPlan: plan.lessonPlan || existingDraft?.lessonPlan || null,
    interactionIdea: plan.interactionIdea || existingDraft?.interactionIdea || null,
    theme: plan.theme || existingDraft?.theme || null,
    layoutHints: Array.isArray(plan.layoutHints) && plan.layoutHints.length
      ? plan.layoutHints
      : (Array.isArray(existingDraft?.layoutHints) ? existingDraft.layoutHints : []),
    updatedAt: new Date().toISOString()
  };
}

function buildDraftPreview(draft) {
  return {
    draft,
    scene: buildPptSceneFromDraft(draft),
    sceneStatus: 'drafting',
    slideCount: Array.isArray(draft?.ppt) ? draft.ppt.length : 0
  };
}

function buildOutlineProgressMessage(index, total) {
  if (!total) return '已完成大纲生成';
  return `已生成 ${index}/${total} 页大纲`;
}

function buildSlideProgressMessage(index, total) {
  if (!total) return '正在生成页面内容';
  return `正在生成第 ${index}/${total} 页`;
}

async function runPptGenerationPipeline(state, options = {}) {
  const {
    ragContext = [],
    useAi = isLLMConfigured(),
    resume = null,
    onPlan,
    onStage,
    onProgress,
    onOutline,
    onSlide,
    onDraftPreview,
    onModelDelta,
    outlineGenerator,
    slideGenerator
  } = options;

  const effectiveOutlineGenerator = outlineGenerator || defaultOutlineGenerator;
  const effectiveSlideGenerator = slideGenerator || defaultSlideGenerator;
  const resumePlan = resume?.plan?.outlines?.length ? normalizeOutlinePlan(resume.plan, state) : null;
  let plan = resumePlan;
  let emittedOutlineCount = 0;

  if (resumePlan) {
    onPlan?.({
      plan: resumePlan,
      resume: true,
      completedCount: Number(resume?.completedCount || 0)
    });
    onStage?.({
      stage: 'outline',
      total: resumePlan.outlines.length,
      resume: true,
      text: `正在恢复生成，已复用 ${resumePlan.outlines.length} 页大纲…`
    });
    resumePlan.outlines.forEach((outline, index) => {
      onOutline?.({
        stage: 'outline',
        index,
        total: resumePlan.outlines.length,
        outline,
        resume: true
      });
    });
    onProgress?.({
      stage: 'outline',
      completed: resumePlan.outlines.length,
      total: resumePlan.outlines.length,
      resume: true,
      text: `已恢复 ${resumePlan.outlines.length} 页大纲`
    });
  } else {
    onStage?.({
      stage: 'outline',
      text: '正在生成页面大纲…'
    });

    const rawPlan = await effectiveOutlineGenerator(state, {
      ragContext,
      useAi,
      onModelDelta,
      onOutline: (rawOutline, index = emittedOutlineCount) => {
        const outline = normalizeOutlineSlide(rawOutline, index, state);
        emittedOutlineCount = Math.max(emittedOutlineCount, index + 1);
        onOutline?.({
          stage: 'outline',
          index,
          outline
        });
        onProgress?.({
          stage: 'outline',
          completed: emittedOutlineCount,
          total: 0,
          text: buildOutlineProgressMessage(emittedOutlineCount, 0)
        });
      }
    });

    plan = normalizeOutlinePlan(rawPlan, state);
    onPlan?.({
      plan,
      resume: false,
      completedCount: 0
    });
  }

  const totalSlides = plan.outlines.length;

  if (!resumePlan && !emittedOutlineCount) {
    plan.outlines.forEach((outline, index) => {
      onOutline?.({
        stage: 'outline',
        index,
        total: totalSlides,
        outline
      });
      onProgress?.({
        stage: 'outline',
        completed: index + 1,
        total: totalSlides,
        text: buildOutlineProgressMessage(index + 1, totalSlides)
      });
    });
  } else if (!resumePlan) {
    onProgress?.({
      stage: 'outline',
      completed: totalSlides,
      total: totalSlides,
      text: `页面大纲已就绪，共 ${totalSlides} 页`
    });
  }

  const resumedSlides = Array.isArray(resume?.draft?.ppt)
    ? resume.draft.ppt.map((slide, index) => normalizeDraftSlide(slide, plan.outlines[index], index))
    : [];
  const startIndex = Math.min(Number(resume?.completedCount || resumedSlides.length || 0), totalSlides);
  const draft = createDraftShell(plan, state, resume?.draft ? { ...resume.draft, ppt: resumedSlides } : null);
  const generatedSlides = [...resumedSlides];

  onStage?.({
    stage: 'slides',
    total: totalSlides,
    resume: Boolean(resumePlan),
    text: startIndex > 0 && startIndex < totalSlides
      ? `正在继续生成剩余 ${totalSlides - startIndex} 页…`
      : (totalSlides ? `正在逐页生成内容，共 ${totalSlides} 页…` : '正在逐页生成内容…')
  });

  if (generatedSlides.length) {
    draft.ppt = [...generatedSlides];
    onDraftPreview?.(buildDraftPreview(draft));
    onProgress?.({
      stage: 'slides',
      completed: generatedSlides.length,
      total: totalSlides,
      resume: true,
      text: buildSlideProgressMessage(generatedSlides.length, totalSlides)
    });
  }

  for (let index = startIndex; index < plan.outlines.length; index += 1) {
    const outline = plan.outlines[index];
    const rawSlide = await effectiveSlideGenerator(state, {
      outline,
      outlineIndex: index,
      totalOutlines: totalSlides,
      allOutlines: plan.outlines,
      draftMeta: {
        designPreset: plan.designPreset,
        lessonPlan: plan.lessonPlan,
        interactionIdea: plan.interactionIdea,
        theme: plan.theme,
        layoutHints: plan.layoutHints
      },
      generatedSlides,
      ragContext,
      useAi,
      onModelDelta
    });

    const slide = normalizeDraftSlide(rawSlide || outline, outline, index);
    generatedSlides.push(slide);
    draft.ppt = [...generatedSlides];
    draft.updatedAt = new Date().toISOString();

    const previewPayload = buildDraftPreview(draft);
    onSlide?.({
      stage: 'slides',
      index,
      total: totalSlides,
      outline,
      slide,
      ...previewPayload
    });
    onDraftPreview?.(previewPayload);
    onProgress?.({
      stage: 'slides',
      completed: index + 1,
      total: totalSlides,
      text: buildSlideProgressMessage(index + 1, totalSlides)
    });
  }

  onStage?.({
    stage: 'scene',
    total: totalSlides,
    text: '正在生成页面版式…'
  });

  const sceneResult = await buildScenePayload({
    draft,
    ragContext,
    useAi,
    onModelDelta
  });

  return {
    plan,
    draft,
    scene: sceneResult.scene || buildPptSceneFromDraft(draft),
    sceneSource: sceneResult.source || 'draft',
    sceneStatus: sceneResult.scene ? 'ready' : 'idle'
  };
}

async function defaultOutlineGenerator(state, options = {}) {
  const { ragContext = [], useAi = isLLMConfigured(), onModelDelta, onOutline } = options;
  if (useAi && isLLMConfigured()) {
    try {
      return await generatePptOutlineWithLLM({
        state,
        ragContext,
        onTextDelta: onModelDelta,
        onOutline
      });
    } catch (error) {
      return buildFallbackOutlinePlan(state);
    }
  }
  return buildFallbackOutlinePlan(state);
}

async function defaultSlideGenerator(state, options = {}) {
  const {
    outline,
    outlineIndex = 0,
    allOutlines = [],
    draftMeta = {},
    generatedSlides = [],
    ragContext = [],
    useAi = isLLMConfigured(),
    onModelDelta
  } = options;

  if (useAi && isLLMConfigured()) {
    try {
      return await generateSlideFromOutlineWithLLM({
        state,
        outline,
        outlineIndex,
        allOutlines,
        draftMeta,
        generatedSlides,
        ragContext,
        onTextDelta: onModelDelta
      });
    } catch (error) {
      return outline;
    }
  }

  return outline;
}

module.exports = {
  buildFallbackOutlinePlan,
  normalizeOutlinePlan,
  runPptGenerationPipeline
};

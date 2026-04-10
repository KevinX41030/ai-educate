const { nanoid } = require('nanoid');
const { isLLMConfigured, generatePptSceneWithLLM } = require('../llm');
const { buildPptSceneFromDraft, normalizeScene, mergeSceneIntoDraft } = require('./scene');
const { inferDesignPreset, mergeThemeWithPreset, getDesignPresetHints } = require('./design');
const { extractPartialJsonStringField, safeJsonParseSnippet, extractCompletedJsonArrayItems } = require('../lib/stream-json');
const { syncClassroomFromDraft } = require('../classroom/state');

const VALID_CONTENT_LAYOUTS = new Set(['concept', 'process', 'compare', 'case', 'practice', 'misconception']);

function applySceneToState(state, scene, source = 'draft', status = 'ready') {
  if (!state) return;
  state.scene = scene;
  state.sceneSource = scene ? source : '';
  state.sceneStatus = scene ? status : 'idle';
  state.sceneUpdatedAt = scene?.updatedAt || '';
  state.sceneVersion = (state.sceneVersion || 0) + (scene ? 1 : 0);
  if (state.draft) {
    syncClassroomFromDraft(state, {
      source,
      status: state.sceneStatus
    });
  }
}

function syncClientPresentationState(state, draft, scene) {
  if (!state) return { draft: null, scene: null };

  let nextDraft = draft || state.draft || null;
  if (!nextDraft) return { draft: null, scene: null };

  if (scene) {
    nextDraft = mergeSceneIntoDraft(nextDraft, scene) || nextDraft;
    state.draft = nextDraft;

    const normalizedScene = normalizeScene(scene, nextDraft);
    if (normalizedScene) {
      applySceneToState(state, normalizedScene, 'client', 'ready');
      return { draft: nextDraft, scene: normalizedScene };
    }
  }

  if (draft) {
    state.draft = draft;
    let rebuiltFallbackScene = false;
    if (!state.scene) {
      const fallbackScene = buildPptSceneFromDraft(draft);
      if (fallbackScene) {
        applySceneToState(state, fallbackScene, 'draft', isLLMConfigured() ? 'stale' : 'ready');
        rebuiltFallbackScene = true;
      }
    }
    if (!rebuiltFallbackScene) {
      syncClassroomFromDraft(state, {
        source: 'client',
        status: state.sceneStatus || (isLLMConfigured() ? 'stale' : 'ready')
      });
    }
  }

  return { draft: state.draft, scene: state.scene || null };
}

async function buildScenePayload({ draft, ragContext = [], useAi = true, onModelDelta }) {
  const fallbackScene = buildPptSceneFromDraft(draft);
  if (!fallbackScene) return { scene: null, source: 'draft' };

  if (useAi) {
    try {
      const rawScene = await generatePptSceneWithLLM({ draft, ragContext, onTextDelta: onModelDelta });
      const normalized = normalizeScene(rawScene, draft);
      if (normalized) {
        return { scene: normalized, source: 'llm' };
      }
    } catch (error) {
      if (typeof onModelDelta === 'function') {
        throw error;
      }
    }
  }

  return { scene: fallbackScene, source: 'draft' };
}

function normalizePreviewList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => `${item || ''}`.trim()).filter(Boolean);
}

function inferContentLayout(slide = {}, fallback = 'concept') {
  const explicit = `${slide?.layout || ''}`.trim().toLowerCase();
  if (VALID_CONTENT_LAYOUTS.has(explicit)) return explicit;

  const text = [
    slide?.title,
    ...(Array.isArray(slide?.bullets) ? slide.bullets : []),
    slide?.question,
    slide?.example,
    slide?.notes
  ]
    .filter(Boolean)
    .join(' ');

  if (/(流程|步骤|过程|机制|路径|循环|顺序|链路|演变)/.test(text)) return 'process';
  if (
    (Array.isArray(slide?.commonMistakes) && slide.commonMistakes.length >= 2)
    || /(易错|误区|纠偏|陷阱)/.test(text)
  ) return 'misconception';
  if (/(案例|应用|实验|场景|实例|素材|拓展|综合|分析)/.test(text)) return 'case';
  if (/(练习|任务|讨论|互动|探究|思考|自测|抢答|活动|提问)/.test(text)) return 'practice';
  if (/(比较|对比|异同|区别|分类|优缺点|相同|不同|辨析)/.test(text)) return 'compare';
  return VALID_CONTENT_LAYOUTS.has(fallback) ? fallback : 'concept';
}

function normalizePreviewSlide(slide, index, previousSlide = null) {
  const validTypes = new Set(['cover', 'toc', 'content', 'summary']);
  const normalizeCitations = (value) => Array.isArray(value)
    ? [...new Set(value.map((item) => `${item || ''}`.trim()).filter(Boolean))]
    : [];
  return {
    id: previousSlide?.id || nanoid(),
    title: typeof slide?.title === 'string' && slide.title.trim() ? slide.title.trim() : `第 ${index + 1} 页`,
    type: validTypes.has(slide?.type) ? slide.type : 'content',
    layout: (validTypes.has(slide?.type) ? slide.type : 'content') === 'content'
      ? inferContentLayout(slide, inferContentLayout(previousSlide, 'concept'))
      : '',
    bullets: normalizePreviewList(slide?.bullets),
    example: typeof slide?.example === 'string' ? slide.example : '',
    question: typeof slide?.question === 'string' ? slide.question : '',
    visual: typeof slide?.visual === 'string' ? slide.visual : '',
    notes: typeof slide?.notes === 'string' ? slide.notes : '',
    teachingGoal: typeof slide?.teachingGoal === 'string' ? slide.teachingGoal : '',
    speakerNotes: typeof slide?.speakerNotes === 'string' ? slide.speakerNotes : '',
    commonMistakes: normalizePreviewList(slide?.commonMistakes),
    citations: normalizeCitations(slide?.citations)
  };
}

function buildStreamingPreviewDraft(state, rawSlides = [], previousDraft = null, designPresetHint = '') {
  if (!rawSlides.length) return null;

  const fields = state?.fields || {};
  const designPreset = inferDesignPreset({
    designPreset: designPresetHint,
    style: fields.style,
    subject: fields.subject,
    grade: fields.grade,
    interactions: fields.interactions
  });

  const ppt = rawSlides.map((slide, index) => normalizePreviewSlide(slide, index, previousDraft?.ppt?.[index]));

  return {
    designPreset,
    brief: state?.brief || null,
    ppt,
    lessonPlan: previousDraft?.lessonPlan || {
      goals: fields.goals || '',
      process: [],
      methods: fields.style || '',
      activities: fields.interactions || '',
      homework: ''
    },
    interactionIdea: previousDraft?.interactionIdea || {
      title: '',
      description: fields.interactions || ''
    },
    theme: mergeThemeWithPreset(previousDraft?.theme || {}, designPreset),
    layoutHints: Array.isArray(previousDraft?.layoutHints) && previousDraft.layoutHints.length
      ? previousDraft.layoutHints
      : getDesignPresetHints(designPreset),
    updatedAt: new Date().toISOString()
  };
}

function createDraftPreviewTracker(state, onPreview) {
  let emittedCount = 0;
  let previousDraft = null;

  return (_, rawText = '') => {
    const partialText = String(rawText || '');
    if (!partialText) return;

    const rawSlides = extractCompletedJsonArrayItems(partialText, 'ppt')
      .map((item) => safeJsonParseSnippet(item))
      .filter(Boolean);

    if (!rawSlides.length || rawSlides.length <= emittedCount) return;

    const designPresetHint = extractPartialJsonStringField(partialText, 'designPreset') || previousDraft?.designPreset || '';
    const draft = buildStreamingPreviewDraft(state, rawSlides, previousDraft, designPresetHint);
    if (!draft) return;

    previousDraft = draft;
    emittedCount = draft.ppt.length;

    onPreview?.({
      draft,
      scene: buildPptSceneFromDraft(draft),
      sceneStatus: 'drafting',
      slideCount: draft.ppt.length
    });
  };
}

function normalizeDraftSlide(rawSlide, fallbackSlide = {}, index = 0) {
  const validTypes = new Set(['cover', 'toc', 'content', 'summary']);
  const toList = (value) => Array.isArray(value)
    ? value.map((item) => `${item || ''}`.trim()).filter(Boolean)
    : [];
  const type = validTypes.has(rawSlide?.type) ? rawSlide.type : (fallbackSlide.type || 'content');

  return {
    id: fallbackSlide.id || nanoid(),
    title: typeof rawSlide?.title === 'string' && rawSlide.title.trim()
      ? rawSlide.title.trim()
      : (fallbackSlide.title || `第 ${index + 1} 页`),
    type,
    layout: type === 'content'
      ? inferContentLayout(rawSlide, inferContentLayout(fallbackSlide, 'concept'))
      : '',
    bullets: toList(rawSlide?.bullets).length ? toList(rawSlide?.bullets) : (Array.isArray(fallbackSlide.bullets) ? fallbackSlide.bullets : []),
    example: typeof rawSlide?.example === 'string' ? rawSlide.example : (fallbackSlide.example || ''),
    question: typeof rawSlide?.question === 'string' ? rawSlide.question : (fallbackSlide.question || ''),
    visual: typeof rawSlide?.visual === 'string' ? rawSlide.visual : (fallbackSlide.visual || ''),
    notes: typeof rawSlide?.notes === 'string' ? rawSlide.notes : (fallbackSlide.notes || ''),
    teachingGoal: typeof rawSlide?.teachingGoal === 'string' ? rawSlide.teachingGoal : (fallbackSlide.teachingGoal || ''),
    speakerNotes: typeof rawSlide?.speakerNotes === 'string' ? rawSlide.speakerNotes : (fallbackSlide.speakerNotes || ''),
    commonMistakes: toList(rawSlide?.commonMistakes).length
      ? toList(rawSlide?.commonMistakes)
      : (Array.isArray(fallbackSlide.commonMistakes) ? fallbackSlide.commonMistakes : []),
    citations: toList(rawSlide?.citations).length
      ? toList(rawSlide?.citations)
      : (Array.isArray(fallbackSlide.citations) ? fallbackSlide.citations : [])
  };
}

function replaceSceneSlide(scene, nextSlide, index) {
  if (!scene || !Array.isArray(scene.slides) || !nextSlide) return scene;
  const slides = scene.slides.map((slide, slideIndex) => {
    if (slideIndex !== index) return slide;
    return {
      ...nextSlide,
      id: slide?.id || nextSlide.id
    };
  });
  return {
    ...scene,
    slides,
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  applySceneToState,
  syncClientPresentationState,
  buildScenePayload,
  normalizePreviewSlide,
  buildStreamingPreviewDraft,
  createDraftPreviewTracker,
  normalizeDraftSlide,
  replaceSceneSlide
};

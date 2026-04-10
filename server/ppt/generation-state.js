function nowIso() {
  return new Date().toISOString();
}

function createInitialGenerationState() {
  return {
    status: 'idle',
    currentStage: '',
    statusMessage: '',
    totalSlides: 0,
    completedOutlines: 0,
    completedSlides: 0,
    currentSlideIndex: -1,
    outlines: [],
    slideStates: [],
    designPreset: '',
    theme: null,
    layoutHints: [],
    lessonPlan: null,
    interactionIdea: null,
    startedAt: '',
    updatedAt: '',
    completedAt: '',
    lastError: '',
    canResume: false,
    sessionEpoch: 0
  };
}

function ensureGenerationState(state) {
  if (!state || typeof state !== 'object') return createInitialGenerationState();
  if (!state.generation || typeof state.generation !== 'object') {
    state.generation = createInitialGenerationState();
  }
  return state.generation;
}

function resetGenerationState(state, overrides = {}) {
  const previous = ensureGenerationState(state);
  const next = {
    ...createInitialGenerationState(),
    sessionEpoch: (previous.sessionEpoch || 0) + 1,
    ...overrides,
    updatedAt: nowIso()
  };
  if (state && typeof state === 'object') {
    state.generation = next;
  }
  return next;
}

function beginGenerationState(state, { resume = false } = {}) {
  const previous = ensureGenerationState(state);
  const timestamp = nowIso();
  state.generation = {
    ...createInitialGenerationState(),
    sessionEpoch: (previous.sessionEpoch || 0) + 1,
    status: resume ? 'resuming' : 'queued',
    currentStage: resume ? 'resume' : 'outline',
    statusMessage: resume ? '正在继续未完成的生成任务…' : '正在准备生成任务…',
    startedAt: resume && previous.startedAt ? previous.startedAt : timestamp,
    updatedAt: timestamp,
    canResume: false
  };
  return state.generation;
}

function setGenerationStage(state, payload = {}) {
  const generation = ensureGenerationState(state);
  const timestamp = nowIso();
  const stage = payload.stage || generation.currentStage || '';
  const statusMap = {
    outline: 'outlining',
    slides: 'generating_slides',
    scene: 'building_scene'
  };
  generation.currentStage = stage;
  generation.status = statusMap[stage] || generation.status || 'queued';
  generation.statusMessage = payload.text || generation.statusMessage || '';
  generation.updatedAt = timestamp;
  generation.canResume = false;
  if (Number.isFinite(payload.total)) {
    generation.totalSlides = Number(payload.total);
  }
  return generation;
}

function setGenerationExternalProgress(state, payload = {}) {
  const generation = ensureGenerationState(state);
  const timestamp = nowIso();
  const stage = payload.stage || generation.currentStage || '';
  const statusMap = {
    outline: 'outlining',
    slides: 'generating_slides',
    scene: 'building_scene',
    completed: 'completed'
  };

  const completed = Number.isFinite(payload.completed)
    ? Math.max(0, Number(payload.completed))
    : generation.completedSlides;
  const total = Number.isFinite(payload.total)
    ? Math.max(completed, Number(payload.total))
    : generation.totalSlides;

  generation.currentStage = stage;
  generation.status = payload.status || statusMap[stage] || generation.status || 'queued';
  generation.statusMessage = payload.text || generation.statusMessage || '';
  generation.totalSlides = total;
  generation.completedSlides = completed;
  generation.completedOutlines = stage === 'outline'
    ? completed
    : Math.max(generation.completedOutlines, completed);
  generation.currentSlideIndex = completed > 0 ? completed - 1 : -1;
  generation.updatedAt = timestamp;
  generation.canResume = Boolean(payload.canResume);
  return generation;
}

function countCompletedSlides(slideStates = []) {
  return slideStates.filter((item) => item?.status === 'completed').length;
}

function setGenerationPlan(state, plan = {}, options = {}) {
  const generation = ensureGenerationState(state);
  const timestamp = nowIso();
  const previousSlideStates = Array.isArray(generation.slideStates) ? generation.slideStates : [];
  const outlines = Array.isArray(plan.outlines) ? plan.outlines : [];
  const resumed = Boolean(options.resume);
  const completedCount = Math.max(0, Number(options.completedCount || 0));

  generation.designPreset = plan.designPreset || generation.designPreset || '';
  generation.theme = plan.theme || generation.theme || null;
  generation.layoutHints = Array.isArray(plan.layoutHints) ? [...plan.layoutHints] : [];
  generation.lessonPlan = plan.lessonPlan || generation.lessonPlan || null;
  generation.interactionIdea = plan.interactionIdea || generation.interactionIdea || null;
  generation.outlines = outlines.map((outline) => ({
    id: outline?.id || '',
    title: outline?.title || '',
    type: outline?.type || 'content',
    bullets: Array.isArray(outline?.bullets) ? [...outline.bullets] : [],
    notes: outline?.notes || '',
    teachingGoal: outline?.teachingGoal || ''
  }));
  generation.totalSlides = outlines.length;
  generation.completedOutlines = outlines.length;
  generation.slideStates = outlines.map((outline, index) => {
    const previous = previousSlideStates[index];
    const keepCompleted = resumed && (index < completedCount || previous?.status === 'completed');
    return {
      id: outline?.id || previous?.id || '',
      title: outline?.title || previous?.title || '',
      type: outline?.type || previous?.type || 'content',
      status: keepCompleted ? 'completed' : 'pending',
      error: keepCompleted ? '' : (previous?.error || ''),
      updatedAt: timestamp
    };
  });
  generation.completedSlides = countCompletedSlides(generation.slideStates);
  generation.currentSlideIndex = generation.completedSlides > 0 ? generation.completedSlides - 1 : -1;
  generation.updatedAt = timestamp;
  generation.canResume = false;
  return generation;
}

function markGenerationSlidePending(state, index) {
  const generation = ensureGenerationState(state);
  if (!Array.isArray(generation.slideStates) || !generation.slideStates[index]) return generation;
  generation.slideStates[index] = {
    ...generation.slideStates[index],
    status: 'generating',
    error: '',
    updatedAt: nowIso()
  };
  generation.currentSlideIndex = index;
  generation.updatedAt = nowIso();
  return generation;
}

function markGenerationSlideCompleted(state, index, slide = null) {
  const generation = ensureGenerationState(state);
  if (!Array.isArray(generation.slideStates) || !generation.slideStates[index]) return generation;
  generation.slideStates[index] = {
    ...generation.slideStates[index],
    id: slide?.id || generation.slideStates[index].id,
    title: slide?.title || generation.slideStates[index].title,
    type: slide?.type || generation.slideStates[index].type,
    status: 'completed',
    error: '',
    updatedAt: nowIso()
  };
  generation.completedSlides = countCompletedSlides(generation.slideStates);
  generation.currentSlideIndex = index;
  generation.updatedAt = nowIso();
  generation.statusMessage = generation.totalSlides
    ? `已完成 ${generation.completedSlides}/${generation.totalSlides} 页`
    : generation.statusMessage;
  return generation;
}

function markGenerationCompleted(state) {
  const generation = ensureGenerationState(state);
  const timestamp = nowIso();
  const hasTrackedSlides = Array.isArray(generation.slideStates) && generation.slideStates.length > 0;
  const completedSlides = hasTrackedSlides
    ? countCompletedSlides(generation.slideStates)
    : Math.max(0, Number(generation.completedSlides || 0));
  generation.status = 'completed';
  generation.currentStage = 'completed';
  generation.statusMessage = generation.totalSlides
    ? `生成完成，共 ${generation.totalSlides} 页`
    : '生成完成';
  generation.completedSlides = completedSlides;
  generation.currentSlideIndex = completedSlides > 0 ? completedSlides - 1 : -1;
  generation.completedAt = timestamp;
  generation.updatedAt = timestamp;
  generation.lastError = '';
  generation.canResume = false;
  return generation;
}

function markGenerationFailed(state, error) {
  const generation = ensureGenerationState(state);
  const message = String(error || 'generation_failed');
  generation.status = 'error';
  generation.statusMessage = '生成失败，可稍后继续';
  generation.updatedAt = nowIso();
  generation.lastError = message;
  generation.canResume = Boolean(generation.outlines.length || generation.totalSlides || generation.currentStage);
  return generation;
}

function markGenerationInterrupted(state) {
  const generation = ensureGenerationState(state);
  const activeStatuses = new Set(['queued', 'resuming', 'outlining', 'generating_slides', 'building_scene']);
  if (!activeStatuses.has(generation.status)) return generation;
  generation.status = 'interrupted';
  generation.statusMessage = generation.completedSlides > 0
    ? `生成已中断，已完成 ${generation.completedSlides}/${generation.totalSlides || generation.completedSlides} 页`
    : '生成已中断，可继续';
  generation.updatedAt = nowIso();
  generation.canResume = Boolean(generation.outlines.length || generation.totalSlides || generation.currentStage);
  return generation;
}

function isResumableGeneration(state) {
  const generation = ensureGenerationState(state);
  const resumableStatuses = new Set(['error', 'interrupted', 'outlining', 'generating_slides', 'building_scene', 'resuming']);
  return resumableStatuses.has(generation.status) && Array.isArray(generation.outlines) && generation.outlines.length > 0;
}

function buildResumeGenerationContext(state) {
  if (!state || !isResumableGeneration(state)) return null;
  const generation = ensureGenerationState(state);
  const outlines = Array.isArray(generation.outlines) ? generation.outlines : [];
  if (!outlines.length) return null;

  let completedCount = 0;
  const slideStates = Array.isArray(generation.slideStates) ? generation.slideStates : [];
  const draftSlides = Array.isArray(state.draft?.ppt) ? state.draft.ppt : [];
  while (completedCount < outlines.length) {
    if (slideStates[completedCount]?.status === 'completed' && draftSlides[completedCount]) {
      completedCount += 1;
      continue;
    }
    break;
  }

  return {
    completedCount,
    plan: {
      designPreset: generation.designPreset || state.draft?.designPreset || '',
      brief: state.draft?.brief || state.brief || null,
      lessonPlan: generation.lessonPlan || state.draft?.lessonPlan || null,
      interactionIdea: generation.interactionIdea || state.draft?.interactionIdea || null,
      theme: generation.theme || state.draft?.theme || null,
      layoutHints: Array.isArray(generation.layoutHints)
        ? [...generation.layoutHints]
        : (Array.isArray(state.draft?.layoutHints) ? [...state.draft.layoutHints] : []),
      outlines
    },
    draft: state.draft && Array.isArray(state.draft.ppt)
      ? {
          ...state.draft,
          ppt: state.draft.ppt.slice(0, completedCount)
        }
      : null
  };
}

module.exports = {
  createInitialGenerationState,
  ensureGenerationState,
  resetGenerationState,
  beginGenerationState,
  setGenerationStage,
  setGenerationExternalProgress,
  setGenerationPlan,
  markGenerationSlidePending,
  markGenerationSlideCompleted,
  markGenerationCompleted,
  markGenerationFailed,
  markGenerationInterrupted,
  isResumableGeneration,
  buildResumeGenerationContext
};

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInitialGenerationState,
  beginGenerationState,
  markGenerationCompleted,
  setGenerationExternalProgress,
  setGenerationPlan,
  markGenerationSlideCompleted,
  markGenerationInterrupted,
  buildResumeGenerationContext
} = require('../ppt/generation-state');

function createState() {
  return {
    fields: {
      subject: '光合作用',
      grade: '初二',
      duration: '45分钟',
      goals: '理解原理',
      keyPoints: ['光反应', '暗反应'],
      style: '探究式',
      interactions: '分组讨论'
    },
    brief: {
      rawInputs: [],
      mergedPrompt: '生成一个光合作用课件',
      updatedAt: new Date().toISOString()
    },
    draft: {
      designPreset: 'classroom',
      brief: null,
      lessonPlan: { goals: '理解原理', process: [], methods: '探究式', activities: '讨论', homework: '复习' },
      interactionIdea: { title: '讨论', description: '分组讨论' },
      theme: { primary: '#1F3B73', accent: '#4C8BF5', background: '#F8FAFC', text: '#0F172A', font: 'Microsoft YaHei' },
      layoutHints: ['cover_right_panel'],
      ppt: [
        { id: 'slide-1', title: '封面', type: 'cover', bullets: ['初二'] },
        { id: 'slide-2', title: '目录', type: 'toc', bullets: ['光反应', '暗反应'] }
      ]
    },
    generation: createInitialGenerationState()
  };
}

test('buildResumeGenerationContext keeps only completed slide prefix', () => {
  const state = createState();
  beginGenerationState(state);
  setGenerationPlan(state, {
    designPreset: 'classroom',
    lessonPlan: state.draft.lessonPlan,
    interactionIdea: state.draft.interactionIdea,
    theme: state.draft.theme,
    layoutHints: state.draft.layoutHints,
    outlines: [
      { id: 'slide-1', title: '封面', type: 'cover', bullets: ['初二'] },
      { id: 'slide-2', title: '目录', type: 'toc', bullets: ['光反应', '暗反应'] },
      { id: 'slide-3', title: '光反应', type: 'content', bullets: ['条件', '过程', '产物'] }
    ]
  });
  markGenerationSlideCompleted(state, 0, state.draft.ppt[0]);
  state.generation.slideStates[1].status = 'generating';
  markGenerationInterrupted(state);

  const resume = buildResumeGenerationContext(state);

  assert.ok(resume);
  assert.equal(resume.completedCount, 1);
  assert.equal(resume.plan.outlines.length, 3);
  assert.equal(resume.draft.ppt.length, 1);
  assert.equal(resume.draft.ppt[0].title, '封面');
});

test('markGenerationCompleted preserves externally tracked slide totals', () => {
  const state = createState();
  beginGenerationState(state);
  setGenerationExternalProgress(state, {
    stage: 'scene',
    status: 'completed',
    text: '课件已完成生成',
    completed: 6,
    total: 6
  });

  markGenerationCompleted(state);

  assert.equal(state.generation.status, 'completed');
  assert.equal(state.generation.totalSlides, 6);
  assert.equal(state.generation.completedSlides, 6);
  assert.equal(state.generation.currentSlideIndex, 5);
});

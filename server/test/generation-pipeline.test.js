const test = require('node:test');
const assert = require('node:assert/strict');

const { runPptGenerationPipeline } = require('../ppt/generation-pipeline');

function createState() {
  return {
    id: 'session-test',
    fields: {
      subject: '光合作用',
      grade: '初二',
      duration: '45分钟',
      goals: '理解光合作用的基本原理，并能解释影响因素',
      keyPoints: ['光反应', '暗反应'],
      style: '探究式',
      interactions: '分组讨论 + 课堂追问'
    },
    brief: {
      rawInputs: [{ source: 'user', text: '给初二做一份光合作用课件。' }],
      mergedPrompt: '给初二做一份光合作用课件，包含原理、应用和易错点。',
      updatedAt: new Date().toISOString()
    }
  };
}

test('runPptGenerationPipeline falls back to staged local generation and emits progress events', async () => {
  const state = createState();
  const stages = [];
  const outlines = [];
  const slides = [];
  const previews = [];
  const progressMessages = [];

  const result = await runPptGenerationPipeline(state, {
    useAi: false,
    onStage: (payload) => stages.push(payload.stage),
    onOutline: (payload) => outlines.push(payload),
    onSlide: (payload) => slides.push(payload),
    onDraftPreview: (payload) => previews.push(payload),
    onProgress: (payload) => progressMessages.push(payload.text)
  });

  assert.deepEqual(stages, ['outline', 'slides', 'scene']);
  assert.ok(result.draft);
  assert.ok(Array.isArray(result.draft.ppt));
  assert.ok(result.draft.ppt.length >= 7);
  assert.ok(result.draft.ppt.filter((slide) => slide.type === 'content').every((slide) => typeof slide.layout === 'string'));
  assert.ok(result.draft.ppt.some((slide) => slide.layout === 'practice' || slide.layout === 'misconception'));
  assert.equal(outlines.length, result.draft.ppt.length);
  assert.equal(slides.length, result.draft.ppt.length);
  assert.equal(previews.at(-1)?.slideCount, result.draft.ppt.length);
  assert.equal(result.sceneStatus, 'ready');
  assert.ok(result.scene);
  assert.match(progressMessages[0] || '', /大纲/);
  assert.match(progressMessages.at(-1) || '', /第 \d+\/\d+ 页/);
});

test('runPptGenerationPipeline orchestrates outline and slide generators sequentially', async () => {
  const state = createState();
  const slideCallContexts = [];

  const result = await runPptGenerationPipeline(state, {
    useAi: false,
    outlineGenerator: async () => ({
      designPreset: 'classroom',
      lessonPlan: {
        goals: '理解概念',
        process: ['导入', '讲解', '练习', '总结', '作业'],
        methods: '探究式',
        activities: '讨论',
        homework: '复习'
      },
      interactionIdea: {
        title: '抢答',
        description: '课堂抢答'
      },
      theme: {
        primary: '#1F3B73',
        accent: '#4C8BF5',
        background: '#F8FAFC',
        text: '#0F172A',
        font: 'Microsoft YaHei'
      },
      layoutHints: ['cover_right_panel'],
      outlines: [
        { title: '光合作用', type: 'cover', bullets: ['初二', '45分钟'] },
        { title: '目录', type: 'toc', bullets: ['光反应', '暗反应'] },
        { title: '光反应', type: 'content', layout: 'compare', bullets: ['条件', '过程', '产物'] }
      ]
    }),
    slideGenerator: async (_, context) => {
      slideCallContexts.push({
        outlineIndex: context.outlineIndex,
        generatedSlides: context.generatedSlides.length,
        previousTitles: context.generatedSlides.map((item) => item.title)
      });
      return {
        ...context.outline,
        example: `案例 ${context.outlineIndex + 1}`,
        question: `提问 ${context.outlineIndex + 1}`
      };
    }
  });

  assert.deepEqual(slideCallContexts, [
    { outlineIndex: 0, generatedSlides: 0, previousTitles: [] },
    { outlineIndex: 1, generatedSlides: 1, previousTitles: ['光合作用'] },
    { outlineIndex: 2, generatedSlides: 2, previousTitles: ['光合作用', '目录'] }
  ]);
  assert.equal(result.draft.ppt.length, 3);
  assert.equal(result.draft.ppt[2].layout, 'compare');
  assert.equal(result.draft.ppt[2].example, '案例 3');
  assert.equal(result.draft.ppt[2].question, '提问 3');
});

test('runPptGenerationPipeline resumes from saved outlines and completed slides', async () => {
  const state = createState();
  const slideCallContexts = [];
  const outlineEvents = [];

  const result = await runPptGenerationPipeline(state, {
    useAi: false,
    resume: {
      completedCount: 2,
      draft: {
        designPreset: 'classroom',
        brief: state.brief,
        lessonPlan: {
          goals: '理解概念',
          process: ['导入', '讲解', '练习', '总结', '作业'],
          methods: '探究式',
          activities: '讨论',
          homework: '复习'
        },
        interactionIdea: {
          title: '抢答',
          description: '课堂抢答'
        },
        theme: {
          primary: '#1F3B73',
          accent: '#4C8BF5',
          background: '#F8FAFC',
          text: '#0F172A',
          font: 'Microsoft YaHei'
        },
        layoutHints: ['cover_right_panel'],
        ppt: [
          { id: 'slide-1', title: '封面', type: 'cover', bullets: ['初二', '45分钟'] },
          { id: 'slide-2', title: '目录', type: 'toc', bullets: ['光反应', '暗反应'] }
        ]
      },
      plan: {
        designPreset: 'classroom',
        lessonPlan: {
          goals: '理解概念',
          process: ['导入', '讲解', '练习', '总结', '作业'],
          methods: '探究式',
          activities: '讨论',
          homework: '复习'
        },
        interactionIdea: {
          title: '抢答',
          description: '课堂抢答'
        },
        theme: {
          primary: '#1F3B73',
          accent: '#4C8BF5',
          background: '#F8FAFC',
          text: '#0F172A',
          font: 'Microsoft YaHei'
        },
        layoutHints: ['cover_right_panel'],
        outlines: [
          { id: 'slide-1', title: '封面', type: 'cover', bullets: ['初二', '45分钟'] },
          { id: 'slide-2', title: '目录', type: 'toc', bullets: ['光反应', '暗反应'] },
          { id: 'slide-3', title: '光反应', type: 'content', layout: 'process', bullets: ['条件', '过程', '产物'] },
          { id: 'slide-4', title: '总结', type: 'summary', bullets: ['回顾', '提问', '作业'] }
        ]
      }
    },
    onOutline: (payload) => outlineEvents.push(payload),
    slideGenerator: async (_, context) => {
      slideCallContexts.push({
        outlineIndex: context.outlineIndex,
        generatedSlides: context.generatedSlides.length,
        previousTitles: context.generatedSlides.map((item) => item.title)
      });
      return {
        ...context.outline,
        example: `恢复案例 ${context.outlineIndex + 1}`
      };
    }
  });

  assert.equal(outlineEvents.length, 4);
  assert.ok(outlineEvents.every((item) => item.resume === true));
  assert.deepEqual(slideCallContexts, [
    { outlineIndex: 2, generatedSlides: 2, previousTitles: ['封面', '目录'] },
    { outlineIndex: 3, generatedSlides: 3, previousTitles: ['封面', '目录', '光反应'] }
  ]);
  assert.equal(result.draft.ppt.length, 4);
  assert.equal(result.draft.ppt[2].layout, 'process');
  assert.equal(result.draft.ppt[2].example, '恢复案例 3');
});

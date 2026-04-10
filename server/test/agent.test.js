const test = require('node:test');
const assert = require('node:assert/strict');

const { createInitialState, generatePresentation, mergeFields, buildIntentPayload } = require('../agent');

test('generatePresentation returns missing_fields when required fields are incomplete', async () => {
  const state = createInitialState();
  mergeFields(state, {
    subject: '光合作用',
    grade: '初二'
  });

  const result = await generatePresentation(state);

  assert.equal(result.error, 'missing_fields');
  assert.deepEqual(result.missingFields, ['duration', 'goals', 'keyPoints']);
  assert.equal(state.ready, false);
  assert.equal(result.draft, null);
});

test('generatePresentation falls back to local draft generation without LLM config', async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = '';

  const state = createInitialState();
  mergeFields(state, {
    subject: '光合作用',
    grade: '初二',
    duration: '45分钟',
    goals: '理解光合作用的基本原理',
    keyPoints: ['光反应', '暗反应'],
    interactions: '课堂抢答'
  });

  const result = await generatePresentation(state);
  const intent = buildIntentPayload(result.state);

  assert.equal(result.error, undefined);
  assert.ok(result.draft);
  assert.ok(result.classroom);
  assert.ok(Array.isArray(result.draft.ppt));
  assert.ok(result.draft.ppt.length >= 4);
  assert.equal(result.classroom.scenes.length, result.draft.ppt.length);
  assert.equal(result.state.confirmed, true);
  assert.equal(result.state.sceneStatus, 'ready');
  assert.equal(result.state.generation.completedOutlines, result.draft.ppt.length);
  assert.equal(result.state.generation.completedSlides, result.draft.ppt.length);
  assert.equal(result.state.generation.outlines.length, result.draft.ppt.length);
  assert.equal(result.state.generation.slideStates.length, result.draft.ppt.length);
  assert.equal(intent.nextAction, 'edit_existing');
  assert.equal(intent.showGenerateCTA, false);
  assert.ok(result.reply.includes('PPT 已开始生成'));

  process.env.OPENAI_API_KEY = originalApiKey;
});

test('generatePresentation resumes from interrupted state and preserves completed slide state', async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = '';

  const state = createInitialState();
  mergeFields(state, {
    subject: '光合作用',
    grade: '初二',
    duration: '45分钟',
    goals: '理解光合作用的基本原理',
    keyPoints: ['光反应', '暗反应'],
    interactions: '课堂抢答'
  });

  const initial = await generatePresentation(state);
  assert.equal(initial.error, undefined);
  assert.ok(initial.state.generation.designPreset);

  const resumeState = createInitialState();
  mergeFields(resumeState, {
    subject: '光合作用',
    grade: '初二',
    duration: '45分钟',
    goals: '理解光合作用的基本原理',
    keyPoints: ['光反应', '暗反应'],
    interactions: '课堂抢答'
  });
  resumeState.brief = state.brief;
  resumeState.rag = initial.state.rag || [];
  resumeState.draft = {
    ...initial.draft,
    ppt: initial.draft.ppt.slice(0, 3)
  };
  resumeState.scene = {
    ...initial.scene,
    slides: initial.scene.slides.slice(0, 3)
  };
  resumeState.sceneStatus = 'drafting';
  resumeState.generation = {
    ...initial.state.generation,
    status: 'interrupted',
    currentStage: 'slides',
    statusMessage: '生成已中断，已完成 3 页',
    completedSlides: 3,
    currentSlideIndex: 2,
    completedAt: '',
    canResume: true,
    slideStates: initial.state.generation.slideStates.map((item, index) => ({
      ...item,
      status: index < 3 ? 'completed' : 'pending'
    }))
  };

  const resumed = await generatePresentation(resumeState);

  assert.equal(resumed.error, undefined);
  assert.ok(resumed.classroom);
  assert.ok(resumed.reply.includes('已继续完成 PPT 生成'));
  assert.equal(resumed.state.generation.completedSlides, resumed.draft.ppt.length);
  assert.equal(resumed.classroom.scenes.length, resumed.draft.ppt.length);
  assert.ok(resumed.state.generation.slideStates.every((item) => item.status === 'completed'));
  assert.equal(resumed.state.generation.designPreset, initial.state.generation.designPreset);

  process.env.OPENAI_API_KEY = originalApiKey;
});

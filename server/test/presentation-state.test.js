const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStreamingPreviewDraft,
  createDraftPreviewTracker,
  syncClientPresentationState
} = require('../ppt/presentation-state');

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
      mergedPrompt: '给初二讲光合作用',
      updatedAt: new Date().toISOString()
    },
    draft: null,
    scene: null,
    sceneStatus: 'idle',
    sceneSource: '',
    sceneUpdatedAt: '',
    sceneVersion: 0
  };
}

test('buildStreamingPreviewDraft preserves previous slide ids and inferred preset data', () => {
  const state = createState();
  const previousDraft = {
    designPreset: 'classroom',
    ppt: [{ id: 'slide-1', title: '旧标题', type: 'cover', bullets: [] }],
    lessonPlan: { goals: '旧目标', process: ['导入'], methods: '互动', activities: '讨论', homework: '复习' },
    interactionIdea: { title: '旧互动', description: '旧描述' },
    theme: { primary: '#000000', accent: '#ffffff', background: '#eeeeee', text: '#111111', font: 'Microsoft YaHei' },
    layoutHints: ['summary_cards']
  };

  const draft = buildStreamingPreviewDraft(state, [
    { title: '封面', type: 'cover', bullets: ['初二', '45分钟'] },
    { title: '目录', type: 'toc', bullets: ['光反应', '暗反应'] }
  ], previousDraft, 'classroom');

  assert.equal(draft.designPreset, 'classroom');
  assert.equal(draft.ppt[0].id, 'slide-1');
  assert.equal(draft.lessonPlan.goals, '旧目标');
  assert.ok(Array.isArray(draft.layoutHints));
  assert.ok(draft.updatedAt);
});

test('createDraftPreviewTracker emits progressive draft previews from partial JSON', () => {
  const state = createState();
  const payloads = [];
  const tracker = createDraftPreviewTracker(state, (payload) => payloads.push(payload));

  tracker('', '{"designPreset":"classroom","ppt":[{"title":"封面","type":"cover","bullets":["初二"]}');
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].slideCount, 1);
  assert.equal(payloads[0].draft.designPreset, 'classroom');
  assert.equal(payloads[0].sceneStatus, 'drafting');

  tracker('', '{"designPreset":"classroom","ppt":[{"title":"封面","type":"cover","bullets":["初二"]},{"title":"目录","type":"toc","bullets":["光反应","暗反应"]}');
  assert.equal(payloads.length, 2);
  assert.equal(payloads[1].slideCount, 2);
  assert.equal(payloads[1].draft.ppt[0].id, payloads[0].draft.ppt[0].id);
});

test('syncClientPresentationState merges incoming scene into draft and updates scene state', () => {
  const state = createState();
  const draft = {
    designPreset: 'corporate',
    brief: state.brief,
    theme: {
      primary: '#1F3B73',
      accent: '#4C8BF5',
      background: '#F8FAFC',
      text: '#0F172A',
      font: 'Microsoft YaHei'
    },
    layoutHints: ['cover_right_panel'],
    lessonPlan: { goals: '理解原理', process: ['导入', '讲解'], methods: '讲授', activities: '讨论', homework: '复习' },
    interactionIdea: { title: '抢答', description: '分组抢答' },
    ppt: [
      { id: 'cover-1', title: '光合作用', type: 'cover', bullets: ['初二', '45分钟'], example: '', question: '', visual: '', notes: '', teachingGoal: '', speakerNotes: '', commonMistakes: [] },
      { id: 'toc-1', title: '目录', type: 'toc', bullets: ['光反应', '暗反应'], example: '', question: '', visual: '', notes: '', teachingGoal: '', speakerNotes: '', commonMistakes: [] },
      { id: 'content-1', title: '光反应', type: 'content', bullets: ['定义', '过程'], example: '实验', question: '为什么需要光？', visual: '流程图', notes: '重点', teachingGoal: '理解光反应', speakerNotes: '', commonMistakes: ['混淆场所'] },
      { id: 'summary-1', title: '总结', type: 'summary', bullets: ['回顾要点'], example: '', question: '', visual: '', notes: '', teachingGoal: '', speakerNotes: '', commonMistakes: [] }
    ],
    updatedAt: new Date().toISOString()
  };

  const scene = {
    designPreset: 'editorial',
    theme: draft.theme,
    layoutHints: ['summary_cards'],
    slides: [
      {
        id: 'cover-1',
        title: '光合作用',
        role: 'cover',
        variant: 'cover',
        background: { type: 'solid', color: '#F8FAFC' },
        blocks: [
          { id: 't1', type: 'title', title: '', text: '光合作用', items: [], box: { x: 0.8, y: 0.5, w: 10, h: 1 } }
        ]
      },
      {
        id: 'toc-1',
        title: '目录',
        role: 'toc',
        variant: 'toc',
        background: { type: 'solid', color: '#F8FAFC' },
        blocks: [
          { id: 't2', type: 'title', title: '', text: '目录', items: [], box: { x: 0.8, y: 0.5, w: 10, h: 1 } },
          { id: 'b2', type: 'bullets', title: '', text: '', items: ['光反应', '暗反应'], box: { x: 0.8, y: 1.8, w: 10, h: 3 } }
        ]
      },
      {
        id: 'content-1',
        title: '光反应',
        role: 'content',
        variant: 'case',
        background: { type: 'solid', color: '#F8FAFC' },
        blocks: [
          { id: 't3', type: 'title', title: '', text: '光反应', items: [], box: { x: 0.8, y: 0.5, w: 10, h: 1 } },
          { id: 'b3', type: 'columns', title: '', text: '', items: ['定义', '过程'], box: { x: 0.8, y: 1.8, w: 10, h: 3 } },
          { id: 'c3', type: 'callout', title: '案例提示', text: '实验', items: [], box: { x: 0.8, y: 5, w: 5, h: 1 } },
          { id: 'q3', type: 'question', title: '课堂提问', text: '为什么需要光？', items: [], box: { x: 6, y: 5, w: 4, h: 1 } }
        ]
      },
      {
        id: 'summary-1',
        title: '总结',
        role: 'summary',
        variant: 'summary',
        background: { type: 'solid', color: '#F8FAFC' },
        blocks: [
          { id: 't4', type: 'title', title: '', text: '总结', items: [], box: { x: 0.8, y: 0.5, w: 10, h: 1 } }
        ]
      }
    ],
    updatedAt: new Date().toISOString()
  };

  const synced = syncClientPresentationState(state, draft, scene);

  assert.ok(synced.draft);
  assert.ok(synced.scene);
  assert.equal(state.sceneSource, 'client');
  assert.equal(state.sceneStatus, 'ready');
  assert.equal(state.draft.designPreset, 'editorial');
  assert.equal(state.draft.ppt[2].question, '为什么需要光？');
});

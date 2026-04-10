const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractIntentWithLLM,
  generateDraftWithLLM,
  generatePptOutlineWithLLM
} = require('../llm');

function createSseResponse(events) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`${events.join('\n\n')}\n\n`));
      controller.close();
    }
  });

  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'text/event-stream' : null;
      }
    },
    body
  };
}

function buildResponseCompletedEvent(outputText) {
  return [
    'event: response.completed',
    `data: ${JSON.stringify({
      type: 'response.completed',
      response: {
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: outputText
              }
            ]
          }
        ]
      }
    })}`
  ].join('\n');
}

test('generateDraftWithLLM uses responses SSE path even without onTextDelta', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://unit.test/v1';

  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({
      url,
      body: JSON.parse(options.body)
    });

    return createSseResponse([
      buildResponseCompletedEvent(JSON.stringify({
        designPreset: 'corporate',
        brief: {
          mergedPrompt: '测试',
          rawInputs: []
        },
        ppt: [
          {
            title: '封面',
            type: 'cover',
            bullets: ['测试内容'],
            example: '',
            question: '',
            visual: '',
            notes: '',
            teachingGoal: '',
            speakerNotes: '',
            commonMistakes: [],
            citations: []
          }
        ],
        lessonPlan: {
          goals: '测试目标',
          process: ['步骤1', '步骤2', '步骤3', '步骤4', '步骤5'],
          methods: '讲授法',
          activities: '活动',
          homework: '作业'
        },
        interactionIdea: {
          title: '互动',
          description: '描述'
        },
        theme: {
          primary: '#123456',
          accent: '#abcdef',
          background: '#ffffff',
          text: '#111111',
          font: 'Microsoft YaHei'
        },
        layoutHints: ['cover_right_panel']
      }))
    ]);
  };

  try {
    const state = {
      fields: {
        subject: '光合作用',
        grade: '初二',
        duration: '45分钟',
        goals: '理解原理',
        keyPoints: ['条件', '过程'],
        style: '课堂讲解',
        interactions: '讨论'
      },
      brief: {
        mergedPrompt: '测试',
        rawInputs: [{ source: 'user', text: '测试' }]
      }
    };

    const result = await generateDraftWithLLM({ state, ragContext: [] });

    assert.equal(result.designPreset, 'corporate');
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/responses$/);
    assert.equal(requests[0].body.stream, true);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_BASE_URL = originalBaseUrl;
  }
});

test('extractIntentWithLLM parses streamed deltas and returns JSON', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://unit.test/v1';

  const seenDeltas = [];
  global.fetch = async () => createSseResponse([
    [
      'event: response.output_text.delta',
      `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: '{"assistantReply":"你' })}`
    ].join('\n'),
    [
      'event: response.output_text.delta',
      `data: ${JSON.stringify({ type: 'response.output_text.delta', delta: '好","nextAction":"ready_to_generate"}' })}`
    ].join('\n')
  ]);

  try {
    const result = await extractIntentWithLLM({
      state: {
        fields: {},
        brief: null
      },
      messages: [],
      text: '帮我生成课件',
      onTextDelta(delta) {
        seenDeltas.push(delta);
      }
    });

    assert.equal(result.assistantReply, '你好');
    assert.equal(result.nextAction, 'ready_to_generate');
    assert.deepEqual(seenDeltas, ['{"assistantReply":"你', '好","nextAction":"ready_to_generate"}']);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_BASE_URL = originalBaseUrl;
  }
});

test('generatePptOutlineWithLLM sends layout-aware OpenMAIC-style outline prompt over responses SSE', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalBaseUrl = process.env.OPENAI_BASE_URL;

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://unit.test/v1';

  const requests = [];
  global.fetch = async (url, options = {}) => {
    requests.push({
      url,
      body: JSON.parse(options.body)
    });

    return createSseResponse([
      buildResponseCompletedEvent(JSON.stringify({
        designPreset: 'classroom',
        brief: {
          mergedPrompt: '测试',
          rawInputs: []
        },
        outlines: [
          {
            title: '封面',
            type: 'cover',
            layout: '',
            bullets: ['初二', '45分钟'],
            notes: '',
            teachingGoal: '',
            speakerNotes: '',
            commonMistakes: [],
            citations: []
          }
        ],
        lessonPlan: {
          goals: '测试目标',
          process: ['步骤1', '步骤2', '步骤3', '步骤4', '步骤5'],
          methods: '讲授法',
          activities: '活动',
          homework: '作业'
        },
        interactionIdea: {
          title: '互动',
          description: '描述'
        },
        theme: {
          primary: '#123456',
          accent: '#abcdef',
          background: '#ffffff',
          text: '#111111',
          font: 'Microsoft YaHei'
        },
        layoutHints: ['cover_right_panel']
      }))
    ]);
  };

  try {
    await generatePptOutlineWithLLM({
      state: {
        fields: {
          subject: '光合作用',
          grade: '初二',
          duration: '45分钟',
          goals: '理解原理',
          keyPoints: ['条件', '过程'],
          style: '课堂讲解',
          interactions: '讨论'
        },
        brief: {
          mergedPrompt: '测试',
          rawInputs: [{ source: 'user', text: '测试' }]
        }
      },
      ragContext: []
    });

    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/responses$/);
    assert.equal(requests[0].body.stream, true);
    assert.match(requests[0].body.input[0].content, /OpenMAIC/);
    assert.match(requests[0].body.input[0].content, /"layout"/);
    assert.match(requests[0].body.input[0].content, /layout 选择规则/);
  } finally {
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_BASE_URL = originalBaseUrl;
  }
});

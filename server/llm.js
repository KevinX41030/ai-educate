const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

function isLLMConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function shouldDebug() {
  return process.env.LLM_DEBUG === '1';
}

function debugLog(label, payload) {
  if (!shouldDebug()) return;
  const content = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload, null, 2);
  console.log(`[LLM_DEBUG] ${label}:\n${content}`);
}

function logRequestBody(label, payload) {
  const content = typeof payload === 'string'
    ? payload
    : JSON.stringify(payload, null, 2);
  console.log(`[LLM_REQUEST] ${label}:\n${content}`);
}

function normalizeBaseUrl(url) {
  if (!url) return DEFAULT_BASE_URL;
  return url.replace(/\/+$/, '');
}

function buildHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
  };
  if (process.env.OPENAI_ORG_ID) {
    headers['OpenAI-Organization'] = process.env.OPENAI_ORG_ID;
  }
  if (process.env.OPENAI_PROJECT_ID) {
    headers['OpenAI-Project'] = process.env.OPENAI_PROJECT_ID;
  }
  return headers;
}

function extractOutputText(response) {
  if (!response) return '';
  if (typeof response.output_text === 'string') return response.output_text;
  if (Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type !== 'message') continue;
      const content = item.content || [];
      if (typeof content === 'string') return content;
      for (const part of content) {
        if (!part) continue;
        if (part.type === 'output_text' || part.type === 'text') {
          return part.text || '';
        }
      }
    }
  }
  if (typeof response.text === 'string') return response.text;
  return '';
}

async function callResponsesApi(payload) {
  if (!isLLMConfigured()) return null;

  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL);
  logRequestBody('responses', payload);
  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`openai_error_${response.status}: ${errorText}`);
  }

  return response.json();
}

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
}

async function callChatCompletionsApi(payload) {
  if (!isLLMConfigured()) return null;
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL);
  logRequestBody('chat_completions', payload);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`openai_chat_error_${response.status}: ${errorText}`);
  }

  return response.json();
}

function extractChatText(response) {
  const message = response?.choices?.[0]?.message;
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  return '';
}

function buildContext(state, messages, text) {
  const history = (messages || [])
    .slice(-6)
    .map((item) => `${item.role === 'assistant' ? '助手' : '用户'}：${item.text}`)
    .join('\n');

  const fields = state?.fields || {};
  const keyPoints = Array.isArray(fields.keyPoints) ? fields.keyPoints.join('、') : '';

  return [
    `当前已知信息：`,
    `主题/章节：${fields.subject || '未填写'}`,
    `年级/学段：${fields.grade || '未填写'}`,
    `课堂时长：${fields.duration || '未填写'}`,
    `教学目标：${fields.goals || '未填写'}`,
    `核心知识点：${keyPoints || '未填写'}`,
    `教学风格：${fields.style || '未填写'}`,
    `互动设计：${fields.interactions || '未填写'}`,
    history ? `\n对话历史：\n${history}` : '',
    `\n用户最新输入：${text}`
  ].filter(Boolean).join('\n');
}

async function extractIntentWithLLM({ state, messages, text }) {
  if (!isLLMConfigured()) return null;

  const payload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [
      {
        role: 'system',
        content:
          '你是教学智能体的需求分析助手。请根据用户输入更新教学意图字段，并判断用户意图。' +
          '仅输出 JSON，不要输出其他文本。JSON 格式: {' +
          '"fields": {"subject": string|null, "grade": string|null, "duration": string|null, "goals": string|null, "keyPoints": string[]|null, "style": string|null, "interactions": string|null},' +
          '"intent": "provide_info"|"confirm"|"edit"|"other",' +
          '"edit": string|null' +
          '}。' +
          '允许合理归纳与推断（例如“给初二讲光合作用”→ subject=光合作用, grade=初二）。' +
          '如果无法判断则返回 null，不要编造。' +
          '当用户只是问候/闲聊且没有课程信息时，intent=other。' +
          '只要出现有效字段，intent=provide_info。'
      },
      {
        role: 'user',
        content: buildContext(state, messages, text)
      }
    ],
    text: { format: { type: 'json_object' } }
  };

  let response;
  try {
    response = await callResponsesApi(payload);
    debugLog('responses_raw', response);
    const outputText = extractOutputText(response);
    debugLog('responses_text', outputText);
    const parsed = safeJsonParse(outputText);
    if (parsed) return parsed;
  } catch (error) {
    debugLog('responses_error', String(error));
    response = null;
  }

  const chatPayload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    messages: [
      payload.input[0],
      payload.input[1]
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2
  };

  const chatResponse = await callChatCompletionsApi(chatPayload);
  debugLog('chat_raw', chatResponse);
  const chatText = extractChatText(chatResponse);
  debugLog('chat_text', chatText);
  return safeJsonParse(chatText);
}

async function generateDraftWithLLM({ state, ragContext = [] }) {
  if (!isLLMConfigured()) return null;

  const fields = state.fields || {};
  const knowledge = Array.isArray(ragContext) && ragContext.length
    ? ragContext.map((item, idx) => `(${idx + 1}) [${item.source}] ${item.content}`).join('\n')
    : '';
  const payload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [
      {
        role: 'system',
        content:
          '你是教学课件生成助手。请根据给定教学意图生成课件草稿。' +
          '仅输出 JSON，不要输出其他文本。JSON 格式: {' +
          '"designPreset": "corporate"|"editorial"|"classroom",' +
          '"ppt": [{"title": string, "type": "cover"|"toc"|"content"|"summary", "bullets": string[]}],' +
          '"lessonPlan": {"goals": string, "process": string[], "methods": string, "activities": string, "homework": string},' +
          '"interactionIdea": {"title": string, "description": string},' +
          '"theme": {"primary": string, "accent": string, "background": string, "text": string, "font": string},' +
          '"layoutHints": string[]' +
          '}。' +
          'PPT 至少包含封面、目录、总结页。内容页每个知识点至少 2 页：概念/原理页 + 应用/案例/易错点页。' +
          '每页 3-5 条 bullets，使用完整短句，保证信息量充足。' +
          'lessonPlan.process 至少 5 个步骤，activities/homework 要具体可执行。' +
          'designPreset 用法：理科/严谨/清爽用 corporate，人文/极简/高级感用 editorial，低龄/互动/趣味课堂用 classroom。' +
          'theme 要和 designPreset 保持一致，不要所有课都给企业蓝。' +
          'layoutHints 可包含 cover_right_panel、content_two_column、summary_cards。'
      },
      {
        role: 'user',
        content: JSON.stringify({
          subject: fields.subject,
          grade: fields.grade,
          duration: fields.duration,
          goals: fields.goals,
          keyPoints: fields.keyPoints,
          style: fields.style,
          interactions: fields.interactions
        })
      },
      {
        role: 'user',
        content: knowledge ? `可参考的知识库片段：\n${knowledge}` : '无额外知识库片段。'
      }
    ],
    text: { format: { type: 'json_object' } }
  };

  let responsesFailure = null;

  try {
    const response = await callResponsesApi(payload);
    debugLog('responses_draft_raw', response);
    const outputText = extractOutputText(response);
    debugLog('responses_draft_text', outputText);
    const parsed = safeJsonParse(outputText);
    if (parsed) return parsed;
    responsesFailure = new Error('responses_draft_invalid_json');
  } catch (error) {
    debugLog('responses_draft_error', String(error));
    responsesFailure = error;
  }

  const chatPayload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    messages: [
      payload.input[0],
      payload.input[1],
      payload.input[2]
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  };
  try {
    const chatResponse = await callChatCompletionsApi(chatPayload);
    debugLog('chat_draft_raw', chatResponse);
    const chatText = extractChatText(chatResponse);
    debugLog('chat_draft_text', chatText);
    const parsed = safeJsonParse(chatText);
    if (parsed) return parsed;
    throw new Error('chat_draft_invalid_json');
  } catch (error) {
    debugLog('chat_draft_error', String(error));
    throw new Error(`draft_generation_failed: responses=${String(responsesFailure)}; chat=${String(error)}`);
  }
}

async function generatePptSpecWithLLM({ draft, ragContext = [] }) {
  if (!isLLMConfigured()) return null;
  if (!draft || !Array.isArray(draft.ppt)) return null;

  const knowledge = Array.isArray(ragContext) && ragContext.length
    ? ragContext.map((item, idx) => `(${idx + 1}) [${item.source}] ${item.content}`).join('\n')
    : '';

  const payload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [
      {
        role: 'system',
        content:
          '你是教学课件设计师。根据已有草稿生成更丰富的PPT内容与版式方案。' +
          '仅输出 JSON，不要输出其他文本。JSON 格式: {' +
          '"designPreset": "corporate"|"editorial"|"classroom",' +
          '"slides": [{' +
          '"title": string,' +
          '"type": "cover"|"toc"|"content"|"summary",' +
          '"layout": "concept"|"process"|"case"|"activity",' +
          '"bullets": string[],' +
          '"example": string,' +
          '"question": string,' +
          '"visual": string,' +
          '"notes": string' +
          '}],' +
          '"theme": {"primary": string, "accent": string, "background": string, "text": string, "font": string},' +
          '"layoutHints": string[]' +
          '}。' +
          '内容页请补充示例、互动提问、视觉提示(如流程图/示意图)。' +
          '为每个内容页选择合适 layout：概念/原理=concept，步骤/流程=process，应用/案例=case，练习/讨论/活动=activity。' +
          '如有教学流程/互动设计/练习/案例，请生成对应内容页并匹配 layout。' +
          '总页数建议 10-16 页，内容页每页 4-6 条 bullets，确保内容丰富。' +
          '封面/目录/总结页也可补充简要说明。' +
          'designPreset 要和主题气质一致，不要固定成一种风格。'
      },
      {
        role: 'user',
        content: JSON.stringify({
          designPreset: draft.designPreset || null,
          slides: draft.ppt,
          lessonPlan: draft.lessonPlan || null,
          interactionIdea: draft.interactionIdea || null,
          theme: draft.theme || null,
          layoutHints: draft.layoutHints || null
        })
      },
      {
        role: 'user',
        content: knowledge ? `可参考的知识库片段：\n${knowledge}` : '无额外知识库片段。'
      }
    ],
    text: { format: { type: 'json_object' } }
  };

  try {
    const response = await callResponsesApi(payload);
    debugLog('responses_spec_raw', response);
    const outputText = extractOutputText(response);
    debugLog('responses_spec_text', outputText);
    const parsed = safeJsonParse(outputText);
    if (parsed) return parsed;
  } catch (error) {
    debugLog('responses_spec_error', String(error));
  }

  const chatPayload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    messages: [payload.input[0], payload.input[1], payload.input[2]],
    response_format: { type: 'json_object' },
    temperature: 0.4
  };
  const chatResponse = await callChatCompletionsApi(chatPayload);
  debugLog('chat_spec_raw', chatResponse);
  const chatText = extractChatText(chatResponse);
  debugLog('chat_spec_text', chatText);
  return safeJsonParse(chatText);
}

async function generatePptSceneWithLLM({ draft, ragContext = [] }) {
  if (!isLLMConfigured()) return null;
  if (!draft || !Array.isArray(draft.ppt)) return null;

  const knowledge = Array.isArray(ragContext) && ragContext.length
    ? ragContext.map((item, idx) => `(${idx + 1}) [${item.source}] ${item.content}`).join('\n')
    : '';

  const payload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    input: [
      {
        role: 'system',
        content:
          '你是教学课件设计师。请根据已有草稿生成用于页面预览与 PPT 导出的 scene JSON。' +
          '仅输出 JSON，不要输出其他文本。JSON 格式: {' +
          '"designPreset": "corporate"|"editorial"|"classroom",' +
          '"theme": {"primary": string, "accent": string, "background": string, "text": string, "font": string},' +
          '"layoutHints": string[],' +
          '"slides": [{' +
          '"title": string,' +
          '"role": "cover"|"toc"|"content"|"summary",' +
          '"variant": "cover"|"toc"|"concept"|"process"|"case"|"activity"|"summary",' +
          '"notes": string,' +
          '"blocks": [{' +
          '"type": "title"|"subtitle"|"bullets"|"callout"|"question"|"summaryCards"|"factCards"|"steps"|"columns"|"taskCards",' +
          '"title": string,' +
          '"text": string,' +
          '"items": string[]' +
          '}]' +
          '}]' +
          '}。' +
          '封面至少包含 title/subtitle；目录页包含 bullets；总结页优先使用 summaryCards。' +
          '内容页不要都做成一个大 bullets 框。概念页优先用 factCards，流程页优先用 steps，案例页优先用 columns，活动页优先用 taskCards。' +
          'designPreset 只能从 corporate、editorial、classroom 中选择，并与主题风格一致。' +
          '不要输出 markdown，不要解释。'
      },
      {
        role: 'user',
        content: JSON.stringify({
          designPreset: draft.designPreset || null,
          slides: draft.ppt,
          lessonPlan: draft.lessonPlan || null,
          interactionIdea: draft.interactionIdea || null,
          theme: draft.theme || null,
          layoutHints: draft.layoutHints || null
        })
      },
      {
        role: 'user',
        content: knowledge ? `可参考的知识库片段：\n${knowledge}` : '无额外知识库片段。'
      }
    ],
    text: { format: { type: 'json_object' } }
  };

  try {
    const response = await callResponsesApi(payload);
    debugLog('responses_scene_raw', response);
    const outputText = extractOutputText(response);
    debugLog('responses_scene_text', outputText);
    const parsed = safeJsonParse(outputText);
    if (parsed) return parsed;
  } catch (error) {
    debugLog('responses_scene_error', String(error));
  }

  const chatPayload = {
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    messages: [payload.input[0], payload.input[1], payload.input[2]],
    response_format: { type: 'json_object' },
    temperature: 0.4
  };
  const chatResponse = await callChatCompletionsApi(chatPayload);
  debugLog('chat_scene_raw', chatResponse);
  const chatText = extractChatText(chatResponse);
  debugLog('chat_scene_text', chatText);
  return safeJsonParse(chatText);
}

module.exports = {
  extractIntentWithLLM,
  generateDraftWithLLM,
  generatePptSpecWithLLM,
  generatePptSceneWithLLM,
  isLLMConfigured
};

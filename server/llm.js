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
  const preview = typeof payload === 'string'
    ? payload.slice(0, 800)
    : JSON.stringify(payload).slice(0, 800);
  console.log(`[LLM_DEBUG] ${label}: ${preview}`);
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
    text: { format: { type: 'json_object' } },
    max_output_tokens: 800
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
          '"ppt": [{"title": string, "type": "cover"|"toc"|"content"|"summary", "bullets": string[]}],' +
          '"lessonPlan": {"goals": string, "process": string[], "methods": string, "activities": string, "homework": string},' +
          '"interactionIdea": {"title": string, "description": string},' +
          '"theme": {"primary": string, "accent": string, "background": string, "text": string, "font": string},' +
          '"layoutHints": string[]' +
          '}。' +
          'PPT 至少包含封面、目录、内容页（每个知识点一页）、总结页。' +
          '请提供现代企业蓝风格的 theme，例如 primary=#1F3B73, accent=#4C8BF5。' +
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
    text: { format: { type: 'json_object' } },
    max_output_tokens: 1200
  };

  try {
    const response = await callResponsesApi(payload);
    debugLog('responses_draft_raw', response);
    const outputText = extractOutputText(response);
    debugLog('responses_draft_text', outputText);
    const parsed = safeJsonParse(outputText);
    if (parsed) return parsed;
  } catch (error) {
    debugLog('responses_draft_error', String(error));
    // fallback to chat below
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
  const chatResponse = await callChatCompletionsApi(chatPayload);
  debugLog('chat_draft_raw', chatResponse);
  const chatText = extractChatText(chatResponse);
  debugLog('chat_draft_text', chatText);
  return safeJsonParse(chatText);
}

module.exports = {
  extractIntentWithLLM,
  generateDraftWithLLM,
  isLLMConfigured
};

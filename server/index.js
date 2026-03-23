const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const { createInitialState, handleMessage, generatePresentation, buildIntentPayload, mergeFields } = require('./agent');
const { getStats, searchKnowledge, reloadKnowledgeBase } = require('./rag');
const { isLLMConfigured, generatePptSceneWithLLM, generateSingleSlideWithLLM } = require('./llm');
const { exportPptx } = require('./export/pptx');
const { buildPptSceneFromDraft, normalizeScene, mergeSceneIntoDraft } = require('./ppt/scene');
const { inferDesignPreset, mergeThemeWithPreset, getDesignPresetHints } = require('./ppt/design');

const app = express();
const PORT = process.env.PORT || 5174;
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${nanoid(6)}${ext}`);
  }
});

const upload = multer({ storage });

app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

const sessions = new Map();

function getSession(id) {
  if (!id || !sessions.has(id)) {
    const state = createInitialState();
    sessions.set(state.id, {
      id: state.id,
      state,
      messages: []
    });
  }
  return sessions.get(id) || Array.from(sessions.values()).pop();
}

function applySceneToState(state, scene, source = 'draft', status = 'ready') {
  if (!state) return;
  state.scene = scene;
  state.sceneSource = scene ? source : '';
  state.sceneStatus = scene ? status : 'idle';
  state.sceneUpdatedAt = scene?.updatedAt || '';
  state.sceneVersion = (state.sceneVersion || 0) + (scene ? 1 : 0);
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
    if (!state.scene) {
      const fallbackScene = buildPptSceneFromDraft(draft);
      if (fallbackScene) {
        applySceneToState(state, fallbackScene, 'draft', isLLMConfigured() ? 'stale' : 'ready');
      }
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

function initSse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      writeSseEvent(res, 'ping', { ts: Date.now() });
    }
  }, 15000);

  const cleanup = () => clearInterval(heartbeat);
  res.on('close', cleanup);
  return cleanup;
}

function writeSseEvent(res, event, data = {}) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function endSse(res, cleanup, payload = { ok: true }) {
  cleanup?.();
  if (!res.writableEnded) {
    writeSseEvent(res, 'done', payload);
    res.end();
  }
}

function extractJsonErrorMessage(text = '') {
  try {
    const parsed = JSON.parse(text);
    return parsed?.error?.message || parsed?.message || '';
  } catch (error) {
    return '';
  }
}

function stripHtml(text = '') {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractErrorHost(text = '') {
  const titleMatch = String(text || '').match(/<title>\s*([^|<]+?)\s*\|/i);
  if (titleMatch?.[1]) return titleMatch[1].trim();
  const hostMatch = String(text || '').match(/\b(?:api\.)?[a-z0-9.-]+\.[a-z]{2,}\b/i);
  return hostMatch?.[0] || '';
}

function toClientErrorMessage(error, fallback = '请求失败，请稍后重试。') {
  const raw = error instanceof Error ? error.message : String(error || '');
  if (!raw) return fallback;

  const upstreamMatch = raw.match(/openai(?:_chat)?_error_(\d+):\s*([\s\S]*)$/);
  if (upstreamMatch) {
    const status = upstreamMatch[1];
    const body = upstreamMatch[2] || '';
    const jsonMessage = extractJsonErrorMessage(body);
    if (jsonMessage) {
      return `模型服务请求失败（${status}）：${jsonMessage}`;
    }

    if (/<(?:!DOCTYPE|html)\b/i.test(body)) {
      const host = extractErrorHost(body);
      return `模型服务上游暂时不可用（${status}${host ? `，${host}` : ''}），请稍后重试。`;
    }

    const compact = stripHtml(body);
    if (compact) {
      return `模型服务请求失败（${status}）：${compact.slice(0, 200)}`;
    }

    return `模型服务请求失败（${status}），请稍后重试。`;
  }

  return stripHtml(raw) || fallback;
}

function writeSseErrorAndEnd(res, cleanup, data = {}) {
  writeSseEvent(res, 'error', data);
  return endSse(res, cleanup, {
    ok: false,
    error: data.error || 'stream_failed'
  });
}

function extractPartialJsonStringField(text, fieldName) {
  const fieldToken = `"${fieldName}"`;
  const fieldIndex = text.indexOf(fieldToken);
  if (fieldIndex < 0) return null;

  let index = fieldIndex + fieldToken.length;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  if (text[index] !== ':') return null;

  index += 1;
  while (index < text.length && /\s/.test(text[index])) index += 1;
  if (text[index] !== '"') return null;

  index += 1;
  let decoded = '';
  let escaped = false;

  for (; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      if (char === 'u') {
        const hex = text.slice(index + 1, index + 5);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) break;
        decoded += String.fromCharCode(Number.parseInt(hex, 16));
        index += 4;
      } else {
        const ESCAPE_MAP = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t'
        };
        decoded += ESCAPE_MAP[char] ?? char;
      }
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      return decoded;
    }

    decoded += char;
  }

  return decoded;
}

function createJsonFieldDeltaTracker(fieldName, onDelta) {
  let rawText = '';
  let emittedText = '';

  return (delta) => {
    rawText += String(delta || '');
    const currentText = extractPartialJsonStringField(rawText, fieldName);
    if (typeof currentText !== 'string') return;
    if (!currentText.startsWith(emittedText)) {
      let prefixLength = 0;
      const maxPrefix = Math.min(currentText.length, emittedText.length);
      while (prefixLength < maxPrefix && currentText[prefixLength] === emittedText[prefixLength]) {
        prefixLength += 1;
      }
      const nextDelta = currentText.slice(prefixLength);
      emittedText = currentText;
      if (nextDelta) {
        onDelta?.(nextDelta, currentText);
      }
      return;
    }
    const nextDelta = currentText.slice(emittedText.length);
    if (!nextDelta) return;
    emittedText = currentText;
    onDelta?.(nextDelta, currentText);
  };
}

function safeJsonParseSnippet(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function extractCompletedJsonArrayItems(text, fieldName) {
  const raw = String(text || '');
  const fieldToken = `"${fieldName}"`;
  const fieldIndex = raw.indexOf(fieldToken);
  if (fieldIndex < 0) return [];

  let index = fieldIndex + fieldToken.length;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  if (raw[index] !== ':') return [];

  index += 1;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  if (raw[index] !== '[') return [];

  const items = [];
  let itemStart = -1;
  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escaped = false;

  for (index += 1; index < raw.length; index += 1) {
    const char = raw[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (inString) {
      if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (itemStart < 0) {
      if (/\s|,/.test(char)) continue;
      if (char === ']') break;
      if (char === '{') {
        itemStart = index;
        objectDepth = 1;
        arrayDepth = 0;
      }
      continue;
    }

    if (char === '{') {
      objectDepth += 1;
      continue;
    }

    if (char === '}') {
      objectDepth -= 1;
      if (objectDepth === 0 && arrayDepth === 0) {
        items.push(raw.slice(itemStart, index + 1));
        itemStart = -1;
      }
      continue;
    }

    if (char === '[') {
      arrayDepth += 1;
      continue;
    }

    if (char === ']' && arrayDepth > 0) {
      arrayDepth -= 1;
    }
  }

  return items;
}

function normalizePreviewList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => `${item || ''}`.trim()).filter(Boolean);
}

function normalizePreviewSlide(slide, index, previousSlide = null) {
  const validTypes = new Set(['cover', 'toc', 'content', 'summary']);
  return {
    id: previousSlide?.id || nanoid(),
    title: typeof slide?.title === 'string' && slide.title.trim() ? slide.title.trim() : `第 ${index + 1} 页`,
    type: validTypes.has(slide?.type) ? slide.type : 'content',
    bullets: normalizePreviewList(slide?.bullets),
    example: typeof slide?.example === 'string' ? slide.example : '',
    question: typeof slide?.question === 'string' ? slide.question : '',
    visual: typeof slide?.visual === 'string' ? slide.visual : '',
    notes: typeof slide?.notes === 'string' ? slide.notes : '',
    teachingGoal: typeof slide?.teachingGoal === 'string' ? slide.teachingGoal : '',
    speakerNotes: typeof slide?.speakerNotes === 'string' ? slide.speakerNotes : '',
    commonMistakes: normalizePreviewList(slide?.commonMistakes)
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

  return {
    id: fallbackSlide.id || nanoid(),
    title: typeof rawSlide?.title === 'string' && rawSlide.title.trim()
      ? rawSlide.title.trim()
      : (fallbackSlide.title || `第 ${index + 1} 页`),
    type: validTypes.has(rawSlide?.type) ? rawSlide.type : (fallbackSlide.type || 'content'),
    bullets: toList(rawSlide?.bullets).length ? toList(rawSlide?.bullets) : (Array.isArray(fallbackSlide.bullets) ? fallbackSlide.bullets : []),
    example: typeof rawSlide?.example === 'string' ? rawSlide.example : (fallbackSlide.example || ''),
    question: typeof rawSlide?.question === 'string' ? rawSlide.question : (fallbackSlide.question || ''),
    visual: typeof rawSlide?.visual === 'string' ? rawSlide.visual : (fallbackSlide.visual || ''),
    notes: typeof rawSlide?.notes === 'string' ? rawSlide.notes : (fallbackSlide.notes || ''),
    teachingGoal: typeof rawSlide?.teachingGoal === 'string' ? rawSlide.teachingGoal : (fallbackSlide.teachingGoal || ''),
    speakerNotes: typeof rawSlide?.speakerNotes === 'string' ? rawSlide.speakerNotes : (fallbackSlide.speakerNotes || ''),
    commonMistakes: toList(rawSlide?.commonMistakes).length
      ? toList(rawSlide?.commonMistakes)
      : (Array.isArray(fallbackSlide.commonMistakes) ? fallbackSlide.commonMistakes : [])
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

app.get('/api/status', (_, res) => {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    sessions: sessions.size,
    llmConfigured: isLLMConfigured(),
    rag: getStats()
  });
});

app.get('/api/rag/status', (_, res) => {
  res.json(getStats());
});

app.post('/api/rag/query', (req, res) => {
  const { query, topK } = req.body || {};
  const results = searchKnowledge(String(query || ''), Number(topK || 4));
  res.json({ query, results });
});

app.post('/api/rag/reload', (_, res) => {
  const stats = reloadKnowledgeBase();
  res.json({ ok: true, ...stats });
});

app.post('/api/ppt/scene/regenerate', async (req, res) => {
  const { sessionId, draft, scene, force = true } = req.body || {};
  const hasSession = sessionId && sessions.has(sessionId);
  const session = hasSession ? sessions.get(sessionId) : null;
  let exportDraft = draft || session?.state?.draft;
  const ragContext = session?.state?.rag || [];

  if (session) {
    const synced = syncClientPresentationState(session.state, draft, scene);
    exportDraft = synced.draft || exportDraft;
  } else if (exportDraft && scene) {
    exportDraft = mergeSceneIntoDraft(exportDraft, scene) || exportDraft;
  }

  if (!exportDraft) {
    return res.status(400).json({ error: 'draft_required' });
  }

  try {
    const result = await buildScenePayload({ draft: exportDraft, ragContext, useAi: force !== false });
    if (!result.scene) {
      return res.status(400).json({ error: 'invalid_draft' });
    }
    if (session) {
      applySceneToState(session.state, result.scene, result.source, 'ready');
    }
    return res.json({
      sessionId: session?.id || sessionId || '',
      draft: session?.state?.draft || exportDraft,
      scene: result.scene,
      source: result.source,
      updatedAt: result.scene.updatedAt
    });
  } catch (error) {
    return res.status(500).json({ error: 'scene_regenerate_failed', message: String(error) });
  }
});

app.post('/api/ppt/scene/regenerate/stream', async (req, res) => {
  const { sessionId, draft, scene, force = true } = req.body || {};
  const hasSession = sessionId && sessions.has(sessionId);
  const session = hasSession ? sessions.get(sessionId) : null;
  let exportDraft = draft || session?.state?.draft;
  const ragContext = session?.state?.rag || [];

  const cleanupSse = initSse(res);

  if (session) {
    const synced = syncClientPresentationState(session.state, draft, scene);
    exportDraft = synced.draft || exportDraft;
  } else if (exportDraft && scene) {
    exportDraft = mergeSceneIntoDraft(exportDraft, scene) || exportDraft;
  }

  if (!exportDraft) {
    return writeSseErrorAndEnd(res, cleanupSse, { error: 'draft_required' });
  }

  try {
    writeSseEvent(res, 'status', { text: '正在优化预览版式…' });
    const result = await buildScenePayload({
      draft: exportDraft,
      ragContext,
      useAi: force !== false,
      onModelDelta: (delta) => writeSseEvent(res, 'model_delta', { delta })
    });
    if (!result.scene) {
      return writeSseErrorAndEnd(res, cleanupSse, { error: 'invalid_draft' });
    }
    if (session) {
      applySceneToState(session.state, result.scene, result.source, 'ready');
    }
    writeSseEvent(res, 'result', {
      sessionId: session?.id || sessionId || '',
      draft: session?.state?.draft || exportDraft,
      scene: result.scene,
      source: result.source,
      updatedAt: result.scene.updatedAt
    });
    return endSse(res, cleanupSse);
  } catch (error) {
    console.error('[scene_regenerate_stream_failed]', error);
    return writeSseErrorAndEnd(res, cleanupSse, {
      error: 'scene_regenerate_failed',
      message: toClientErrorMessage(error, '版式优化失败，请稍后重试。')
    });
  }
});

app.post('/api/ppt/generate', async (req, res) => {
  const { sessionId, draft, scene, fields } = req.body || {};
  const session = getSession(sessionId);

  syncClientPresentationState(session.state, draft, scene);
  mergeFields(session.state, fields);

  try {
    const result = await generatePresentation(session.state);
    if (result?.error === 'missing_fields') {
      return res.status(400).json({
        error: result.error,
        missingFields: result.missingFields,
        reply: result.reply,
        state: result.state,
        intent: buildIntentPayload(result.state),
        draft: result.draft || null,
        scene: result.scene || null,
        sceneStatus: result.state?.sceneStatus || 'idle',
        rag: result.state?.rag || []
      });
    }

    if (result?.reply) {
      session.messages.push({ role: 'assistant', text: result.reply, ts: Date.now() });
    }

    return res.json({
      sessionId: session.id,
      reply: result.reply,
      state: result.state,
      intent: buildIntentPayload(result.state),
      draft: result.draft || null,
      scene: result.scene || result.state?.scene || null,
      sceneStatus: result.state?.sceneStatus || 'idle',
      rag: result.state?.rag || []
    });
  } catch (error) {
    console.error('[ppt_generate_failed]', error);
    return res.status(500).json({
      error: 'ppt_generate_failed',
      message: toClientErrorMessage(error, 'PPT 生成失败，请稍后重试。')
    });
  }
});

app.post('/api/ppt/slide/enhance', async (req, res) => {
  const { sessionId, draft, scene, slideIndex, instruction = '' } = req.body || {};
  const session = getSession(sessionId);
  const index = Number(slideIndex);

  syncClientPresentationState(session.state, draft, scene);
  const exportDraft = session.state.draft;

  if (!exportDraft || !Array.isArray(exportDraft.ppt) || Number.isNaN(index) || index < 0 || index >= exportDraft.ppt.length) {
    return res.status(400).json({ error: 'invalid_slide_index' });
  }

  try {
    const rawSlide = await generateSingleSlideWithLLM({
      draft: exportDraft,
      slideIndex: index,
      ragContext: session.state.rag || [],
      instruction: typeof instruction === 'string' ? instruction.trim() : ''
    });

    if (!rawSlide || typeof rawSlide !== 'object') {
      return res.status(500).json({ error: 'slide_enhance_failed', message: 'single_slide_empty' });
    }

    const nextDraft = {
      ...exportDraft,
      ppt: [...exportDraft.ppt],
      updatedAt: new Date().toISOString()
    };
    nextDraft.ppt[index] = normalizeDraftSlide(rawSlide, exportDraft.ppt[index], index);
    session.state.draft = nextDraft;

    const rebuiltScene = buildPptSceneFromDraft(nextDraft);
    const nextScene = session.state.scene
      ? replaceSceneSlide(normalizeScene(session.state.scene, nextDraft), rebuiltScene?.slides?.[index], index)
      : rebuiltScene;

    applySceneToState(session.state, nextScene, 'slide', nextScene ? 'ready' : 'idle');

    return res.json({
      sessionId: session.id,
      state: session.state,
      intent: buildIntentPayload(session.state),
      draft: session.state.draft,
      scene: session.state.scene,
      sceneStatus: session.state.sceneStatus || 'idle',
      slideIndex: index
    });
  } catch (error) {
    console.error('[slide_enhance_failed]', error);
    return res.status(500).json({
      error: 'slide_enhance_failed',
      message: toClientErrorMessage(error, '单页优化失败，请稍后重试。')
    });
  }
});

app.post('/api/ppt/generate/stream', async (req, res) => {
  const { sessionId, draft, scene, fields } = req.body || {};
  const session = getSession(sessionId);

  const cleanupSse = initSse(res);

  syncClientPresentationState(session.state, draft, scene);
  mergeFields(session.state, fields);
  const trackDraftPreview = createDraftPreviewTracker(session.state, (payload) => {
    writeSseEvent(res, 'draft_preview', {
      sessionId: session.id,
      ...payload
    });
  });

  try {
    writeSseEvent(res, 'status', { text: '正在整理课程信息…' });
    const result = await generatePresentation(session.state, {
      onModelDelta: (delta, fullText) => {
        trackDraftPreview(delta, fullText);
        writeSseEvent(res, 'model_delta', { delta });
      }
    });

    if (result?.error === 'missing_fields') {
      writeSseEvent(res, 'result', {
        error: result.error,
        missingFields: result.missingFields,
        reply: result.reply,
        state: result.state,
        intent: buildIntentPayload(result.state),
        draft: result.draft || null,
        scene: result.scene || null,
        sceneStatus: result.state?.sceneStatus || 'idle',
        rag: result.state?.rag || []
      });
      return endSse(res, cleanupSse);
    }

    if (result?.reply) {
      session.messages.push({ role: 'assistant', text: result.reply, ts: Date.now() });
    }

    writeSseEvent(res, 'result', {
      sessionId: session.id,
      reply: result.reply,
      state: result.state,
      intent: buildIntentPayload(result.state),
      draft: result.draft || null,
      scene: result.scene || result.state?.scene || null,
      sceneStatus: result.state?.sceneStatus || 'idle',
      rag: result.state?.rag || []
    });
    return endSse(res, cleanupSse);
  } catch (error) {
    console.error('[ppt_generate_stream_failed]', error);
    return writeSseErrorAndEnd(res, cleanupSse, {
      error: 'ppt_generate_failed',
      message: toClientErrorMessage(error, 'PPT 生成失败，请稍后重试。')
    });
  }
});

app.post('/api/export/pptx', async (req, res) => {
  const {
    sessionId,
    draft,
    scene,
    useAi = true,
    useTemplate = true,
    regenerateScene = false
  } = req.body || {};
  let exportDraft = draft;
  let ragContext = [];
  let fields = {};
  const session = sessionId && sessions.has(sessionId) ? sessions.get(sessionId) : null;
  let exportScene = scene || session?.state?.scene || (draft ? buildPptSceneFromDraft(draft) : null);
  if (!exportDraft && session) {
    exportDraft = session.state.draft;
    ragContext = session.state.rag || [];
    fields = session.state.fields || {};
  } else if (session) {
    ragContext = session.state.rag || [];
    fields = session.state.fields || {};
  }

  if (session) {
    const synced = syncClientPresentationState(session.state, exportDraft, scene);
    exportDraft = synced.draft || exportDraft;
    exportScene = synced.scene || exportScene;
  } else if (exportDraft && scene) {
    exportDraft = mergeSceneIntoDraft(exportDraft, scene) || exportDraft;
    exportScene = normalizeScene(scene, exportDraft) || exportScene;
  }

  if (!exportDraft) {
    return res.status(400).json({ error: 'draft_required' });
  }

  try {
    if (!exportScene || regenerateScene) {
      const generated = await buildScenePayload({ draft: exportDraft, ragContext, useAi });
      exportScene = generated.scene || exportScene;
      if (session && exportScene) {
        applySceneToState(session.state, exportScene, generated.source, 'ready');
      }
    }
    const result = await exportPptx(exportDraft, 'lesson', {
      scene: exportScene,
      useTemplate,
      fields
    });
    if (!result) return res.status(400).json({ error: 'invalid_draft' });
    return res.download(result.filePath, result.fileName);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: String(error) });
  }
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, text, draft, scene } = req.body || {};
  const session = getSession(sessionId);

  syncClientPresentationState(session.state, draft, scene);

  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return res.status(400).json({ error: 'text_required' });
  }

  session.messages.push({ role: 'user', text: trimmed, ts: Date.now() });

  let result;
  try {
    result = await handleMessage(session.state, trimmed, session.messages);
  } catch (error) {
    result = { reply: '模型服务暂不可用，请稍后重试。', state: session.state };
  }

  session.messages.push({ role: 'assistant', text: result.reply, ts: Date.now() });

  res.json({
    sessionId: session.id,
    reply: result.reply,
    state: result.state,
    intent: buildIntentPayload(result.state),
    draft: result.draft || null,
    scene: result.scene || result.state?.scene || null,
    sceneStatus: result.state?.sceneStatus || 'idle',
    rag: result.state?.rag || []
  });
});

app.post('/api/chat/stream', async (req, res) => {
  const { sessionId, text, draft, scene } = req.body || {};
  const session = getSession(sessionId);

  const cleanupSse = initSse(res);
  syncClientPresentationState(session.state, draft, scene);

  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return writeSseErrorAndEnd(res, cleanupSse, { error: 'text_required' });
  }

  session.messages.push({ role: 'user', text: trimmed, ts: Date.now() });
  const trackReplyDelta = createJsonFieldDeltaTracker('assistantReply', (delta) => {
    writeSseEvent(res, 'reply_delta', { delta });
  });

  try {
    writeSseEvent(res, 'status', { text: '正在理解你的课程需求…' });
    const result = await handleMessage(session.state, trimmed, session.messages, {
      onModelDelta: (delta) => {
        trackReplyDelta(delta);
        writeSseEvent(res, 'model_delta', { delta });
      }
    });
    session.messages.push({ role: 'assistant', text: result.reply, ts: Date.now() });
    writeSseEvent(res, 'result', {
      sessionId: session.id,
      reply: result.reply,
      state: result.state,
      intent: buildIntentPayload(result.state),
      draft: result.draft || null,
      scene: result.scene || result.state?.scene || null,
      sceneStatus: result.state?.sceneStatus || 'idle',
      rag: result.state?.rag || []
    });
    return endSse(res, cleanupSse);
  } catch (error) {
    console.error('[chat_stream_failed]', error);
    return writeSseErrorAndEnd(res, cleanupSse, {
      error: 'chat_failed',
      message: toClientErrorMessage(error, '模型服务暂不可用，请稍后重试。'),
      fallbackReply: '模型服务暂不可用，请稍后重试。'
    });
  }
});

app.post('/api/session/fields', (req, res) => {
  const { sessionId, fields = {} } = req.body || {};
  const session = getSession(sessionId);
  const nextFields = {
    ...session.state.fields,
    ...fields,
    keyPoints: Array.isArray(fields.keyPoints)
      ? fields.keyPoints.map((item) => `${item}`.trim()).filter(Boolean)
      : `${fields.keyPoints ?? session.state.fields.keyPoints ?? ''}`
          .split(/[，,、\n]/)
          .map((item) => item.trim())
          .filter(Boolean)
  };

  session.state.fields = nextFields;
  session.state.ready = Boolean(nextFields.subject && nextFields.grade && nextFields.duration && nextFields.goals && nextFields.keyPoints.length);
  session.state.confirmed = false;
  session.state.draft = null;
  session.state.scene = null;
  session.state.sceneStatus = 'idle';
  session.state.sceneSource = '';
  session.state.sceneUpdatedAt = '';
  session.state.sceneVersion = 0;

  res.json({
    sessionId: session.id,
    state: session.state,
    intent: buildIntentPayload(session.state)
  });
});

app.post('/api/upload', upload.array('files', 10), (req, res) => {
  const session = getSession(req.body.sessionId);
  const files = (req.files || []).map((file) => ({
    id: nanoid(),
    name: file.originalname,
    size: file.size,
    mime: file.mimetype,
    url: `/uploads/${path.basename(file.path)}`
  }));

  session.state.uploadedFiles.push(...files);

  res.json({
    sessionId: session.id,
    files,
    message: files.length ? '文件已上传，后续可用于解析。' : '未检测到文件。'
  });
});

app.get('/api/session/:id', (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json({
    sessionId: session.id,
    state: session.state,
    intent: buildIntentPayload(session.state),
    messages: session.messages,
    rag: session.state?.rag || []
  });
});

if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

const server = app.listen(PORT, () => {
  console.log(`AI-educate server running on http://localhost:${PORT}`);
});

server.requestTimeout = 0;
server.headersTimeout = 0;

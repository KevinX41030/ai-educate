const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const { createInitialState, handleMessage, generatePresentation, buildIntentPayload, mergeFields } = require('./agent');
const { getStats, searchKnowledge, reloadKnowledgeBase } = require('./rag');
const { isLLMConfigured, generatePptSceneWithLLM } = require('./llm');
const { exportPptx } = require('./export/pptx');
const { buildPptSceneFromDraft, normalizeScene, mergeSceneIntoDraft } = require('./ppt/scene');

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

function endSse(res, cleanup) {
  cleanup?.();
  if (!res.writableEnded) {
    writeSseEvent(res, 'done', { ok: true });
    res.end();
  }
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
    writeSseEvent(res, 'error', { error: 'draft_required' });
    return endSse(res, cleanupSse);
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
      writeSseEvent(res, 'error', { error: 'invalid_draft' });
      return endSse(res, cleanupSse);
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
    writeSseEvent(res, 'error', { error: 'scene_regenerate_failed', message: String(error) });
    return endSse(res, cleanupSse);
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
    return res.status(500).json({ error: 'ppt_generate_failed', message: String(error) });
  }
});

app.post('/api/ppt/generate/stream', async (req, res) => {
  const { sessionId, draft, scene, fields } = req.body || {};
  const session = getSession(sessionId);

  const cleanupSse = initSse(res);

  syncClientPresentationState(session.state, draft, scene);
  mergeFields(session.state, fields);

  try {
    writeSseEvent(res, 'status', { text: '正在整理课程信息…' });
    const result = await generatePresentation(session.state, {
      onModelDelta: (delta) => writeSseEvent(res, 'model_delta', { delta })
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
    writeSseEvent(res, 'error', { error: 'ppt_generate_failed', message: String(error) });
    return endSse(res, cleanupSse);
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
    writeSseEvent(res, 'error', { error: 'text_required' });
    return endSse(res, cleanupSse);
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
    writeSseEvent(res, 'error', {
      error: 'chat_failed',
      message: String(error),
      fallbackReply: '模型服务暂不可用，请稍后重试。'
    });
    return endSse(res, cleanupSse);
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

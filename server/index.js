const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const { createInitialState, handleMessage, buildIntentPayload } = require('./agent');
const { getStats, searchKnowledge, reloadKnowledgeBase } = require('./rag');
const { isLLMConfigured, generatePptSceneWithLLM } = require('./llm');
const { exportPptx } = require('./export/pptx');
const { buildPptSceneFromDraft, normalizeScene } = require('./ppt/scene');

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

async function buildScenePayload({ draft, ragContext = [], useAi = true }) {
  const fallbackScene = buildPptSceneFromDraft(draft);
  if (!fallbackScene) return { scene: null, source: 'draft' };

  if (useAi) {
    try {
      const rawScene = await generatePptSceneWithLLM({ draft, ragContext });
      const normalized = normalizeScene(rawScene, draft);
      if (normalized) {
        return { scene: normalized, source: 'llm' };
      }
    } catch (error) {
      // fallback below
    }
  }

  return { scene: fallbackScene, source: 'draft' };
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
  const { sessionId, draft, force = true } = req.body || {};
  const hasSession = sessionId && sessions.has(sessionId);
  const session = hasSession ? sessions.get(sessionId) : null;
  const exportDraft = draft || session?.state?.draft;
  const ragContext = session?.state?.rag || [];

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
      scene: result.scene,
      source: result.source,
      updatedAt: result.scene.updatedAt
    });
  } catch (error) {
    return res.status(500).json({ error: 'scene_regenerate_failed', message: String(error) });
  }
});

app.post('/api/export/pptx', async (req, res) => {
  const {
    sessionId,
    draft,
    useAi = true,
    useTemplate = true,
    regenerateScene = false,
    mode = 'editable'
  } = req.body || {};
  let exportDraft = draft;
  let ragContext = [];
  let fields = {};
  const session = sessionId && sessions.has(sessionId) ? sessions.get(sessionId) : null;
  let exportScene = session?.state?.scene || (draft ? buildPptSceneFromDraft(draft) : null);
  if (!exportDraft && session) {
    exportDraft = session.state.draft;
    ragContext = session.state.rag || [];
    fields = session.state.fields || {};
  } else if (session) {
    ragContext = session.state.rag || [];
    fields = session.state.fields || {};
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
      useTemplate: mode === 'editable' ? useTemplate : false,
      fields,
      mode
    });
    if (!result) return res.status(400).json({ error: 'invalid_draft' });
    return res.download(result.filePath, result.fileName);
  } catch (error) {
    return res.status(500).json({ error: 'export_failed', message: String(error) });
  }
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, text } = req.body || {};
  const session = getSession(sessionId);

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

app.listen(PORT, () => {
  console.log(`AI-educate server running on http://localhost:${PORT}`);
});

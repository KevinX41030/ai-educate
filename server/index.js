const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const { createInitialState, handleMessage, buildIntentPayload } = require('./agent');
const { isLLMConfigured } = require('./llm');

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

app.get('/api/status', (_, res) => {
  res.json({
    ok: true,
    serverTime: new Date().toISOString(),
    sessions: sessions.size,
    llmConfigured: isLLMConfigured()
  });
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
    draft: result.draft || null
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
    messages: session.messages
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

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const multer = require('multer');
const { nanoid } = require('nanoid');
const {
  createInitialState,
  handleMessage,
  generatePresentation,
  buildIntentPayload,
  mergeFields,
  normalizeDraft,
  applyEdit,
  attachDraftCitations,
  refreshRagForState
} = require('./agent');
const { getStats, searchKnowledge, reloadKnowledgeBase } = require('./rag');
const { isLLMConfigured, generateSingleSlideWithLLM, editDraftWithLLM } = require('./llm');
const { exportPptx } = require('./export/pptx');
const { exportDocx } = require('./export/docx');
const { buildPptSceneFromDraft, normalizeScene, mergeSceneIntoDraft } = require('./ppt/scene');
const { syncClassroomFromDraft } = require('./classroom/state');
const {
  applySceneToState,
  syncClientPresentationState,
  buildScenePayload,
  normalizeDraftSlide,
  replaceSceneSlide
} = require('./ppt/presentation-state');
const {
  resetGenerationState,
  markGenerationInterrupted
} = require('./ppt/generation-state');
const { initSse, writeSseEvent, endSse, writeSseErrorAndEnd } = require('./lib/sse');
const { toClientErrorMessage } = require('./lib/client-errors');
const { createJsonFieldDeltaTracker } = require('./lib/stream-json');
const { toClientState, toClientUploadedFile } = require('./lib/public-state');
const { createSessionStore } = require('./store/session-store');
const { enrichUploadedFile } = require('./upload/parser');
const { VALID_EDIT_SCOPES, normalizeSlideRange, applyScopedEditFallback } = require('./ppt/edit');

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

app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

const { sessions, getSession, getById, saveSession } = createSessionStore(createInitialState);

function toClientPayload({
  session,
  sessionId = '',
  reply = '',
  state = null,
  intent = null,
  draft = null,
  scene = null,
  classroom = null,
  sceneStatus = 'idle',
  rag = [],
  extra = {}
} = {}) {
  const nextState = state ? toClientState(state) : null;
  return {
    sessionId: session?.id || sessionId || '',
    ...(reply ? { reply } : {}),
    ...(nextState ? { state: nextState } : {}),
    ...(intent ? { intent } : {}),
    ...(draft !== undefined ? { draft } : {}),
    ...(scene !== undefined ? { scene } : {}),
    ...(classroom !== undefined ? { classroom } : {}),
    ...(sceneStatus ? { sceneStatus } : {}),
    ...(rag ? { rag } : {}),
    ...extra
  };
}

function rebuildDraftScene(state, status = 'ready') {
  const scene = buildPptSceneFromDraft(state.draft);
  applySceneToState(state, scene, 'draft', scene ? status : 'idle');
  return scene;
}

function persistSession(session) {
  if (!session) return;
  saveSession(session);
}

async function resolveEditedDraft({ draft, scope, instruction, slideRange, ragContext = [], onModelDelta }) {
  const normalizedRange = scope === 'slides'
    ? normalizeSlideRange(slideRange, draft?.ppt?.length || 0)
    : null;

  if (scope === 'slides' && !normalizedRange) {
    return { error: 'invalid_slide_range' };
  }

  let nextDraft = null;
  if (isLLMConfigured()) {
    try {
      const llmDraft = await editDraftWithLLM({
        draft,
        scope,
        instruction,
        slideRange: normalizedRange
          ? { start: normalizedRange.start + 1, end: normalizedRange.end + 1 }
          : null,
        ragContext,
        onTextDelta: onModelDelta
      });
      nextDraft = normalizeDraft(llmDraft);
    } catch (error) {
      if (typeof onModelDelta === 'function') throw error;
      nextDraft = null;
    }
  }

  if (!nextDraft) {
    nextDraft = applyScopedEditFallback(draft, {
      scope,
      instruction,
      slideRange: normalizedRange
    });
  }

  return { draft: nextDraft, slideRange: normalizedRange };
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
  const { query, topK, sessionId } = req.body || {};
  const session = getById(sessionId);
  const results = searchKnowledge(String(query || ''), Number(topK || 4), session?.state?.uploadedFiles || []);
  res.json({ query, results });
});

app.post('/api/rag/reload', (_, res) => {
  const stats = reloadKnowledgeBase();
  res.json({ ok: true, ...stats });
});

app.post('/api/ppt/scene/regenerate', async (req, res) => {
  const { sessionId, draft, scene, force = true } = req.body || {};
  const session = getById(sessionId);
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
      persistSession(session);
    }
    return res.json(toClientPayload({
      session,
      sessionId,
      state: session?.state || null,
      draft: session?.state?.draft || exportDraft,
      scene: result.scene,
      classroom: session?.state?.classroom || null,
      sceneStatus: session?.state?.sceneStatus || 'ready',
      rag: session?.state?.rag || ragContext,
      extra: {
        source: result.source,
        updatedAt: result.scene.updatedAt
      }
    }));
  } catch (error) {
    return res.status(500).json({ error: 'scene_regenerate_failed', message: String(error) });
  }
});

app.post('/api/ppt/scene/regenerate/stream', async (req, res) => {
  const { sessionId, draft, scene, force = true } = req.body || {};
  const session = getById(sessionId);
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
      persistSession(session);
    }
    writeSseEvent(res, 'result', {
      ...toClientPayload({
        session,
        sessionId,
        state: session?.state || null,
        draft: session?.state?.draft || exportDraft,
        scene: result.scene,
        classroom: session?.state?.classroom || null,
        sceneStatus: session?.state?.sceneStatus || 'ready',
        rag: session?.state?.rag || ragContext
      }),
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
      persistSession(session);
      return res.status(400).json(toClientPayload({
        session,
        reply: result.reply,
        state: result.state,
        intent: buildIntentPayload(result.state),
        draft: result.draft || null,
        scene: result.scene || null,
        classroom: result.classroom || result.state?.classroom || null,
        sceneStatus: result.state?.sceneStatus || 'idle',
        rag: result.state?.rag || [],
        extra: {
          error: result.error,
          missingFields: result.missingFields
        }
      }));
    }

    if (result?.reply) {
      session.messages.push({ role: 'assistant', text: result.reply, ts: Date.now() });
    }
    persistSession(session);

    return res.json(toClientPayload({
      session,
      reply: result.reply,
      state: result.state,
      intent: buildIntentPayload(result.state),
      draft: result.draft || null,
      scene: result.scene || result.state?.scene || null,
      classroom: result.classroom || result.state?.classroom || null,
      sceneStatus: result.state?.sceneStatus || 'idle',
      rag: result.state?.rag || []
    }));
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
    session.state.draft = attachDraftCitations(nextDraft, session.state.rag || []);

    const rebuiltScene = buildPptSceneFromDraft(session.state.draft);
    const nextScene = session.state.scene
      ? replaceSceneSlide(normalizeScene(session.state.scene, session.state.draft), rebuiltScene?.slides?.[index], index)
      : rebuiltScene;

    applySceneToState(session.state, nextScene, 'slide', nextScene ? 'ready' : 'idle');
    persistSession(session);

    return res.json(toClientPayload({
      session,
      state: session.state,
      intent: buildIntentPayload(session.state),
      draft: session.state.draft,
      scene: session.state.scene,
      classroom: session.state.classroom || null,
      sceneStatus: session.state.sceneStatus || 'idle',
      rag: session.state.rag || [],
      extra: {
        slideIndex: index
      }
    }));
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
  let streamCompleted = false;

  syncClientPresentationState(session.state, draft, scene);
  mergeFields(session.state, fields);

  res.on('close', () => {
    if (streamCompleted) return;
    markGenerationInterrupted(session.state);
    persistSession(session);
  });

  try {
    writeSseEvent(res, 'status', { text: '正在整理课程信息…' });
    const result = await generatePresentation(session.state, {
      onStage: (payload = {}) => {
        persistSession(session);
        writeSseEvent(res, 'generation_stage', payload);
        if (payload.text) {
          writeSseEvent(res, 'status', { text: payload.text, stage: payload.stage || '' });
        }
      },
      onProgress: (payload = {}) => {
        persistSession(session);
        writeSseEvent(res, 'generation_progress', payload);
        if (payload.text) {
          writeSseEvent(res, 'status', {
            text: payload.text,
            stage: payload.stage || '',
            completed: payload.completed,
            total: payload.total
          });
        }
      },
      onOutline: (payload = {}) => {
        persistSession(session);
        writeSseEvent(res, 'outline', payload);
      },
      onSlide: (payload = {}) => {
        persistSession(session);
        writeSseEvent(res, 'slide', {
          sessionId: session.id,
          classroom: payload.classroom || session.state.classroom || null,
          ...payload
        });
        writeSseEvent(res, 'draft_preview', {
          sessionId: session.id,
          draft: payload.draft,
          scene: payload.scene,
          classroom: payload.classroom || session.state.classroom || null,
          sceneStatus: payload.sceneStatus,
          slideCount: payload.slideCount,
          slide: payload.slide,
          index: payload.index,
          total: payload.total
        });
      },
      onModelDelta: (delta) => {
        writeSseEvent(res, 'model_delta', { delta });
      }
    });

    if (result?.error === 'missing_fields') {
      writeSseEvent(res, 'result', {
        ...toClientPayload({
          session,
          reply: result.reply,
          state: result.state,
          intent: buildIntentPayload(result.state),
          draft: result.draft || null,
          scene: result.scene || null,
          classroom: result.classroom || result.state?.classroom || null,
          sceneStatus: result.state?.sceneStatus || 'idle',
          rag: result.state?.rag || []
        }),
        error: result.error,
        missingFields: result.missingFields
      });
      persistSession(session);
      streamCompleted = true;
      return endSse(res, cleanupSse);
    }

    if (result?.reply) {
      session.messages.push({ role: 'assistant', text: result.reply, ts: Date.now() });
    }

    persistSession(session);
    streamCompleted = true;
    writeSseEvent(res, 'result', toClientPayload({
      session,
      reply: result.reply,
      state: result.state,
      intent: buildIntentPayload(result.state),
      draft: result.draft || null,
      scene: result.scene || result.state?.scene || null,
      classroom: result.classroom || result.state?.classroom || null,
      sceneStatus: result.state?.sceneStatus || 'idle',
      rag: result.state?.rag || []
    }));
    return endSse(res, cleanupSse);
  } catch (error) {
    console.error('[ppt_generate_stream_failed]', error);
    persistSession(session);
    streamCompleted = true;
    return writeSseErrorAndEnd(res, cleanupSse, {
      error: 'ppt_generate_failed',
      message: toClientErrorMessage(error, 'PPT 生成失败，请稍后重试。')
    });
  }
});

app.post('/api/ppt/edit', async (req, res) => {
  const { sessionId, draft, scene, scope = 'all', instruction = '', slideRange = null } = req.body || {};
  const session = getSession(sessionId);
  const normalizedScope = VALID_EDIT_SCOPES.has(scope) ? scope : '';

  if (!normalizedScope) {
    return res.status(400).json({ error: 'invalid_scope' });
  }

  syncClientPresentationState(session.state, draft, scene);
  const exportDraft = session.state.draft;
  if (!exportDraft) {
    return res.status(400).json({ error: 'draft_required' });
  }

  if (!session.state.rag?.length) {
    refreshRagForState(session.state, 6);
  }

  try {
    const edited = await resolveEditedDraft({
      draft: exportDraft,
      scope: normalizedScope,
      instruction: typeof instruction === 'string' ? instruction.trim() : '',
      slideRange,
      ragContext: session.state.rag || []
    });

    if (edited.error) {
      return res.status(400).json({ error: edited.error });
    }

    session.state.draft = attachDraftCitations(edited.draft, session.state.rag || []);
    rebuildDraftScene(session.state, 'ready');
    persistSession(session);

    return res.json(toClientPayload({
      session,
      state: session.state,
      intent: buildIntentPayload(session.state),
      draft: session.state.draft,
      scene: session.state.scene,
      classroom: session.state.classroom || null,
      sceneStatus: session.state.sceneStatus || 'ready',
      rag: session.state.rag || []
    }));
  } catch (error) {
    return res.status(500).json({
      error: 'ppt_edit_failed',
      message: toClientErrorMessage(error, '局部修改失败，请稍后重试。')
    });
  }
});

app.post('/api/ppt/edit/stream', async (req, res) => {
  const { sessionId, draft, scene, scope = 'all', instruction = '', slideRange = null } = req.body || {};
  const session = getSession(sessionId);
  const normalizedScope = VALID_EDIT_SCOPES.has(scope) ? scope : '';
  const cleanupSse = initSse(res);

  if (!normalizedScope) {
    return writeSseErrorAndEnd(res, cleanupSse, { error: 'invalid_scope' });
  }

  syncClientPresentationState(session.state, draft, scene);
  const exportDraft = session.state.draft;
  if (!exportDraft) {
    return writeSseErrorAndEnd(res, cleanupSse, { error: 'draft_required' });
  }

  if (!session.state.rag?.length) {
    refreshRagForState(session.state, 6);
  }

  try {
    writeSseEvent(res, 'status', { text: '正在应用你的修改要求…' });
    const edited = await resolveEditedDraft({
      draft: exportDraft,
      scope: normalizedScope,
      instruction: typeof instruction === 'string' ? instruction.trim() : '',
      slideRange,
      ragContext: session.state.rag || [],
      onModelDelta: (delta) => writeSseEvent(res, 'model_delta', { delta })
    });

    if (edited.error) {
      return writeSseErrorAndEnd(res, cleanupSse, { error: edited.error });
    }

    session.state.draft = attachDraftCitations(edited.draft, session.state.rag || []);
    rebuildDraftScene(session.state, 'ready');
    persistSession(session);

    writeSseEvent(res, 'result', toClientPayload({
      session,
      state: session.state,
      intent: buildIntentPayload(session.state),
      draft: session.state.draft,
      scene: session.state.scene,
      classroom: session.state.classroom || null,
      sceneStatus: session.state.sceneStatus || 'ready',
      rag: session.state.rag || []
    }));
    return endSse(res, cleanupSse);
  } catch (error) {
    return writeSseErrorAndEnd(res, cleanupSse, {
      error: 'ppt_edit_failed',
      message: toClientErrorMessage(error, '局部修改失败，请稍后重试。')
    });
  }
});

app.post('/api/export/pptx', async (req, res) => {
  const {
    sessionId,
    draft,
    scene,
    classroom,
    useAi = true,
    useTemplate = true,
    regenerateScene = false
  } = req.body || {};
  let exportDraft = draft;
  let ragContext = [];
  let fields = {};
  const session = getById(sessionId);
  let exportClassroom = classroom || session?.state?.classroom || null;
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
    exportClassroom = session.state.classroom || exportClassroom;
  } else if (exportDraft && scene) {
    exportDraft = mergeSceneIntoDraft(exportDraft, scene) || exportDraft;
    exportScene = normalizeScene(scene, exportDraft) || exportScene;
  }

  if (!exportDraft && !exportClassroom) {
    return res.status(400).json({ error: 'draft_required' });
  }

  try {
    if (exportDraft && (!exportScene || regenerateScene)) {
      const generated = await buildScenePayload({ draft: exportDraft, ragContext, useAi });
      exportScene = generated.scene || exportScene;
      if (session && exportScene) {
        applySceneToState(session.state, exportScene, generated.source, 'ready');
        exportClassroom = session.state.classroom || exportClassroom;
        persistSession(session);
      }
    }
    const result = await exportPptx(exportDraft, 'lesson', {
      classroom: exportClassroom,
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

app.post('/api/export/docx', async (req, res) => {
  const { sessionId, draft, rag, fields } = req.body || {};
  const session = getById(sessionId);
  const exportDraft = draft || session?.state?.draft;
  const exportRag = Array.isArray(rag) ? rag : (session?.state?.rag || []);
  const exportFields = fields || session?.state?.fields || {};

  if (!exportDraft) {
    return res.status(400).json({ error: 'draft_required' });
  }

  try {
    const result = await exportDocx(exportDraft, 'lesson-plan', {
      fields: exportFields,
      rag: exportRag
    });
    if (!result) return res.status(400).json({ error: 'invalid_draft' });
    return res.download(result.filePath, result.fileName);
  } catch (error) {
    return res.status(500).json({ error: 'export_docx_failed', message: String(error) });
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
  persistSession(session);

  res.json(toClientPayload({
    session,
    reply: result.reply,
    state: result.state,
    intent: buildIntentPayload(result.state),
    draft: result.draft || null,
    scene: result.scene || result.state?.scene || null,
    classroom: result.classroom || result.state?.classroom || null,
    sceneStatus: result.state?.sceneStatus || 'idle',
    rag: result.state?.rag || []
  }));
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
    persistSession(session);
    writeSseEvent(res, 'result', toClientPayload({
      session,
      reply: result.reply,
      state: result.state,
      intent: buildIntentPayload(result.state),
      draft: result.draft || null,
      scene: result.scene || result.state?.scene || null,
      classroom: result.classroom || result.state?.classroom || null,
      sceneStatus: result.state?.sceneStatus || 'idle',
      rag: result.state?.rag || []
    }));
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
  session.state.classroom = null;
  session.state.classroomSource = '';
  session.state.classroomUpdatedAt = '';
  session.state.classroomVersion = 0;
  resetGenerationState(session.state);
  refreshRagForState(session.state, 6);
  persistSession(session);

  res.json(toClientPayload({
    session,
    state: session.state,
    intent: buildIntentPayload(session.state),
    rag: session.state.rag || []
  }));
});

app.post('/api/upload', upload.array('files', 10), async (req, res) => {
  const session = getSession(req.body.sessionId);
  const files = await Promise.all((req.files || []).map((file) => enrichUploadedFile({
    id: nanoid(),
    sourceId: `upload:${nanoid(10)}`,
    name: file.originalname,
    size: file.size,
    mime: file.mimetype,
    url: `/uploads/${path.basename(file.path)}`,
    diskPath: file.path
  })));

  session.state.uploadedFiles.push(...files);
  refreshRagForState(session.state, 6);
  if (session.state.draft) {
    session.state.draft = attachDraftCitations(session.state.draft, session.state.rag || []);
    syncClassroomFromDraft(session.state, {
      source: 'upload',
      status: session.state.sceneStatus || 'ready'
    });
  }
  persistSession(session);

  const parsedCount = files.filter((file) => file.status === 'parsed').length;
  res.json(toClientPayload({
    session,
    state: session.state,
    intent: buildIntentPayload(session.state),
    rag: session.state.rag || [],
    extra: {
      files: files.map((file) => toClientUploadedFile(file)),
      message: files.length
        ? (parsedCount
            ? `文件已上传，其中 ${parsedCount} 份已完成解析，后续生成会自动参考。`
            : '文件已上传，但当前未解析出可用文本。')
        : '未检测到文件。'
    }
  }));
});

app.get('/api/session/:id', (req, res) => {
  const session = getById(req.params.id);
  if (!session) return res.status(404).json({ error: 'not_found' });
  res.json({
    sessionId: session.id,
    state: toClientState(session.state),
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

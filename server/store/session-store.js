const fs = require('fs');
const path = require('path');

const DEFAULT_SESSIONS_DIR = path.join(__dirname, '..', '..', 'data', 'sessions');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function mergeState(base, incoming = {}) {
  const {
    openmaic: _openmaic,
    ...incomingState
  } = incoming || {};

  return {
    ...base,
    ...incomingState,
    id: incomingState.id || base.id,
    fields: {
      ...(base.fields || {}),
      ...(incomingState.fields || {})
    },
    brief: {
      ...(base.brief || {}),
      ...(incomingState.brief || {})
    },
    aiDecision: {
      ...(base.aiDecision || {}),
      ...(incomingState.aiDecision || {})
    },
    generation: {
      ...(base.generation || {}),
      ...(incomingState.generation || {})
    },
    uploadedFiles: Array.isArray(incomingState.uploadedFiles) ? incomingState.uploadedFiles : (base.uploadedFiles || []),
    rag: Array.isArray(incomingState.rag) ? incomingState.rag : (base.rag || [])
  };
}

function createSessionStore(createInitialState, options = {}) {
  const sessions = new Map();
  const sessionsDir = options.sessionsDir || DEFAULT_SESSIONS_DIR;

  ensureDir(sessionsDir);

  function toFilePath(id) {
    return path.join(sessionsDir, `${id}.json`);
  }

  function createBlankSession() {
    const state = createInitialState();
    const session = {
      id: state.id,
      state,
      messages: [],
      updatedAt: new Date().toISOString()
    };
    sessions.set(session.id, session);
    return session;
  }

  function hydrateSession(raw = {}) {
    const baseState = createInitialState();
    const state = mergeState(baseState, raw.state || {});
    state.id = raw.id || state.id;

    const session = {
      id: state.id,
      state,
      messages: Array.isArray(raw.messages) ? raw.messages : [],
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
    sessions.set(session.id, session);
    return session;
  }

  function saveSession(session) {
    if (!session?.id) return null;
    ensureDir(sessionsDir);
    const filePath = toFilePath(session.id);
    const tempPath = `${filePath}.tmp`;
    const payload = JSON.stringify({
      id: session.id,
      state: session.state,
      messages: session.messages || [],
      updatedAt: new Date().toISOString()
    }, null, 2);

    fs.writeFileSync(tempPath, payload, 'utf8');
    fs.renameSync(tempPath, filePath);
    session.updatedAt = new Date().toISOString();
    sessions.set(session.id, session);
    return session;
  }

  function loadSession(id) {
    if (!id) return null;
    if (sessions.has(id)) return sessions.get(id);

    const filePath = toFilePath(id);
    if (!fs.existsSync(filePath)) return null;

    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return hydrateSession(raw);
    } catch (error) {
      return null;
    }
  }

  function getSession(id) {
    return loadSession(id) || createBlankSession();
  }

  return {
    sessions,
    getSession,
    getById(id) {
      return loadSession(id);
    },
    hasSession(id) {
      return Boolean(loadSession(id));
    },
    saveSession,
    sessionsDir
  };
}

module.exports = {
  createSessionStore
};

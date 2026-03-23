export async function getStatus() {
  const response = await fetch('/api/status');
  if (!response.ok) throw new Error('status_failed');
  return response.json();
}

export async function getSessionSnapshot(sessionId) {
  const response = await fetch(`/api/session/${sessionId}`);
  if (!response.ok) throw new Error('session_failed');
  return response.json();
}

export async function sendMessage({ sessionId, text, draft = null, scene = null }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text, draft, scene })
  });

  if (!response.ok) throw new Error('chat_failed');
  return response.json();
}

async function readSseResponse(response, onEvent) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'stream_failed');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('stream_reader_unavailable');

  const decoder = new TextDecoder();
  let buffer = '';

  const consumeChunk = (chunk) => {
    if (!chunk.trim()) return;

    let event = 'message';
    const dataLines = [];

    chunk.split('\n').forEach((line) => {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
        return;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    });

    if (!dataLines.length) return;
    const raw = dataLines.join('\n');
    if (!raw) return;

    let data = raw;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      data = raw;
    }

    onEvent?.({ event, data });
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      consumeChunk(chunk);
      boundary = buffer.indexOf('\n\n');
    }

    if (done) break;
  }

  if (buffer.trim()) {
    consumeChunk(buffer);
  }
}

export async function streamMessage({ sessionId, text, draft = null, scene = null, onEvent }) {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text, draft, scene })
  });

  await readSseResponse(response, onEvent);
}

export async function generatePpt({ sessionId, fields = null, draft = null, scene = null }) {
  const payload = {
    sessionId,
    ...(fields ? { fields } : {}),
    ...(draft ? { draft } : {}),
    ...(scene ? { scene } : {})
  };

  const response = await fetch('/api/ppt/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error('ppt_generate_failed');
  return response.json();
}

export async function streamGeneratePpt({ sessionId, fields = null, draft = null, scene = null, onEvent }) {
  const payload = {
    sessionId,
    ...(fields ? { fields } : {}),
    ...(draft ? { draft } : {}),
    ...(scene ? { scene } : {})
  };

  const response = await fetch('/api/ppt/generate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  await readSseResponse(response, onEvent);
}

export async function updateSessionFields({ sessionId, fields }) {
  const response = await fetch('/api/session/fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, fields })
  });

  if (!response.ok) throw new Error('session_fields_failed');
  return response.json();
}

export async function uploadFiles({ sessionId, files }) {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  if (sessionId) formData.append('sessionId', sessionId);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) throw new Error('upload_failed');
  return response.json();
}

export async function regeneratePptScene({ sessionId, draft, scene = null, force = true }) {
  const response = await fetch('/api/ppt/scene/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, scene, force })
  });

  if (!response.ok) throw new Error('scene_regenerate_failed');
  return response.json();
}

export async function streamRegeneratePptScene({ sessionId, draft, scene = null, force = true, onEvent }) {
  const response = await fetch('/api/ppt/scene/regenerate/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, scene, force })
  });

  await readSseResponse(response, onEvent);
}

export async function enhancePptSlide({ sessionId, draft, scene = null, slideIndex, instruction = '' }) {
  const response = await fetch('/api/ppt/slide/enhance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, scene, slideIndex, instruction })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'slide_enhance_failed');
  }
  return data;
}

export async function exportPptx({ sessionId, draft, scene = null, useAi = true, regenerateScene = false }) {
  const response = await fetch('/api/export/pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, scene, useAi, regenerateScene })
  });
  if (!response.ok) throw new Error('export_failed');
  return response;
}

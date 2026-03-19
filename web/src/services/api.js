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

export async function generatePpt({ sessionId, draft = null, scene = null }) {
  const response = await fetch('/api/ppt/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, scene })
  });

  if (!response.ok) throw new Error('ppt_generate_failed');
  return response.json();
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

export async function exportPptx({ sessionId, draft, scene = null, useAi = true, regenerateScene = false }) {
  const response = await fetch('/api/export/pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, scene, useAi, regenerateScene })
  });
  if (!response.ok) throw new Error('export_failed');
  return response;
}

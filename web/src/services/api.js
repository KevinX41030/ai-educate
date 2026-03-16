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

export async function sendMessage({ sessionId, text }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, text })
  });

  if (!response.ok) throw new Error('chat_failed');
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

export async function regeneratePptScene({ sessionId, draft, force = true }) {
  const response = await fetch('/api/ppt/scene/regenerate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, force })
  });

  if (!response.ok) throw new Error('scene_regenerate_failed');
  return response.json();
}

export async function exportPptx({ sessionId, draft, useAi = true, mode = 'editable', regenerateScene = false }) {
  const response = await fetch('/api/export/pptx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, draft, useAi, mode, regenerateScene })
  });
  if (!response.ok) throw new Error('export_failed');
  return response;
}

function toClientUploadedFile(file = {}) {
  return {
    id: file.id,
    sourceId: file.sourceId,
    name: file.name,
    size: file.size,
    mime: file.mime,
    url: file.url,
    status: file.status || 'uploaded',
    parseSummary: file.parseSummary || '',
    chunkCount: Number(file.chunkCount || 0),
    parsedAt: file.parsedAt || ''
  };
}

function toClientState(state = null) {
  if (!state || typeof state !== 'object') return state;
  const {
    openmaic: _openmaic,
    ...nextState
  } = state;

  return {
    ...nextState,
    uploadedFiles: Array.isArray(nextState.uploadedFiles)
      ? nextState.uploadedFiles.map((file) => toClientUploadedFile(file))
      : []
  };
}

module.exports = {
  toClientUploadedFile,
  toClientState
};

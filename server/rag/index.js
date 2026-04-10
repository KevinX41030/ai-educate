const fs = require('fs');
const path = require('path');
const { chunkText, normalizeText, tokenizeQuery, scoreTextAgainstTokens, summarizeText } = require('../lib/text');

const KB_DIR = path.join(__dirname, '..', '..', 'data', 'knowledge_base');

let baseIndex = [];
let stats = { files: 0, chunks: 0, updatedAt: null };

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function readFileContent(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf8');
  if (extension === '.json') {
    try {
      return JSON.stringify(JSON.parse(raw));
    } catch (error) {
      return raw;
    }
  }
  return raw;
}

function createChunkRecord({ id, sourceId, sourceType, source, content }) {
  return {
    id,
    sourceId,
    sourceType,
    source,
    content,
    contentLower: normalizeText(content),
    summary: summarizeText(content, 120)
  };
}

function buildChunkRecordsFromText({ sourceId, sourceType, source, text }) {
  const chunks = chunkText(text);
  return chunks.map((content, index) => createChunkRecord({
    id: `${sourceId}:${index}`,
    sourceId,
    sourceType,
    source,
    content
  }));
}

function buildBaseIndex() {
  baseIndex = [];
  const files = walkDir(KB_DIR).filter((file) => /(\.md|\.txt|\.json)$/i.test(file));
  let chunkCount = 0;

  files.forEach((filePath) => {
    const relativePath = path.relative(KB_DIR, filePath);
    const sourceId = `kb:${relativePath}`;
    const chunks = buildChunkRecordsFromText({
      sourceId,
      sourceType: 'knowledge_base',
      source: relativePath,
      text: readFileContent(filePath)
    });
    baseIndex.push(...chunks);
    chunkCount += chunks.length;
  });

  stats = {
    files: files.length,
    chunks: chunkCount,
    updatedAt: new Date().toISOString()
  };
}

function buildUploadIndex(uploadedFiles = []) {
  if (!Array.isArray(uploadedFiles)) return [];
  return uploadedFiles.flatMap((file) => {
    if (!file?.parsedText || file.status !== 'parsed') return [];
    const sourceId = file.sourceId || `upload:${file.id}`;
    return buildChunkRecordsFromText({
      sourceId,
      sourceType: 'upload',
      source: file.name || sourceId,
      text: file.parsedText
    });
  });
}

function buildSearchIndex(uploadedFiles = []) {
  return [...baseIndex, ...buildUploadIndex(uploadedFiles)];
}

function mergeChunkMatches(matches = [], topK = 4) {
  const merged = new Map();

  matches.forEach((match) => {
    if (!merged.has(match.sourceId)) {
      merged.set(match.sourceId, {
        id: match.id,
        sourceId: match.sourceId,
        sourceType: match.sourceType,
        source: match.source,
        score: match.score,
        contents: [match.content]
      });
      return;
    }

    const current = merged.get(match.sourceId);
    current.score += match.score;
    if (current.contents.length < 2 && !current.contents.includes(match.content)) {
      current.contents.push(match.content);
    }
  });

  return [...merged.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      sourceType: item.sourceType,
      source: item.source,
      score: item.score,
      content: item.contents.join('\n\n'),
      summary: summarizeText(item.contents.join(' '), 140)
    }));
}

function searchKnowledge(query, topK = 4, uploadedFiles = []) {
  if (!query) return [];
  const tokens = tokenizeQuery(query);
  if (!tokens.length) return [];

  const matches = buildSearchIndex(uploadedFiles)
    .map((chunk) => ({
      ...chunk,
      score: scoreTextAgainstTokens(chunk.contentLower, tokens)
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return mergeChunkMatches(matches, topK);
}

function getStats() {
  return { ...stats };
}

function reloadKnowledgeBase() {
  buildBaseIndex();
  return getStats();
}

buildBaseIndex();

module.exports = {
  buildChunkRecordsFromText,
  searchKnowledge,
  getStats,
  reloadKnowledgeBase
};

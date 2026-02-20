const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, '..', '..', 'data', 'knowledge_base');

let index = [];
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
  const ext = path.extname(filePath).toLowerCase();
  const raw = fs.readFileSync(filePath, 'utf8');
  if (ext === '.json') {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed);
    } catch (error) {
      return raw;
    }
  }
  return raw;
}

function chunkText(text, maxLen = 800) {
  const rawChunks = text.split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
  const chunks = [];
  for (const chunk of rawChunks) {
    if (chunk.length <= maxLen) {
      chunks.push(chunk);
      continue;
    }
    for (let i = 0; i < chunk.length; i += maxLen) {
      chunks.push(chunk.slice(i, i + maxLen));
    }
  }
  return chunks;
}

function normalizeText(text) {
  return text.toLowerCase();
}

function tokenizeQuery(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return parts.length ? parts : [trimmed];
}

function buildIndex() {
  index = [];
  const files = walkDir(KB_DIR).filter((file) => /(\.md|\.txt|\.json)$/i.test(file));
  let chunkCount = 0;
  files.forEach((filePath) => {
    const content = readFileContent(filePath);
    const chunks = chunkText(content);
    chunks.forEach((chunk, idx) => {
      index.push({
        id: `${path.basename(filePath)}:${idx}`,
        source: path.relative(KB_DIR, filePath),
        content: chunk,
        contentLower: normalizeText(chunk)
      });
      chunkCount += 1;
    });
  });

  stats = {
    files: files.length,
    chunks: chunkCount,
    updatedAt: new Date().toISOString()
  };
}

function scoreChunk(chunk, tokens) {
  if (!tokens.length) return 0;
  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    let idx = chunk.contentLower.indexOf(token.toLowerCase());
    while (idx !== -1) {
      score += 1;
      idx = chunk.contentLower.indexOf(token.toLowerCase(), idx + token.length);
    }
  }
  return score;
}

function searchKnowledge(query, topK = 4) {
  if (!query || !index.length) return [];
  const tokens = tokenizeQuery(query);
  const scored = index
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(chunk, tokens)
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => ({
      id: item.id,
      source: item.source,
      content: item.content,
      score: item.score
    }));
  return scored;
}

function getStats() {
  return { ...stats };
}

function reloadKnowledgeBase() {
  buildIndex();
  return getStats();
}

buildIndex();

module.exports = {
  searchKnowledge,
  getStats,
  reloadKnowledgeBase
};

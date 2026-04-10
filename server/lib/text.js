function normalizeWhitespace(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chunkText(text, maxLen = 800) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const rawChunks = normalized
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const chunks = [];
  for (const chunk of rawChunks) {
    if (chunk.length <= maxLen) {
      chunks.push(chunk);
      continue;
    }

    for (let index = 0; index < chunk.length; index += maxLen) {
      chunks.push(chunk.slice(index, index + maxLen));
    }
  }

  return chunks;
}

function summarizeText(text = '', maxLen = 120) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return '';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trim()}...`;
}

function normalizeText(text = '') {
  return normalizeWhitespace(text).toLowerCase();
}

function tokenizeQuery(query = '') {
  const normalized = normalizeWhitespace(query);
  if (!normalized) return [];

  const coarseTokens = normalized
    .split(/[\s,，;；、:：()（）]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const tokens = new Set();
  coarseTokens.forEach((token) => {
    tokens.add(token.toLowerCase());
    if (token.length >= 4) {
      for (let index = 0; index <= token.length - 2; index += 1) {
        tokens.add(token.slice(index, index + 2).toLowerCase());
      }
    }
  });

  return [...tokens].filter(Boolean);
}

function scoreTextAgainstTokens(text = '', tokens = []) {
  if (!tokens.length || !text) return 0;
  const normalized = normalizeText(text);
  let score = 0;

  tokens.forEach((token) => {
    if (!token) return;
    let index = normalized.indexOf(token);
    while (index !== -1) {
      score += token.length >= 4 ? 3 : 1;
      index = normalized.indexOf(token, index + token.length);
    }
  });

  return score;
}

module.exports = {
  normalizeWhitespace,
  chunkText,
  summarizeText,
  normalizeText,
  tokenizeQuery,
  scoreTextAgainstTokens
};
